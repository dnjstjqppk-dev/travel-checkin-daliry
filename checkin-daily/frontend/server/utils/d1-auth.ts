import { canAccessStaff, isStaffRole, type StaffRole } from './staff-permissions'
import type { H3Event } from 'h3'
import { createError, deleteCookie, getCookie, getRequestHeader, getRequestURL, setCookie } from 'h3'
import { d1First, d1Run, type D1Database } from './d1'

export const adminCookieName = 'checkin_admin_session'
export const adminSessionTtlSeconds = 8 * 60 * 60
const loginWindowSeconds = 15 * 60
const loginMaxAttempts = 5
const passwordIterations = 100_000

interface AdminAccount {
  id: number
  username: string
  password_hash: string
  role: string
  is_active: number
}

export interface AdminIdentity {
  id: number
  username: string
  role: StaffRole
}

interface LoginAttempt {
  attempt_count: number
  expires_at: number
}

export function isSameOriginRequest(event: H3Event): boolean {
  const origin = getRequestHeader(event, 'origin')
  if (!origin || origin.replace(/\/$/, '') !== getRequestURL(event).origin) {
    return false
  }
  return getRequestHeader(event, 'sec-fetch-site')?.toLowerCase() !== 'cross-site'
}

export async function isLoginBlocked(event: H3Event, database: D1Database): Promise<boolean> {
  const attempt = await readLoginAttempt(event, database)
  return attempt !== null && attempt.expires_at > nowSeconds() && attempt.attempt_count >= loginMaxAttempts
}

export async function recordFailedLogin(event: H3Event, database: D1Database): Promise<void> {
  const ipHash = await requestIpHash(event)
  const now = nowSeconds()
  await d1Run(
    database,
    `INSERT INTO login_attempts (ip_hash, attempt_count, expires_at)
     VALUES (?, 1, ?)
     ON CONFLICT(ip_hash) DO UPDATE SET
       attempt_count = CASE WHEN login_attempts.expires_at <= ? THEN 1 ELSE login_attempts.attempt_count + 1 END,
       expires_at = CASE WHEN login_attempts.expires_at <= ? THEN ? ELSE login_attempts.expires_at END`,
    ipHash,
    now + loginWindowSeconds,
    now,
    now,
    now + loginWindowSeconds,
  )
}

export async function clearLoginAttempts(event: H3Event, database: D1Database): Promise<void> {
  await d1Run(database, 'DELETE FROM login_attempts WHERE ip_hash = ?', await requestIpHash(event))
}

export async function findAdminAccount(database: D1Database, username: string): Promise<AdminAccount | null> {
  return d1First<AdminAccount>(
    database,
    'SELECT id, username, password_hash, role, is_active FROM admin_accounts WHERE username = ? COLLATE NOCASE AND is_active = 1',
    username.trim(),
  )
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, iterationsText, saltText, hashText] = encodedHash.split('$')
  const iterations = Number(iterationsText)
  if (
    algorithm !== 'pbkdf2-sha256'
    || !Number.isInteger(iterations)
    || iterations < 100_000
    || iterations > 500_000
    || !saltText
    || !hashText
  ) {
    return false
  }
  const expected = decodeBase64Url(hashText)
  const salt = decodeBase64Url(saltText)
  if (!expected || expected.length !== 32 || !salt || salt.length !== 16) return false
  const actual = await derivePassword(password, salt, iterations)
  return constantTimeBytesEqual(actual, expected)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePassword(password, salt, passwordIterations)
  return `pbkdf2-sha256$${passwordIterations}$${encodeBase64Url(salt)}$${encodeBase64Url(hash)}`
}

export async function createAdminSession(
  event: H3Event,
  database: D1Database,
  account: AdminIdentity,
): Promise<void> {
  const token = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const tokenHash = await sha256Hex(token)
  const expiresAt = nowSeconds() + adminSessionTtlSeconds
  await d1Run(database, 'DELETE FROM admin_sessions WHERE expires_at <= ?', nowSeconds())
  await d1Run(
    database,
    'INSERT INTO admin_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)',
    tokenHash,
    account.id,
    expiresAt,
  )
  setCookie(event, adminCookieName, token, {
    path: '/',
    httpOnly: true,
    secure: getRequestURL(event).protocol === 'https:',
    sameSite: 'strict',
    maxAge: adminSessionTtlSeconds,
  })
}

export async function authenticateAdmin(
  event: H3Event,
  database: D1Database,
): Promise<{ identity: AdminIdentity | null; expiresAt?: number; invalidSession: boolean }> {
  const token = getCookie(event, adminCookieName)
  if (!token) return { identity: null, invalidSession: false }

  const session = await d1First<{
    id: number
    username: string
    role: string
    expires_at: number
  }>(
    database,
    `SELECT a.id, a.username, a.role, s.expires_at
     FROM admin_sessions s
     JOIN admin_accounts a ON a.id = s.account_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND a.is_active = 1`,
    await sha256Hex(token),
    nowSeconds(),
  )
  if (!session || !isStaffRole(session.role)) {
    deleteCookie(event, adminCookieName, {
      path: '/',
      httpOnly: true,
      secure: getRequestURL(event).protocol === 'https:',
      sameSite: 'strict',
    })
    return { identity: null, invalidSession: true }
  }
  if (!canAccessStaff(session.role, getRequestURL(event).pathname, event.method)) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient staff permissions' })
  }
  event.context.staffRole = session.role
  return {
    identity: { id: session.id, username: session.username, role: session.role },
    expiresAt: session.expires_at,
    invalidSession: false,
  }
}

export async function deleteAdminSession(event: H3Event, database: D1Database): Promise<void> {
  const token = getCookie(event, adminCookieName)
  if (token) {
    await d1Run(database, 'DELETE FROM admin_sessions WHERE token_hash = ?', await sha256Hex(token))
  }
  deleteCookie(event, adminCookieName, {
    path: '/',
    httpOnly: true,
    secure: getRequestURL(event).protocol === 'https:',
    sameSite: 'strict',
  })
}

export async function storeAdminAccount(
  database: D1Database,
  username: string,
  password: string,
): Promise<void> {
  const passwordHash = await hashPassword(password)
  await d1Run(
    database,
    'INSERT INTO admin_accounts (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
    username.trim().toLowerCase(),
    passwordHash,
    'admin',
  )
}

export function constantTimeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index++) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return difference === 0
}

async function readLoginAttempt(event: H3Event, database: D1Database): Promise<LoginAttempt | null> {
  return d1First<LoginAttempt>(
    database,
    'SELECT attempt_count, expires_at FROM login_attempts WHERE ip_hash = ?',
    await requestIpHash(event),
  )
}

async function requestIpHash(event: H3Event): Promise<string> {
  const ip = getRequestHeader(event, 'cf-connecting-ip') || 'unknown'
  return sha256Hex(ip)
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const saltBuffer = new Uint8Array(salt.length)
  saltBuffer.set(salt)
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer.buffer, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

function constantTimeBytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index++) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return difference === 0
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}
