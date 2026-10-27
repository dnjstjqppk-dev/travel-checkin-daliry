import { createError, defineEventHandler, readBody, getRequestHeader } from 'h3'
import { d1Run, d1First, getD1Database } from '../../utils/d1'

async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })

  // 1. IP-based rate limiting (Max 5 partner submissions per 10 minutes)
  const ip = getRequestHeader(event, 'cf-connecting-ip')
    || getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || '127.0.0.1'
  const ipHash = await sha256(`partner_sub_${ip}`)
  const nowSec = Math.floor(Date.now() / 1000)

  try {
    const existingLimit = await d1First<{ count: number; expires_at: number }>(
      database,
      'SELECT count, expires_at FROM rate_limits WHERE key = ?',
      ipHash,
    )

    if (existingLimit && existingLimit.expires_at > nowSec && existingLimit.count >= 5) {
      throw createError({
        statusCode: 429,
        statusMessage: '보도자료 접수 요청이 너무 많습니다. 잠시 후(최대 10분) 다시 시도해 주세요.',
      })
    }

    if (!existingLimit || existingLimit.expires_at <= nowSec) {
      await d1Run(
        database,
        'INSERT OR REPLACE INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)',
        ipHash,
        nowSec + 600,
      )
    } else {
      await d1Run(
        database,
        'UPDATE rate_limits SET count = count + 1 WHERE key = ?',
        ipHash,
      )
    }
  } catch (err: any) {
    if (err?.statusCode === 429) throw err
  }

  // 2. Read and validate body
  const body = await readBody(event)
  const {
    orgId,
    submitterName,
    submitterEmail,
    title,
    category,
    summary,
    content,
    sourceUrl,
    copyrightProof,
  } = body || {}

  if (!title || !content || !submitterEmail) {
    throw createError({
      statusCode: 400,
      statusMessage: '제목, 본문, 담당자 이메일은 필수 입력 항목입니다.',
    })
  }

  const cleanEmail = String(submitterEmail).trim().toLowerCase()
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    throw createError({
      statusCode: 400,
      statusMessage: '유효한 이메일 주소를 입력해 주세요.',
    })
  }

  const cleanTitle = String(title).trim()
  const cleanContent = String(content).trim()
  const cleanName = String(submitterName || '익명 기고가').trim()
  const cleanOrgId = orgId ? String(orgId).trim() : null
  const cleanCat = String(category || 'airline').trim()
  const cleanSummary = String(summary || '').trim()
  const cleanSourceUrl = String(sourceUrl || '').trim()
  const cleanCopyright = String(copyrightProof || '').trim()
  const now = new Date().toISOString()

  // 3. Insert into contributor_submissions
  await d1Run(
    database,
    `INSERT INTO contributor_submissions (
      org_id, submitter_name, submitter_email, title, summary,
      content, category, source_url, copyright_proof, status,
      editorial_feedback, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', '편집국 접수 완료 (사실 검증 대기 중)', ?, ?)`,
    cleanOrgId,
    cleanName,
    cleanEmail,
    cleanTitle,
    cleanSummary,
    cleanContent,
    cleanCat,
    cleanSourceUrl,
    cleanCopyright,
    now,
    now,
  )

  const inserted = await d1First<{ id: number }>(
    database,
    'SELECT id FROM contributor_submissions WHERE submitter_email = ? ORDER BY id DESC LIMIT 1',
    cleanEmail,
  )

  const submissionId = inserted?.id || Date.now()

  // 4. Audit log
  await d1Run(
    database,
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_resource, details_json) VALUES (?, ?, ?, ?, ?)',
    'partner',
    cleanEmail,
    'partner_submission_created',
    `submission:${submissionId}`,
    JSON.stringify({ id: submissionId, title: cleanTitle, category: cleanCat, orgId: cleanOrgId }),
  )

  return {
    success: true,
    message: '보도자료가 편집국에 성공적으로 접수되었습니다. 사실 확인 후 다국어 기사로 정식 배포됩니다.',
    submission: {
      id: submissionId,
      title: cleanTitle,
      category: cleanCat,
      status: 'submitted',
      submitterName: cleanName,
      createdAt: now.split('T')[0],
      editorialFeedback: '편집국 접수 완료 (사실 검증 대기 중)',
    },
  }
})

