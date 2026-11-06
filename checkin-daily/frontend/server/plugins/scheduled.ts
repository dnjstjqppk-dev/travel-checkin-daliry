import { defineNitroPlugin } from 'nitropack/runtime'
import { executeCronTasks } from '../utils/cron-runner'

interface ScheduledHookPayload {
  env?: { DB?: unknown } & Record<string, unknown>
}

interface NitroHookCarrier {
  hooks?: {
    hook?: (name: string, fn: (payload: ScheduledHookPayload) => Promise<void> | void) => void
  }
}

export default defineNitroPlugin((nitroApp) => {
  // Listen to Cloudflare Workers scheduled cron trigger hook if supported by Nitro runtime
  const carrier = nitroApp as unknown as NitroHookCarrier
  if (typeof carrier.hooks?.hook !== 'function') {
    console.warn('[ScheduledHook] Nitro hook carrier unavailable — cron tasks will not run in this runtime')
    return
  }
  console.info('[ScheduledHook] cloudflare:scheduled cron hook registered')
  carrier.hooks.hook('cloudflare:scheduled', async ({ env }: ScheduledHookPayload) => {
    try {
      if (env?.DB) {
        await executeCronTasks(env.DB as Parameters<typeof executeCronTasks>[0])
      } else {
        console.warn('[ScheduledHook] Scheduled trigger fired without D1 binding — skipping cron tasks')
      }
    } catch (err) {
      console.error('[ScheduledHook] Error executing scheduled task:', err)
    }
  })
})
