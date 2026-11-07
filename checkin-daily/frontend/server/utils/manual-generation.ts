// Shared handler logic for editor-triggered AI generation (single + batch).
import { createError, type H3Event } from 'h3'
import type { D1Database } from './d1'
import { getWorkerEnvironment } from './d1'
import { assertSafeExternalUrl } from './ssrf-guard'
import { fetchSourceContext } from './source-extractor'
import { resolveGeminiApiKey } from './cron-runner'
import { resolveGeminiModels } from './gemini-client'
import { loadPipelinePolicies, runArticlePipeline, type PipelineResult } from './article-pipeline'

export interface ManualSourceInput {
  title?: string
  sourceUrl?: string
  contextText?: string
  sourceName?: string
  licenseInfo?: string
  category?: string
}

const CATEGORIES = ['major', 'airline', 'hotel', 'destination']

export async function generateFromManualSource(event: H3Event, database: D1Database, input: ManualSourceInput, actor: string): Promise<PipelineResult> {
  const env = getWorkerEnvironment(event) as Record<string, unknown> | undefined
  const apiKey = await resolveGeminiApiKey(database, env)
  if (!apiKey) throw createError({ statusCode: 503, statusMessage: 'GEMINI_API_KEY가 설정되지 않았습니다 (Worker secret 또는 관리자 설정).' })

  const sourceUrl = (input.sourceUrl || '').trim()
  if (sourceUrl) {
    try {
      assertSafeExternalUrl(sourceUrl)
    } catch {
      throw createError({ statusCode: 400, statusMessage: '원문 URL은 공개 HTTPS 주소여야 합니다.' })
    }
  }
  let text = (input.contextText || '').trim().slice(0, 8000)
  let title = (input.title || '').trim().slice(0, 300)
  let sourceName = (input.sourceName || '').trim().slice(0, 120)
  if (sourceUrl && text.length < 400) {
    const page = await fetchSourceContext(sourceUrl).catch(() => null)
    if (page) {
      text = [text, page.description, page.text].filter(Boolean).join('\n\n')
      sourceName ||= page.siteName
    }
  }
  if (!title && text) title = text.split('\n')[0]!.slice(0, 120)
  if (!title) throw createError({ statusCode: 400, statusMessage: '원문 제목 또는 원문 텍스트/URL을 입력해 주세요.' })

  const policies = await loadPipelinePolicies(database)
  return runArticlePipeline(database, {
    trigger: 'manual',
    actor,
    runtime: { apiKey, models: resolveGeminiModels(env) },
    // Editor-triggered stories always land in the review queue.
    policies: { ...policies, autoPublish: false },
    source: {
      title,
      text,
      sourceName: sourceName || (sourceUrl ? new URL(sourceUrl).hostname : '편집국 제공 자료'),
      sourceUrl,
      preferredCategory: input.category && CATEGORIES.includes(input.category) ? input.category : undefined,
      licenseInfo: (input.licenseInfo || '').trim().slice(0, 120) || 'Editor-supplied source (rights review required)',
    },
  })
}

export function describePipelineResult(result: PipelineResult): string {
  switch (result.status) {
    case 'drafted': return `초안 저장 완료 (본문 ${result.charCount}자, 품질점수 ${result.qualityScore}, 번역 ${result.translations?.length ?? 0}개 언어)`
    case 'published': return '자동 발행 완료'
    case 'duplicate': return `중복 기사로 차단: ${result.reason}`
    case 'rejected': return `품질 게이트 차단: ${result.reason}`
    default: return `생성 실패: ${result.reason}`
  }
}
