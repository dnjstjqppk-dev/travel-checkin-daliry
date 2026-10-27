import { defineNitroPlugin } from 'nitropack/runtime'
import { executeCronTasks } from '../utils/cron-runner'

export default defineNitroPlugin((nitroApp) => {
  // Listen to Cloudflare Workers scheduled cron trigger hook if supported by Nitro runtime
  // @ts-ignore
  nitroApp.hooks?.hook?.('cloudflare:scheduled', async ({ env }: { env: any }) => {
    try {
      if (env?.DB) {
        await executeCronTasks(env.DB)
      }
    } catch (err) {
      console.error('[ScheduledHook] Error executing scheduled task:', err)
    }
  })
})

