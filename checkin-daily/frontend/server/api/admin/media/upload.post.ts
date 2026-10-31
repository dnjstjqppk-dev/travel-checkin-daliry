import {
  createError,
  defineEventHandler,
  getRequestHeader,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import { getD1Database, d1Run } from '../../../utils/d1'
import { authenticateAdmin, isSameOriginRequest } from '../../../utils/d1-auth'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

interface UploadItem {
  filename: string
  mimeType: string
  base64Data: string
  altText?: string
  caption?: string
}

/**
 * Validates file signature (magic bytes) from raw Buffer
 */
function verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false

  // JPEG: FF D8 FF
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    )
  }

  // GIF: 47 49 46 38 (GIF87a or GIF89a)
  if (mimeType === 'image/gif') {
    return (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    )
  }

  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (mimeType === 'image/webp') {
    return (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    )
  }

  // AVIF: ftypavif or ftypavis
  if (mimeType === 'image/avif') {
    const headerStr = buffer.slice(4, 12).toString('ascii')
    return headerStr.includes('ftyp')
  }

  return false
}

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database binding not available' })
  }

  // 1. Authenticate Admin
  const session = await authenticateAdmin(event, database)
  if (!session.identity) {
    throw createError({ statusCode: 401, statusMessage: 'Admin authentication required' })
  }

  // 2. Same-Origin & CSRF Check
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden request origin' })
  }

  // 3. Read Body
  const body = await readBody(event)
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'No upload payload provided' })
  }

  // Payload can be a single item or an array of items for multi-file upload
  const items: UploadItem[] = Array.isArray(body.files)
    ? body.files
    : [
        {
          filename: body.filename || 'image.jpg',
          mimeType: body.mimeType || 'image/jpeg',
          base64Data: body.base64Data || body.data || '',
          altText: body.altText || '',
          caption: body.caption || '',
        },
      ]

  if (!items.length) {
    throw createError({ statusCode: 400, statusMessage: 'Empty files payload' })
  }

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
  const uploadedResults = []

  for (const item of items) {
    const mime = (item.mimeType || '').toLowerCase()
    if (!allowedMimes.includes(mime)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unsupported image MIME type: ${mime}. Allowed: JPEG, PNG, WebP, GIF, AVIF.`,
      })
    }

    // Strip data URI scheme prefix if present (e.g. data:image/png;base64,...)
    let cleanBase64 = item.base64Data || ''
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1] || ''
    }

    if (!cleanBase64) {
      throw createError({ statusCode: 400, statusMessage: 'Missing image binary data' })
    }

    const buffer = Buffer.from(cleanBase64, 'base64')
    if (buffer.length > MAX_FILE_SIZE) {
      throw createError({
        statusCode: 413,
        statusMessage: `File ${item.filename} exceeds maximum size of 5MB (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`,
      })
    }

    // Validate file magic bytes signature
    if (!verifyMagicBytes(buffer, mime)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Security verification failed: File signature does not match declared MIME type ${mime}.`,
      })
    }

    // Check Cloudflare R2 bucket binding if configured
    const cfEnv = event.context._platform?.cloudflare?.env || event.context.cloudflare?.env || {}
    const r2Bucket = (cfEnv.IMAGES_BUCKET || cfEnv.R2_IMAGES || cfEnv.MEDIA_BUCKET || cfEnv.R2_BUCKET) as any

    // D1 SQL Statement Byte Limit Protection (1.5MB)
    const SAFE_D1_SIZE_BYTES = 1.5 * 1024 * 1024
    if (!r2Bucket && buffer.length > SAFE_D1_SIZE_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: `D1 스토리지 한도(1.5MB)를 초과했습니다 (${(buffer.length / 1024 / 1024).toFixed(2)}MB). 클라이언트 WebP 압축 파이프라인을 사용해 주세요.`,
      })
    }

    // Generate secure ID
    const randomHex = Math.random().toString(36).substring(2, 10)
    const assetId = `img_${Date.now()}_${randomHex}`
    const safeFilename = (item.filename || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const altText = (item.altText || '').slice(0, 200)
    const caption = (item.caption || '').slice(0, 200)

    const isR2Active = Boolean(r2Bucket && typeof r2Bucket.put === 'function')
    if (isR2Active) {
      // Store in Cloudflare R2
      await r2Bucket.put(assetId, buffer, {
        httpMetadata: { contentType: mime },
        customMetadata: { filename: safeFilename, uploadedBy: session.identity.username },
      })
    }

    // Store record in media_assets (if R2 is active, record 'R2_STORED' marker to prevent D1 duplicate bloat)
    const storedBase64 = isR2Active ? 'R2_STORED' : cleanBase64
    await d1Run(
      database,
      `INSERT INTO media_assets (id, filename, mime_type, size_bytes, data_base64, alt_text, caption, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      assetId,
      safeFilename,
      mime,
      buffer.length,
      storedBase64,
      altText,
      caption,
      session.identity.username
    )

    uploadedResults.push({
      id: assetId,
      filename: safeFilename,
      url: `/api/media/${assetId}`,
      mimeType: mime,
      sizeBytes: buffer.length,
      altText,
      caption,
    })
  }

  setResponseStatus(event, 201)
  return {
    success: true,
    count: uploadedResults.length,
    assets: uploadedResults,
    // Return primary asset for single upload convenience
    asset: uploadedResults[0],
    url: uploadedResults[0]?.url,
  }
})
