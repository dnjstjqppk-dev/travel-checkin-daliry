// checkin-daily/frontend/server/utils/text-similarity.ts
// N-gram and Levenshtein similarity algorithm for news clustering and deduplication

export function normalizeTitle(title: string): string {
  if (!title) return ''
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Generate character n-grams from normalized text
 */
export function getNGrams(text: string, n = 2): Set<string> {
  const norm = normalizeTitle(text)
  const ngrams = new Set<string>()
  if (norm.length < n) {
    if (norm.length > 0) ngrams.add(norm)
    return ngrams
  }
  for (let i = 0; i <= norm.length - n; i++) {
    ngrams.add(norm.slice(i, i + n))
  }
  return ngrams
}

/**
 * Jaccard similarity between two n-gram sets
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0
  if (setA.size === 0 || setB.size === 0) return 0.0

  let intersectionSize = 0
  for (const item of setA) {
    if (setB.has(item)) intersectionSize++
  }

  const unionSize = setA.size + setB.size - intersectionSize
  return unionSize > 0 ? intersectionSize / unionSize : 0.0
}

/**
 * Levenshtein distance between two strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length
  const n = s2.length
  if (m === 0) return n
  if (n === 0) return m

  let prevRow = new Array(n + 1)
  let currRow = new Array(n + 1)

  for (let j = 0; j <= n; j++) {
    prevRow[j] = j
  }

  for (let i = 1; i <= m; i++) {
    currRow[0] = i
    const char1 = s1.charCodeAt(i - 1)
    for (let j = 1; j <= n; j++) {
      const cost = char1 === s2.charCodeAt(j - 1) ? 0 : 1
      currRow[j] = Math.min(
        currRow[j - 1] + 1, // insertion
        prevRow[j] + 1, // deletion
        prevRow[j - 1] + cost, // substitution
      )
    }
    const temp = prevRow
    prevRow = currRow
    currRow = temp
  }

  return prevRow[n]
}

/**
 * Compute combined semantic & textual similarity between two headlines (0.0 to 1.0)
 */
export function calculateTitleSimilarity(titleA: string, titleB: string): number {
  const normA = normalizeTitle(titleA)
  const normB = normalizeTitle(titleB)

  if (normA === normB) return 1.0
  if (!normA || !normB) return 0.0

  // 1. Bi-gram (2-gram) character Jaccard similarity (ideal for Korean/East Asian syllables)
  const biGramsA = getNGrams(normA, 2)
  const biGramsB = getNGrams(normB, 2)
  const biSim = jaccardSimilarity(biGramsA, biGramsB)

  // 2. Normalized Levenshtein similarity
  const maxLen = Math.max(normA.length, normB.length)
  const levDist = levenshteinDistance(normA, normB)
  const levSim = maxLen > 0 ? 1.0 - levDist / maxLen : 0.0

  // 3. Word token overlap similarity
  const tokensA = new Set(normA.split(' ').filter((w) => w.length > 1))
  const tokensB = new Set(normB.split(' ').filter((w) => w.length > 1))
  const tokenSim = jaccardSimilarity(tokensA, tokensB)

  // Weighted blend: 50% bi-gram + 25% Levenshtein + 25% token
  return biSim * 0.5 + levSim * 0.25 + tokenSim * 0.25
}

/**
 * Determine whether two news stories should be deduplicated or clustered together
 */
export function isDuplicateOrClustered(titleA: string, titleB: string, threshold = 0.60): boolean {
  return calculateTitleSimilarity(titleA, titleB) >= threshold
}
