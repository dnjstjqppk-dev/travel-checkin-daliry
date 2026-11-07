// Single source of truth for supported reader locales.
// 'ko' is the default (unprefixed) locale; every other locale is served under /{code}/...
export const LOCALES = ['ko', 'en', 'ja', 'zh', 'th', 'vi', 'es'] as const
export type LocaleCode = typeof LOCALES[number]

export const PREFIXED_LOCALES = LOCALES.filter(code => code !== 'ko') as Exclude<LocaleCode, 'ko'>[]

export const HREFLANG: Record<LocaleCode, string> = {
  ko: 'ko', en: 'en', ja: 'ja', zh: 'zh-Hans', th: 'th', vi: 'vi', es: 'es',
}

export function isPrefixedLocale(value: unknown): value is Exclude<LocaleCode, 'ko'> {
  return typeof value === 'string' && (PREFIXED_LOCALES as string[]).includes(value)
}

/** Matches a leading locale prefix in a path, e.g. "/ja/news" -> "ja". */
export const LOCALE_PREFIX_PATTERN = new RegExp(`^/(${PREFIXED_LOCALES.join('|')})(?=/|$)`)
