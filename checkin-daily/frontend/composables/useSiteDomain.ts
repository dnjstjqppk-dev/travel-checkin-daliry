import { siteConfig } from '~/config/site.config'

export function useSiteDomain() {
  const reqUrl = useRequestURL()
  const config = useRuntimeConfig()

  const origin = computed(() => {
    // 1. SSR / Client current origin from request or window
    if (reqUrl.origin && !reqUrl.origin.includes('localhost') && reqUrl.origin !== 'null') {
      return reqUrl.origin.replace(/\/+$/, '')
    }
    // 2. Runtime public siteUrl
    if (config.public?.siteUrl) {
      return String(config.public.siteUrl).replace(/\/+$/, '')
    }
    // 3. Fallback
    return siteConfig.domain.replace(/\/+$/, '')
  })

  function canonicalUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${origin.value}${cleanPath}`
  }

  return {
    origin,
    canonicalUrl,
  }
}

