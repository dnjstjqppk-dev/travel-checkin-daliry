// checkin-daily/frontend/server/utils/ssrf-guard.ts
import { createError } from 'h3'

function isPrivateIp(ip: string): boolean {
  // IPv4 check
  const ipv4Parts = ip.split('.').map(Number)
  if (ipv4Parts.length === 4 && ipv4Parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [b0 = 0, b1 = 0] = ipv4Parts
    // 0.0.0.0/8
    if (b0 === 0) return true
    // 10.0.0.0/8
    if (b0 === 10) return true
    // 127.0.0.0/8
    if (b0 === 127) return true
    // 169.254.0.0/16 (Link-local / Cloud metadata: 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true
    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true
    // 192.168.0.0/16
    if (b0 === 192 && b1 === 168) return true
    // 100.64.0.0/10
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true
    return false
  }

  // IPv6 check
  const cleanIpv6 = ip.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    cleanIpv6 === '::1' ||
    cleanIpv6 === '::' ||
    cleanIpv6.startsWith('fe80:') ||
    cleanIpv6.startsWith('fc00:') ||
    cleanIpv6.startsWith('fd00:')
  ) {
    return true
  }

  return false
}

export function assertSafeExternalUrl(rawUrl: string): URL {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL provided' })
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Malformed URL' })
  }

  // 1. Enforce HTTPS protocol strictly
  if (parsed.protocol !== 'https:') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only secure HTTPS protocol is allowed for external endpoints',
    })
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '')
  if (parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) {
    throw createError({ statusCode: 400, statusMessage: 'Credentials and custom ports forbidden' })
  }
  // News providers must use a public DNS name. Block every IP literal, including IPv4-mapped IPv6.
  if (hostname.includes(':') || /^[0-9.]+$/.test(hostname) || !hostname.includes('.')) {
    throw createError({ statusCode: 400, statusMessage: 'A public provider DNS name is required' })
  }

  // 2. Reject localhost and local domain aliases
  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan')
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Local/Internal hostname forbidden' })
  }

  // 3. Reject direct private or cloud metadata IP addresses
  if (isPrivateIp(hostname)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Private network and metadata IP addresses forbidden (SSRF protection)',
    })
  }

  return parsed
}

