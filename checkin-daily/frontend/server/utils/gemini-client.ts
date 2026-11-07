import { PREFIXED_LOCALES } from '../../config/locales'
// Gemini newsroom client: schema-enforced JSON generation with retry, timeout and
// refusal detection. This module never invents filler text — if the model output
// does not meet the editorial contract, the caller receives a typed GenerationError.

export const GENERATION_LANGS = PREFIXED_LOCALES
export type GenerationLang = typeof PREFIXED_LOCALES[number]
export const ARTICLE_CATEGORIES = ['major', 'airline', 'hotel', 'destination'] as const

export interface GeminiArticle {
  title: string
  summary: string
  metaDescription: string
  keyTakeaways: string[]
  content: string
  category: string
  tags: string[]
  claims: string[]
}

export interface GeminiTranslation { title: string; summary: string; content: string }

export type GenerationErrorCode =
  | 'NO_API_KEY' | 'RATE_LIMITED' | 'UPSTREAM' | 'TIMEOUT' | 'INVALID_JSON'
  | 'REFUSAL' | 'QUALITY' | 'DUPLICATE' | 'THIN_SOURCE' | 'BLOCKED'

export class GenerationError extends Error {
  constructor(public code: GenerationErrorCode, message: string, public retryable = false) {
    super(message)
    this.name = 'GenerationError'
  }
}

export interface GeminiRuntime {
  apiKey: string
  models?: string[]
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxAttempts?: number
  sleep?: (ms: number) => Promise<void>
}

const DEFAULT_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite']
const REFUSAL_PATTERN = /(죄송하지만|죄송합니다|도와드릴 수 없|제공할 수 없|작성할 수 없|AI 언어 모델|언어 모델로서|as an ai\b|i'm sorry|i am sorry|i cannot|i can't|i can not|unable to (help|assist|comply|provide)|cannot assist|against my guidelines)/i
const ARTIFACT_PATTERN = /(lorem ipsum|\[object object\]|\bundefined\b|\bnull\b|\bT[O]DO\b|\{\{|\}\}|<\/?script|INSERT_|PLACEHOLDER|\[출처 필요\])/i

export function resolveGeminiModels(env: Record<string, unknown> | undefined): string[] {
  const read = (key: string) => {
    const value = env?.[key] ?? (typeof process !== 'undefined' ? process.env?.[key] : undefined)
    return typeof value === 'string' ? value.trim() : ''
  }
  const configured = [read('GEMINI_MODEL'), read('GEMINI_FALLBACK_MODEL')].filter(Boolean)
  return [...new Set(configured.length ? configured : DEFAULT_MODELS)]
}

export function containsRefusal(text: string): boolean {
  return REFUSAL_PATTERN.test(text)
}

export function containsGenerationArtifact(text: string): boolean {
  return ARTIFACT_PATTERN.test(text)
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export function backoffDelay(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 20_000)
  }
  const base = 1000 * 2 ** Math.max(0, attempt - 1)
  return Math.min(base + Math.floor(Math.random() * 250), 16_000)
}

/**
 * Recovers a JSON object from model output that may be wrapped in markdown fences
 * or prose: keeps the first "{" through the last "}" and strips control characters
 * that are illegal inside JSON strings. Returns null when nothing parseable remains.
 */
export function safeParseArticleJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  // eslint-disable-next-line no-control-regex -- removing control characters is the point
  const body = text.slice(start, end + 1).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  try {
    return JSON.parse(body)
  } catch {
    try {
      // Raw newlines/tabs inside string literals are the most common model defect.
      return JSON.parse(body.replace(/\r?\n/g, '\\n').replace(/\t/g, '\\t'))
    } catch {
      return null
    }
  }
}

interface GeminiResponseBody {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>
  promptFeedback?: { blockReason?: string }
}

/**
 * Calls Gemini with a response schema. Retries rate limits, 5xx, timeouts and
 * malformed JSON with exponential backoff, then falls through to the next model.
 */
export async function callGeminiJson<T>(
  runtime: GeminiRuntime,
  prompt: string,
  responseSchema: Record<string, unknown>,
  validate: (value: unknown) => T,
): Promise<{ value: T; model: string; attempts: number }> {
  if (!runtime.apiKey) throw new GenerationError('NO_API_KEY', 'GEMINI_API_KEY is not configured')
  const fetchImpl = runtime.fetchImpl ?? fetch
  const sleep = runtime.sleep ?? defaultSleep
  const models = runtime.models?.length ? runtime.models : DEFAULT_MODELS
  const maxAttempts = runtime.maxAttempts ?? 3
  let attempts = 0
  let lastError: GenerationError | null = null

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts++
      let retryAfter: number | undefined
      try {
        const response = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': runtime.apiKey },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.4 },
            }),
            signal: AbortSignal.timeout(runtime.timeoutMs ?? 90_000),
          },
        )
        if (response.status === 404) {
          lastError = new GenerationError('UPSTREAM', `Model ${model} is not available`)
          break // try the next model
        }
        if (response.status === 429 || response.status >= 500) {
          retryAfter = Number(response.headers.get('retry-after') || '') || undefined
          throw new GenerationError(response.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM',
            `Gemini ${model} HTTP ${response.status}`, true)
        }
        if (!response.ok) {
          const detail = (await response.text().catch(() => '')).slice(0, 300)
          throw new GenerationError('UPSTREAM', `Gemini ${model} HTTP ${response.status}: ${detail}`)
        }
        const body = await response.json() as GeminiResponseBody
        if (body.promptFeedback?.blockReason) {
          throw new GenerationError('BLOCKED', `Prompt blocked: ${body.promptFeedback.blockReason}`)
        }
        const candidate = body.candidates?.[0]
        if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
          throw new GenerationError('BLOCKED', `Generation stopped: ${candidate.finishReason}`)
        }
        const raw = candidate?.content?.parts?.map(part => part.text || '').join('') || ''
        if (!raw.trim()) throw new GenerationError('INVALID_JSON', 'Empty model response', true)
        if (containsRefusal(raw.slice(0, 400))) throw new GenerationError('REFUSAL', 'Model refused the request')
        const parsed = safeParseArticleJson(raw)
        if (parsed === null) throw new GenerationError('INVALID_JSON', 'Model returned malformed JSON', true)
        return { value: validate(parsed), model, attempts }
      } catch (error) {
        const normalized = error instanceof GenerationError
          ? error
          : (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
            ? new GenerationError('TIMEOUT', `Gemini ${model} timed out`, true)
            : new GenerationError('UPSTREAM', error instanceof Error ? error.message : String(error), true)
        lastError = normalized
        if (!normalized.retryable) {
          if (normalized.code === 'QUALITY' || normalized.code === 'REFUSAL' || normalized.code === 'BLOCKED') throw normalized
          break
        }
        if (attempt < maxAttempts) await sleep(backoffDelay(attempt, retryAfter))
      }
    }
  }
  throw lastError ?? new GenerationError('UPSTREAM', 'Gemini generation failed')
}

const stringArray = (value: unknown, max: number, maxLength = 200): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
      .map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean)
      .map(item => item.slice(0, maxLength)).slice(0, max)
    : []

const text = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''

const articleSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Korean news headline, 18-70 characters, factual, no clickbait' },
    summary: { type: 'STRING', description: 'Korean lead paragraph answering who/what/when/where, 1-2 sentences' },
    metaDescription: { type: 'STRING', description: 'Korean SEO meta description, 80-155 characters' },
    keyTakeaways: { type: 'ARRAY', items: { type: 'STRING' }, description: '3-4 Korean bullet facts taken from the source' },
    content: { type: 'STRING', description: 'Korean markdown body with at least three "## " subheadings, 1500-1900 characters of prose' },
    category: { type: 'STRING', enum: [...ARTICLE_CATEGORIES] },
    tags: { type: 'ARRAY', items: { type: 'STRING' }, description: '3-6 short Korean or proper-noun topic tags' },
    claims: { type: 'ARRAY', items: { type: 'STRING' }, description: '2-3 checkable factual claims stated in the source' },
  },
  required: ['title', 'summary', 'metaDescription', 'keyTakeaways', 'content', 'category', 'tags', 'claims'],
  propertyOrdering: ['title', 'summary', 'metaDescription', 'keyTakeaways', 'content', 'category', 'tags', 'claims'],
}

export function parseGeminiArticle(value: unknown): GeminiArticle {
  if (!value || typeof value !== 'object') throw new GenerationError('INVALID_JSON', 'Response is not an object', true)
  const input = value as Record<string, unknown>
  const article: GeminiArticle = {
    title: text(input.title, 180),
    summary: text(input.summary, 500),
    metaDescription: text(input.metaDescription, 200),
    keyTakeaways: stringArray(input.keyTakeaways, 4, 220),
    // Generated bodies must not carry links or images; the pipeline attaches media itself.
    content: text(input.content, 12_000)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, '$1')
      .replace(/\n{3,}/g, '\n\n'),
    category: (ARTICLE_CATEGORIES as readonly string[]).includes(String(input.category)) ? String(input.category) : 'major',
    tags: stringArray(input.tags, 6, 40),
    claims: stringArray(input.claims, 3, 300),
  }
  if (!article.title || !article.summary || !article.content) {
    throw new GenerationError('INVALID_JSON', 'Required article fields are empty', true)
  }
  return article
}

export interface SourceMaterial {
  title: string
  text: string
  sourceName: string
  sourceUrl: string
  publishedAt?: string
  preferredCategory?: string
}

export function buildArticlePrompt(source: SourceMaterial, feedback = ''): string {
  return `당신은 여행 전문 디지털 언론사의 데스크 기자입니다. 아래 "원천 자료"만을 근거로 한국어 스트레이트 뉴스 기사를 작성하세요.

[원천 자료]
- 출처: ${source.sourceName}
- 원문 URL: ${source.sourceUrl}
- 원문 발행일: ${source.publishedAt || '미상'}
- 원문 제목: ${source.title}
"""
${source.text.slice(0, 6000)}
"""

[작성 규칙 — 반드시 준수]
1. 사실성: 원천 자료에 있는 사실만 사용하세요. 자료에 없는 수치·날짜·인명·인용문·정책을 만들어내지 마세요. 불확실한 부분은 "출처에 따르면" 등으로 귀속하세요.
2. 표절 금지: 원문 문장을 그대로 옮기지 말고 독자적인 문장 구조로 재구성하세요. 직접 인용은 20자 이내로만 허용합니다.
3. 헤드라인: 사실과 영향 중심, 18~70자, 과장·낚시성 표현 금지.
4. 리드(summary): 첫 1~2문장에 핵심(누가·무엇을·언제·어디서)을 담으세요.
5. 본문(content): 마크다운. "## " 소제목 3개 이상(예: 핵심 내용 / 배경과 업계 영향 / 여행자가 확인할 점). 이미지·링크·표·HTML 금지. 순수 본문(공백 포함) 1,500~1,900자. 배경·쟁점·영향은 원천 자료가 뒷받침하는 범위에서만 서술하세요.
6. keyTakeaways: 원천 자료에서 확인되는 핵심 사실 3~4개(각 80자 이내).
7. metaDescription: 검색 결과용 80~155자 요약.
8. tags: 3~6개 (도시·국가·기관·주제).
9. claims: 독자가 원문에서 검증할 수 있는 사실 명제 2~3개.
9-1. 외국 고유명사(항공사·공항·도시·기관·인명)는 국내 주요 언론의 표준 표기(국립국어원 외래어 표기법)를 따르세요. 예: Qantas → 콴타스항공, Iberia → 이베리아항공. 확신이 없으면 첫 언급에 원어를 괄호로 병기하세요.
10. 상투어 금지: "알아보겠습니다", "주목받고 있습니다", "결론적으로", "행복한 여행" 등.
11. 원천 자료가 기사로 쓸 만한 정보를 담고 있지 않다면 content를 빈 문자열로 반환하세요.
${source.preferredCategory ? `12. 카테고리는 "${source.preferredCategory}"를 우선 고려하세요.` : ''}
${feedback ? `\n[이전 시도 피드백]\n${feedback}` : ''}`
}

export async function generateArticleFromSource(runtime: GeminiRuntime, source: SourceMaterial, feedback = '') {
  return callGeminiJson(runtime, buildArticlePrompt(source, feedback), articleSchema, parseGeminiArticle)
}

const translationSchema = {
  type: 'OBJECT',
  properties: Object.fromEntries(GENERATION_LANGS.map(lang => [lang, {
    type: 'OBJECT',
    properties: { title: { type: 'STRING' }, summary: { type: 'STRING' }, content: { type: 'STRING' } },
    required: ['title', 'summary', 'content'],
  }])),
  required: [...GENERATION_LANGS],
}

export function parseTranslations(value: unknown): Partial<Record<GenerationLang, GeminiTranslation>> {
  if (!value || typeof value !== 'object') throw new GenerationError('INVALID_JSON', 'Translation response is not an object', true)
  const out: Partial<Record<GenerationLang, GeminiTranslation>> = {}
  for (const lang of GENERATION_LANGS) {
    const entry = (value as Record<string, unknown>)[lang] as Record<string, unknown> | undefined
    const translation = {
      title: text(entry?.title, 220),
      summary: text(entry?.summary, 700),
      content: text(entry?.content, 16_000),
    }
    const combined = `${translation.title}\n${translation.content}`
    if (translation.title && translation.content.length >= 200 && !containsRefusal(combined) && !containsGenerationArtifact(combined)) {
      out[lang] = translation
    }
  }
  return out
}

export async function translateArticle(runtime: GeminiRuntime, article: { title: string; summary: string; content: string }) {
  const prompt = `Translate the following Korean travel news article into English (en), Japanese (ja), Simplified Chinese (zh), Thai (th), Vietnamese (vi) and Spanish (es). Write each version in the native register of that market's major newspapers.
Keep the markdown structure exactly: keep every "## " heading and every image line "![...](...)" unchanged in position (translate only the alt text).
Use the neutral register of a major wire service. Do not add facts, opinions or links.

TITLE: ${article.title}
SUMMARY: ${article.summary}
CONTENT:
${article.content}`
  return callGeminiJson(runtime, prompt, translationSchema, parseTranslations)
}
