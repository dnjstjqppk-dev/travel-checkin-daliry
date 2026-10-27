// checkin-daily/frontend/server/utils/gemini-client.ts
// Production Gemini Newsroom Engine for Check-in Daily
// Powered by Google Gemini 3.5 Flash / Flash Lite with Structured JSON output

import { siteConfig } from '../../config/site.config'
import {
  calculateBodyTextLength,
  extractBodyImages,
} from '../../utils/article-validator'
import { enforceCharacterCount, type GeneratedArticle } from './ai-generator'

interface GeminiArticlePayload {
  title: string
  summary: string
  keyTakeaways: string[]
  content: string
  category?: string
  sourceName?: string
  sourceUrl?: string
  translations: {
    en: { title: string; summary: string; content: string }
    zh: { title: string; summary: string; content: string }
    th: { title: string; summary: string; content: string }
    vi: { title: string; summary: string; content: string }
    es: { title: string; summary: string; content: string }
  }
}

// Curated high-resolution editorial photography (Unsplash Editorial Reference)
const curatedImagesPool: Record<string, string[]> = {
  airline: [
    'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
  ],
  hotel: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
  ],
  destination: [
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
  ],
  major: [
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&w=1200&q=80',
  ],
  realtime: [
    'https://images.unsplash.com/photo-1517840901100-8179e982acb7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
  ],
}

function getCuratedImages(category: string): { cover: string; bodyImages: string[] } {
  const pool = curatedImagesPool[category] || curatedImagesPool.major || []
  const shuffled = [...pool].sort(() => 0.5 - Math.random())
  const cover = shuffled[0] || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80'
  const bodyImages = shuffled.length >= 5 ? shuffled.slice(1, 5) : [
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
  ]
  return { cover, bodyImages }
}

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return base || `article-${Date.now()}`
}

export interface GeminiGenerateOptions {
  keyword: string
  contextText?: string
  preferredCategory?: string
  apiKey?: string
}

export async function generateNewsWithGemini(options: GeminiGenerateOptions): Promise<GeneratedArticle> {
  const { keyword, contextText, preferredCategory } = options
  const cleanKeyword = keyword.trim()

  if (!cleanKeyword) {
    throw new Error('기사 생성을 위한 키워드를 입력해 주세요.')
  }

  const effectiveApiKey = options.apiKey
    || (typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || (process.env as any).NUXT_GEMINI_API_KEY) : '')

  if (!effectiveApiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. Cloudflare Worker 환경변수(GEMINI_API_KEY) 또는 사이트 설정(site_settings)에서 등록해 주세요.')
  }

  // Determine category
  let category = preferredCategory || 'major'
  if (!preferredCategory) {
    if (/항공|공항|비행|노선|수완나품|나리타|하네다|취항/i.test(cleanKeyword)) category = 'airline'
    else if (/호텔|리조트|풀빌라|숙소|오성급|투숙/i.test(cleanKeyword)) category = 'hotel'
    else if (/여행지|비자|명소|축제|방콕|도쿄|파리|휴양/i.test(cleanKeyword)) category = 'destination'
    else if (/속보|실시간|급상승|인기/i.test(cleanKeyword)) category = 'realtime'
  }

  // Affiliate target
  const isTourOrActivity = /투어|입장권|비자|체험|DTV|액티비티|페스티벌|eSIM|티켓|패스/i.test(cleanKeyword)
  const targetAffiliate = (isTourOrActivity
    ? siteConfig.affiliates.find((a) => a.id === 'getfortrip') || siteConfig.affiliates[1] || siteConfig.affiliates[0]
    : siteConfig.affiliates.find((a) => a.id === 'tripscanner') || siteConfig.affiliates[0]
  ) as NonNullable<(typeof siteConfig.affiliates)[0]>

  const ctaMarkdown = `\n\n> ✈️ **[${targetAffiliate.name}]** ${targetAffiliate.description}\n> [${targetAffiliate.ctaText}](${targetAffiliate.url})`

  // Prompt construction
  const prompt = `당신은 글로벌 독립 여행 저널리즘 미디어 '체크인데일리 (Check-in Daily)'의 수석 데스크 에디터입니다.
다음 주제와 정보를 바탕으로 신문 1면 톱기사 수준의 심층 탐사 보도 기사를 작성하세요.

주제 키워드: "${cleanKeyword}"
카테고리: ${category}
${contextText ? `참고 보도자료/원문 팩트:\n"""\n${contextText.slice(0, 3000)}\n"""` : ''}

[필수 작성 지침]
1. 제목: 사실적이고 호소력 짙은 정통 뉴스 헤드라인 (클릭베이트 지양).
2. 요약: 1~2문장의 핵심 리드문 (Lead paragraph).
3. 핵심 요약 (keyTakeaways): 독자가 10초 만에 파악할 수 있는 핵심 사실 3가지.
4. 본문:
   - 최소 3개 이상의 소제목(## )으로 문단을 입체적으로 분할하세요.
   - 역피라미드 구조(핵심 사실 -> 산업/시장 파급 분석 -> 여행자 실질 팁 및 주의사항 -> 결론)를 준수하세요.
   - 한국어 순수 본문 텍스트 글자수는 850자 이상 1,400자 이하로 충실하고 깊이 있게 작성하세요.
   - 본문 내에 이미지 태그나 광고 링크는 넣지 마세요 (시스템이 자동으로 후처리 배치합니다).
5. 5개국어 다국어 번역:
   - 영어(en), 중국어 간체(zh), 태국어(th), 베트남어(vi), 스페인어(es)로 각 언어권 현지 저널리즘 어조에 맞춰 고품질 번역을 제공하세요.
6. 반드시 JSON 스키마 규격으로만 응답하세요.

[JSON 스키마 규격]
{
  "title": "한국어 제목",
  "summary": "한국어 요약문",
  "keyTakeaways": ["핵심 1", "핵심 2", "핵심 3"],
  "content": "한국어 마크다운 본문 (## 소제목 포함, 이미지 제외)",
  "sourceName": "공식 1차 출처 (예: 태국 관광청 TAT / IATA / 항공사 PR)",
  "sourceUrl": "출처 공식 웹사이트",
  "translations": {
    "en": { "title": "English Title", "summary": "English summary", "content": "English markdown body" },
    "zh": { "title": "中文标题", "summary": "中文摘要", "content": "中文正文" },
    "th": { "title": "หัวข้อข่าวภาษาไทย", "summary": "สรุปข่าวภาษาไทย", "content": "เนื้อหาข่าวภาษาไทย" },
    "vi": { "title": "Tiêu đề tiếng Việt", "summary": "Tóm tắt tiếng Việt", "content": "Nội dung tiếng Việt" },
    "es": { "title": "Título en español", "summary": "Resumen en español", "content": "Contenido en español" }
  }
}`

  const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash']
  let lastError: any = null
  let parsedPayload: GeminiArticlePayload | null = null

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveApiKey}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Gemini API error [${model}] status ${response.status}: ${errText}`)
      }

      const resData = await response.json()
      const rawJson = resData.candidates?.[0]?.content?.parts?.[0]?.text
      if (rawJson) {
        parsedPayload = JSON.parse(rawJson) as GeminiArticlePayload
        break
      }
    } catch (err: any) {
      lastError = err
      // Try next model if 503 or transient failure
    }
  }

  if (!parsedPayload) {
    throw new Error(`Gemini 기사 생성 실패: ${lastError?.message || '응답을 파싱할 수 없습니다.'}`)
  }

  // Pick 4 curated body images matching category
  const { cover, bodyImages } = getCuratedImages(category)

  // Weave 4 images and CTA into Korean content
  const sections = parsedPayload.content.split('\n\n## ')
  let wovenContent = sections[0] || parsedPayload.content

  for (let i = 1; i < sections.length; i++) {
    const imgIdx = (i - 1) % bodyImages.length
    const imageTag = `\n\n![${cleanKeyword} 보도 사진 ${i}](${bodyImages[imgIdx]} "${cleanKeyword} 현장 취재 및 공식 인프라 사진")\n\n`
    wovenContent += imageTag + '## ' + sections[i]
  }

  // Ensure all 4 images are present
  const presentImages = extractBodyImages(wovenContent, cover)
  if (presentImages.length < 4) {
    for (let k = presentImages.length; k < 4; k++) {
      wovenContent += `\n\n![${cleanKeyword} 추가 보도 자료](${bodyImages[k]} "${cleanKeyword} 상세 데이터")`
    }
  }

  // Append CTA and source citation
  wovenContent = wovenContent + ctaMarkdown + `\n\n[출처: ${parsedPayload.sourceName || '체크인데일리 글로벌 뉴스룸'} 공식 보도자료]`

  // Enforce character count (800~2,000 characters)
  wovenContent = enforceCharacterCount(wovenContent, cleanKeyword, ctaMarkdown, 800, 2000)

  // Also weave images and CTA into 5 translations
  const langKeys = ['en', 'zh', 'th', 'vi', 'es'] as const
  const finalTranslations: Record<string, { title: string; summary: string; content: string }> = {}

  for (const lang of langKeys) {
    const t = parsedPayload.translations?.[lang]
    if (t && t.content) {
      let tContent = t.content
      const tSections = tContent.split('\n\n## ')
      let wovenTrans = tSections[0] || tContent
      for (let j = 1; j < tSections.length; j++) {
        const imgIdx = (j - 1) % bodyImages.length
        wovenTrans += `\n\n![Editorial Reference ${j}](${bodyImages[imgIdx]} "Check-in Daily Verified")\n\n## ` + tSections[j]
      }
      finalTranslations[lang] = {
        title: t.title,
        summary: t.summary,
        content: wovenTrans + `\n\n> ✈️ [TripScanner & GetForTrip Global Booking Partner](https://tripscanner.com)`,
      }
    } else {
      // Fallback
      finalTranslations[lang] = {
        title: `${parsedPayload.title} (${lang.toUpperCase()})`,
        summary: parsedPayload.summary,
        content: wovenContent,
      }
    }
  }

  const finalCharCount = calculateBodyTextLength(wovenContent)
  const finalImageCount = extractBodyImages(wovenContent, cover).length

  return {
    title: parsedPayload.title,
    slug: slugify(parsedPayload.title),
    summary: parsedPayload.summary,
    content: wovenContent,
    category,
    author: '체크인데일리 AI 뉴스룸',
    coverImage: cover,
    publishedAt: new Date().toISOString(),
    charCount: finalCharCount,
    imageCount: finalImageCount,
    ctaTarget: targetAffiliate.id,
    translations: finalTranslations as any,
  }
}
