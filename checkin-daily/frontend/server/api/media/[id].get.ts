import {
  createError,
  defineEventHandler,
  getRouterParam,
  setResponseHeader,
} from 'h3'
import { getD1Database, d1First } from '../../utils/d1'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Asset ID required' })
  }

  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Database not available' })
  }

  const asset = await d1First<{
    id: string
    filename: string
    mime_type: string
    size_bytes: number
    data_base64: string
  }>(
    database,
    'SELECT id, filename, mime_type, size_bytes, data_base64 FROM media_assets WHERE id = ?',
    id
  )

  if (!asset || !asset.data_base64) {
    throw createError({ statusCode: 404, statusMessage: 'Media asset not found' })
  }

  const cfEnv = event.context._platform?.cloudflare?.env || event.context.cloudflare?.env || {}
  const r2Bucket = (cfEnv.IMAGES_BUCKET || cfEnv.R2_IMAGES || cfEnv.MEDIA_BUCKET || cfEnv.R2_BUCKET) as any

  let buffer: Buffer

  if (asset.data_base64 === 'R2_STORED') {
    if (!r2Bucket || typeof r2Bucket.get !== 'function') {
      throw createError({ statusCode: 500, statusMessage: 'R2 storage binding not available for asset retrieval' })
    }
    const r2Obj = await r2Bucket.get(id)
    if (!r2Obj) {
      throw createError({ statusCode: 404, statusMessage: 'Media asset not found in R2' })
    }
    const arrayBuffer = await r2Obj.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
  } else {
    buffer = Buffer.from(asset.data_base64, 'base64')
  }

  setResponseHeader(event, 'Content-Type', asset.mime_type)
  setResponseHeader(event, 'Content-Length', buffer.length)
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'ETag', `"${asset.id}"`)

  return buffer
})

