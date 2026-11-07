// Serves the IndexNow ownership file at exactly /{INDEXNOW_KEY}.txt.
// Implemented as middleware (not a dynamic /[key].txt route) so it can never
// shadow other single-segment pages such as /about or /policy.
import { defineEventHandler, getRequestURL, setResponseHeader } from 'h3'
import { configuredIndexNowKey } from '../utils/indexing-api'

const KEY_FILE = /^\/([A-Za-z0-9-]{8,128})\.txt$/

export default defineEventHandler((event) => {
  const match = KEY_FILE.exec(getRequestURL(event).pathname)
  if (!match) return
  const key = configuredIndexNowKey()
  if (!key || match[1] !== key) return
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  return key
})
