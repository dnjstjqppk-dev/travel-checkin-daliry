// checkin-daily/frontend/utils/article-validator.ts
// Shared Article Body Text and Image Validation Module for Check-in Daily
// Enforces:
// 1. Body Text Length: strictly between 800 and 2,000 characters (excluding markdown symbols, images, and HTML)
// 2. Body Image Count: strictly between 4 and 10 images (excluding representative cover image, corrupted URLs, and duplicate URLs)

export interface ExtractedImage {
  url: string
  alt: string
  caption?: string
}

export interface ArticleValidationResult {
  valid: boolean
  textLength: number
  imageCount: number
  isTextLengthValid: boolean
  isImageCountValid: boolean
  images: ExtractedImage[]
  errors: string[]
  details: {
    minChars: number
    maxChars: number
    minImages: number
    maxImages: number
    charDifference: number // negative if deficient, positive if exceeded, 0 if within range
    imageDifference: number // negative if deficient, positive if exceeded, 0 if within range
  }
}

export const ARTICLE_RULES = {
  MIN_BODY_CHARS: 800,
  MAX_BODY_CHARS: 2000,
  MIN_BODY_IMAGES: 4,
  MAX_BODY_IMAGES: 10,
} as const

/**
 * Extracts plain readable text from Markdown body by stripping formatting tokens,
 * images, HTML tags, and code blocks, while retaining link anchor text.
 */
export function extractBodyPlainText(markdown: string): string {
  if (!markdown) return ''
  let text = markdown

  // 1. Remove markdown code blocks ```...```
  text = text.replace(/```[\s\S]*?```/g, '')

  // 2. Remove markdown images: ![alt](url "title") or ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '')

  // 3. Remove HTML image tags: <img ... />
  text = text.replace(/<img\b[^>]*>/gi, '')

  // 4. Transform markdown links: [link text](url) -> link text (retaining visible text, stripping URL)
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')

  // 5. Remove any HTML tags: <tag ...> or </tag>
  text = text.replace(/<\/?[^>]+(>|$)/g, '')

  // 6. Remove headings markers (#, ##, etc.) at line starts
  text = text.replace(/^#{1,6}\s+/gm, '')

  // 7. Remove blockquote markers (> ) at line starts
  text = text.replace(/^>\s*/gm, '')

  // 8. Remove unordered list markers (- , * , + ) at line starts
  text = text.replace(/^[\t ]*[-*+]\s+/gm, '')

  // 9. Remove ordered list markers (1. , 2. ) at line starts
  text = text.replace(/^[\t ]*\d+\.\s+/gm, '')

  // 10. Remove horizontal rules (---, ***, ___)
  text = text.replace(/^[\t ]*[-*_]{3,}[\t ]*$/gm, '')

  // 11. Remove emphasis and strikethrough markers: **bold**, *italic*, __bold__, _italic_, ~~strike~~
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')
  text = text.replace(/(\*|_)(.*?)\1/g, '$2')
  text = text.replace(/~~(.*?)~~/g, '$1')

  // 12. Remove inline code backticks: `code` -> code
  text = text.replace(/`([^`]+)`/g, '$1')

  // 13. Remove markdown footnote references: [^1]
  text = text.replace(/\[\^[^\]]+\]/g, '')

  // 14. Normalize whitespace: collapse multiple spaces, tabs, and newlines into a single space
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

/**
 * Calculates the exact character count of the body text (excluding formatting).
 * Uses unicode-aware spread operator to count surrogate pairs/emojis accurately.
 */
export function calculateBodyTextLength(markdown: string): number {
  const plainText = extractBodyPlainText(markdown)
  return [...plainText].length
}

/**
 * Validates whether an image URL is a legitimate, non-temporary image URL.
 */
function isValidImageUrl(url: string, normCoverImage: string): boolean {
  if (!url || url.length < 5) return false
  const cleanUrl = url.trim().toLowerCase()

  // Reject temporary memory blob URLs and unsafe schemes
  if (cleanUrl.startsWith('blob:') || cleanUrl.startsWith('javascript:') || cleanUrl.startsWith('data:')) {
    return false
  }

  // Exclude representative cover image from body image count
  if (normCoverImage && cleanUrl === normCoverImage) {
    return false
  }

  // Must start with http://, https://, /api/media/, or valid relative path
  if (/^(https?:\/\/|\/api\/media\/|\/images\/|\/assets\/)/i.test(cleanUrl)) {
    return true
  }

  return false
}

/**
 * Safely extracts all valid, unique body images from Markdown and HTML within the content.
 * Representative cover image is explicitly excluded from the result.
 * Duplicate image URLs within the body are deduplicated according to editorial integrity policy.
 */
export function extractBodyImages(markdown: string, coverImageUrl?: string): ExtractedImage[] {
  if (!markdown) return []
  const images: ExtractedImage[] = []
  const seenUrls = new Set<string>()

  const normCover = (coverImageUrl || '').trim().toLowerCase()

  // 1. Match Markdown images: ![alt](url "title")
  const mdImgRegex = /!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+["']([^"']*)["'])?\s*\)/g
  let match: RegExpExecArray | null
  while ((match = mdImgRegex.exec(markdown)) !== null) {
    const alt = (match[1] || '').trim()
    const url = (match[2] || '').trim()
    const title = (match[3] || '').trim()

    if (isValidImageUrl(url, normCover)) {
      const lower = url.toLowerCase()
      if (!seenUrls.has(lower)) {
        seenUrls.add(lower)
        images.push({ url, alt, caption: title })
      }
    }
  }

  // 2. Match HTML images: <img ... src="..." ...>
  const htmlImgRegex = /<img\b[^>]*>/gi
  while ((match = htmlImgRegex.exec(markdown)) !== null) {
    const tag = match[0]
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i)
    if (srcMatch && srcMatch[1]) {
      const url = srcMatch[1].trim()
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i)
      const alt = (altMatch && altMatch[1]) ? altMatch[1].trim() : ''
      const titleMatch = tag.match(/\btitle=["']([^"']*)["']/i)
      const caption = (titleMatch && titleMatch[1]) ? titleMatch[1].trim() : ''

      if (isValidImageUrl(url, normCover)) {
        const lower = url.toLowerCase()
        if (!seenUrls.has(lower)) {
          seenUrls.add(lower)
          images.push({ url, alt, caption })
        }
      }
    }
  }

  return images
}

/**
 * Validates an article for public publishing against editorial standards.
 * - Text length must be between 800 and 2,000 characters (inclusive).
 * - Body images must be between 4 and 10 images (inclusive).
 */
export function validateArticleForPublish(params: {
  content: string
  coverImage?: string
}): ArticleValidationResult {
  const content = params.content || ''
  const coverImage = params.coverImage || ''

  const textLength = calculateBodyTextLength(content)
  const images = extractBodyImages(content, coverImage)
  const imageCount = images.length

  const isTextLengthValid = textLength >= ARTICLE_RULES.MIN_BODY_CHARS && textLength <= ARTICLE_RULES.MAX_BODY_CHARS
  const isImageCountValid = imageCount >= ARTICLE_RULES.MIN_BODY_IMAGES && imageCount <= ARTICLE_RULES.MAX_BODY_IMAGES

  const errors: string[] = []

  let charDiff = 0
  if (textLength < ARTICLE_RULES.MIN_BODY_CHARS) {
    charDiff = textLength - ARTICLE_RULES.MIN_BODY_CHARS
    errors.push(
      `본문 텍스트가 부족합니다. 최소 ${ARTICLE_RULES.MIN_BODY_CHARS}자 이상이어야 합니다. (현재 ${textLength}자, ${Math.abs(charDiff)}자 부족)`
    )
  } else if (textLength > ARTICLE_RULES.MAX_BODY_CHARS) {
    charDiff = textLength - ARTICLE_RULES.MAX_BODY_CHARS
    errors.push(
      `본문 텍스트가 초과되었습니다. 최대 ${ARTICLE_RULES.MAX_BODY_CHARS}자 이하여야 합니다. (현재 ${textLength}자, ${charDiff}자 초과)`
    )
  }

  let imgDiff = 0
  if (imageCount < ARTICLE_RULES.MIN_BODY_IMAGES) {
    imgDiff = imageCount - ARTICLE_RULES.MIN_BODY_IMAGES
    errors.push(
      `본문 이미지가 부족합니다. 최소 ${ARTICLE_RULES.MIN_BODY_IMAGES}장 이상 포함되어야 합니다. (현재 ${imageCount}장, ${Math.abs(imgDiff)}장 부족)`
    )
  } else if (imageCount > ARTICLE_RULES.MAX_BODY_IMAGES) {
    imgDiff = imageCount - ARTICLE_RULES.MAX_BODY_IMAGES
    errors.push(
      `본문 이미지가 초과되었습니다. 최대 ${ARTICLE_RULES.MAX_BODY_IMAGES}장까지 허용됩니다. (현재 ${imageCount}장, ${imgDiff}장 초과)`
    )
  }

  return {
    valid: isTextLengthValid && isImageCountValid,
    textLength,
    imageCount,
    isTextLengthValid,
    isImageCountValid,
    images,
    errors,
    details: {
      minChars: ARTICLE_RULES.MIN_BODY_CHARS,
      maxChars: ARTICLE_RULES.MAX_BODY_CHARS,
      minImages: ARTICLE_RULES.MIN_BODY_IMAGES,
      maxImages: ARTICLE_RULES.MAX_BODY_IMAGES,
      charDifference: charDiff,
      imageDifference: imgDiff,
    },
  }
}

