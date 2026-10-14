import { defineNitroPlugin } from 'nitropack/runtime'
import { getWorkerEnvironment } from '../utils/d1'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    try {
      const env = getWorkerEnvironment(event)
      if (env?.DB) {
        ;(globalThis as any).__cf_db = env.DB
      }
    } catch {
      // Ignore in development or test
    }
  })
})

