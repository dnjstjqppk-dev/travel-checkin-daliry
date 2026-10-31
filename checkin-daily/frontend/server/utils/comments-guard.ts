// checkin-daily/frontend/server/utils/comments-guard.ts
// Comment moderation, password hashing, IP pseudonymization & tree builder

export interface RawCommentRow {
  id: number
  article_id: number
  parent_id: number | null
  author_name: string
  author_email: string | null
  password_hash: string | null
  content: string
  status: string
  like_count: number
  created_at: string
  updated_at: string
}

export interface PublicComment {
  id: number
  articleId: number
  parentId: number | null
  authorName: string
  content: string
  likeCount: number
  createdAt: string
  replies: PublicComment[]
}

const ABUSE_KEYWORDS = [
  '바카라', '카지노', '토토', '성인용품', '조건만남', '출장샵', '대출상담',
  'fuck', 'shit', 'nigger', 'viagra', 'porn'
]

/**
 * Hash IP address with salt to preserve privacy (GDPR / PIPA compliance)
 */
export async function hashIp(ip: string): Promise<string> {
  const salt = 'checkin-daily-ip-salt-2026'
  const encoder = new TextEncoder()
  const data = encoder.encode(`${ip}:${salt}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

/**
 * Hash password for commenter self-deletion verification
 */
export async function hashCommentPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password.trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify commenter password against stored hash
 */
export async function verifyCommentPassword(password: string, expectedHash: string): Promise<boolean> {
  const hash = await hashCommentPassword(password)
  return hash === expectedHash
}

/**
 * Check if content contains banned spam/abuse keywords
 */
export function containsAbuseKeywords(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[\s\-_]+/g, '')
  return ABUSE_KEYWORDS.some((kw) => normalized.includes(kw))
}

/**
 * Build 2-level comment hierarchy (parents and child replies)
 */
export function buildCommentTree(rows: RawCommentRow[]): PublicComment[] {
  const map = new Map<number, PublicComment>()
  const rootComments: PublicComment[] = []

  for (const r of rows) {
    const item: PublicComment = {
      id: r.id,
      articleId: r.article_id,
      parentId: r.parent_id,
      authorName: r.author_name,
      content: r.status === 'deleted' ? '작성자 또는 관리자에 의해 삭제된 댓글입니다.' : r.content,
      likeCount: r.like_count || 0,
      createdAt: r.created_at,
      replies: [],
    }
    map.set(item.id, item)
  }

  for (const item of map.values()) {
    if (item.parentId && map.has(item.parentId)) {
      const parent = map.get(item.parentId)!
      parent.replies.push(item)
    } else {
      rootComments.push(item)
    }
  }

  return rootComments
}
