// checkin-daily/frontend/server/api/push/public-key.get.ts
import { defineEventHandler } from 'h3'
import { getD1Database, getWorkerEnvironment } from '../../utils/d1'
import { getVapidConfig } from '../../utils/web-push'

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  const env = getWorkerEnvironment(event) as Record<string, unknown> | undefined

  const config = await getVapidConfig(database, env)

  return {
    success: true,
    publicKey: config.publicKey,
  }
})

