import { siteConfig } from '~/config/site.config'

/**
 * Canonical origin for links, canonical tags and structured data.
 * Uses the configured public site URL so preview hosts (workers.dev, localhost)
 * never become canonical once a custom domain is bound.
 */
export function useSiteDomain() {
  const config = useRuntimeConfig()
  const reqUrl = useRequestURL()

  const origin = computed(() => {
    const configured = String(config.public?.siteUrl || '').trim().replace(/\/+$/, '')
    if (configured) return configured
    if (reqUrl.origin && reqUrl.origin !== 'null') return reqUrl.origin.replace(/\/+$/, '')
    return siteConfig.domain
  })

  function canonicalUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${origin.value}${cleanPath}`
  }

  return { origin, canonicalUrl }
}
