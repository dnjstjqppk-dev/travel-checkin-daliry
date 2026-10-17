// checkin-daily/frontend/server/utils/ai-generator.ts
// Automated Article Generation Pipeline with Strict 300-1,000 Character Count Enforcement & Contextual Traffic CTAs

import { siteConfig } from '../../config/site.config'

export interface GeneratedArticle {
  title: string
  slug: string
  summary: string
  content: string
  category: string
  author: string
  coverImage: string
  publishedAt: string
  charCount: number
  ctaTarget: string
  translations: {
    en: { title: string; summary: string; content: string }
    zh: { title: string; summary: string; content: string }
    th: { title: string; summary: string; content: string }
    vi: { title: string; summary: string; content: string }
    es: { title: string; summary: string; content: string }
  }
}

// Curated high-resolution travel & business images
const curatedImages: Record<string, string[]> = {
  airline: [
    'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=1200&q=80',
  ],
  hotel: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
  ],
  destination: [
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
  ],
  major: [
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
  ],
  realtime: [
    'https://images.unsplash.com/photo-1517840901100-8179e982acb7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80',
  ],
}

function getRandomImage(category: string): string {
  const list = curatedImages[category] || curatedImages.major
  return list[Math.floor(Math.random() * list.length)]
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

/**
 * Enforces text length strictly between 300 and 1,000 characters (including spaces).
 */
export function enforceCharacterCount(text: string, keyword: string, ctaMarkdown: string): string {
  let content = text.trim()

  // 1. If too long (> 1,000 characters), truncate smartly at sentence boundary
  if (content.length > 980) {
    const cutLimit = 950 - ctaMarkdown.length
    let truncated = content.slice(0, cutLimit)
    const lastPeriod = Math.max(truncated.lastIndexOf('. '), truncated.lastIndexOf('.\n'), truncated.lastIndexOf('! '), truncated.lastIndexOf('? '))
    if (lastPeriod > 250) {
      truncated = truncated.slice(0, lastPeriod + 1)
    }
    content = truncated + '\n\n' + ctaMarkdown
  }

  // 2. If too short (< 300 characters), expand with authoritative editorial journalism context
  if (content.length < 300) {
    const expansion = `\n\n## 업계 분석 및 여행자 가이드\n전문가들은 이번 '${keyword}' 이슈가 글로벌 여행 시장의 수요 다변화와 맞물려 중요한 전환점이 될 것으로 전망하고 있습니다. 특히 개별 자유여행객(FIT)의 선호도가 급증함에 따라 현지 예약 및 발권 시스템의 사전 준비가 필수적으로 요구됩니다.\n\n${ctaMarkdown}`
    content = content + expansion
  }

  // 3. Final safety check: if still outside range, strictly clamp
  if (content.length > 1000) {
    content = content.slice(0, 990).trim() + '...'
  }

  return content
}

/**
 * Generates an authoritative, 300~1,000 character journalism news story based on a keyword.
 */
export function generateNewsStory(keyword: string, preferredCategory?: string): GeneratedArticle {
  const cleanKeyword = keyword.trim()
  if (!cleanKeyword) {
    throw new Error('기사 생성을 위한 키워드를 입력해 주세요.')
  }

  // Determine category
  let category = preferredCategory || 'major'
  if (!preferredCategory) {
    if (/항공|공항|비행|노선|수완나품|나리타|하네다|취항/i.test(cleanKeyword)) category = 'airline'
    else if (/호텔|리조트|풀빌라|숙소|오성급|투숙/i.test(cleanKeyword)) category = 'hotel'
    else if (/여행지|비자|명소|축제|방콕|도쿄|파리|휴양/i.test(cleanKeyword)) category = 'destination'
    else if (/속보|실시간|급상승|인기/i.test(cleanKeyword)) category = 'realtime'
  }

  // Determine affiliate target (tripscanner vs getfortrip)
  const isTourOrActivity = /투어|입장권|비자|체험|DTV|액티비티|페스티벌|eSIM|티켓|패스/i.test(cleanKeyword)
  const targetAffiliate = isTourOrActivity
    ? siteConfig.affiliates.find(a => a.id === 'getfortrip') || siteConfig.affiliates[1]
    : siteConfig.affiliates.find(a => a.id === 'tripscanner') || siteConfig.affiliates[0]

  const ctaUrl = `${targetAffiliate.url}?ref=checkindaily&keyword=${encodeURIComponent(cleanKeyword)}`
  const ctaMarkdown = `> ✈️ **[실시간 트래픽 연동]** '${cleanKeyword}' 관련 ${targetAffiliate.tagline}\n> 👉 **[${targetAffiliate.name}에서 ${targetAffiliate.ctaText}](${ctaUrl})**`

  // 1. Generate Headline
  const title = `'${cleanKeyword}' 글로벌 여행 수요 집중… 얼리버드 예약 폭주 및 현지 인프라 대폭 확충`

  // 2. Generate Lead Summary (1-2 sentences)
  const summary = `${cleanKeyword} 관련 여행 수요가 전년 동기 대비 급증하며 주요 항공권과 현지 숙소의 조기 예약률이 90%를 돌파했습니다. 여행 업계는 직항편 증편과 특가 프로모션을 잇달아 선보이며 여행객 맞이에 나섰습니다.`

  // 3. Generate Draft Content (Designed to be around 500-750 characters)
  const rawBody = `## 예약 급증과 현지 수용 인프라 전면 업그레이드

최근 글로벌 여행 시장에서 '${cleanKeyword}'에 대한 관심이 최고조에 달하고 있습니다. 주요 여행 플랫폼과 항공사 통계에 따르면 관련 검색량과 발권율이 전월 대비 40% 이상 가파른 상승세를 나타냈습니다.

현지 관광청과 주요 인프라 운영기관은 성수기 여행객 밀집에 대비해 공항 출입국 심사 게이트를 증설하고, 주요 명소 및 숙박 시설의 안전 점검을 완료하는 등 환대 준비를 마쳤습니다.

## 전문가 분석 및 스마트 여행 팁

업계 관계자는 "동계 시즌과 연휴를 앞두고 현지 숙소와 인기 투어 상품이 빠르게 마감되고 있다"며 "출발 30일~60일 전 사전 예약을 통해 얼리버드 혜택을 선점하는 것이 경비를 절감하는 핵심 요령"이라고 조언했습니다.`

  // 4. Strictly enforce character count (300 ~ 1,000 characters)
  const content = enforceCharacterCount(`${rawBody}\n\n${ctaMarkdown}\n\n[출처: 체크인데일리 글로벌 뉴스룸 및 현지 관광청 공식 발표](https://checkindaily.com)`, cleanKeyword, ctaMarkdown)

  const charCount = content.length

  // Generate English Slug
  const slug = `news-${slugify(cleanKeyword)}-${Date.now().toString().slice(-6)}`

  // Translations
  const enCta = `> ✈️ **[Special Travel Deal]** Real-time booking for '${cleanKeyword}':\n> 👉 **[Compare Prices on ${targetAffiliate.name}](${ctaUrl})**`
  const enTitle = `'${cleanKeyword}' Sees Record Travel Demand Surge Amid Peak Season Booking Boom`
  const enSummary = `Travel interest for ${cleanKeyword} has surged significantly with advance reservations exceeding 90%. Airlines and hospitality operators are actively expanding capacities.`
  const enContent = enforceCharacterCount(`## Soaring Bookings and Infrastructure Expansion\n\nGlobal travel momentum for '${cleanKeyword}' has reached unprecedented heights. Data indicates a 40% month-over-month rise in inquiries and bookings.\n\nLocal authorities have upgraded entry facilities, hotel capacities, and smart transit networks to ensure seamless experiences for international travelers.\n\n## Industry Insights and Recommendations\n\nExperts advise travelers to secure reservations 30 to 60 days in advance to lock in early-bird rates before prime slots sell out.\n\n${enCta}\n\n[Source: Check-in Daily Global Newsroom & Official Press Releases](https://checkindaily.com)`, cleanKeyword, enCta)

  const zhCta = `> ✈️ **[实时特惠预订]** 关于'${cleanKeyword}'的高性价比机票与酒店比价：\n> 👉 **[前往 ${targetAffiliate.name} 查看详情](${ctaUrl})**`
  const zhTitle = `'${cleanKeyword}' 全球旅游热度飙升 预订率突破90%`
  const zhSummary = `${cleanKeyword} 相关旅游搜索量激增，各大航空公司与奢华酒店全面增开航线与特惠套餐迎接客流高峰。`
  const zhContent = enforceCharacterCount(`## 预订量激增与接待设施全面升级\n\n近期与'${cleanKeyword}'相关的旅游需求迎来历史新高。官方统计显示搜索量环比提升超40%。\n\n当地旅游局已完成核心景区及口岸设施的升级，为国际游客提供更高效便捷的旅行体验。\n\n${zhCta}\n\n[来源：Check-in Daily 国际新闻部](https://checkindaily.com)`, cleanKeyword, zhCta)

  const thCta = `> ✈️ **[ดีลท่องเที่ยวพิเศษ]** เช็กราคาตั๋วเครื่องบินและที่พักสุดคุ้ม '${cleanKeyword}':\n> 👉 **[ค้นหาและจองทันทีบน ${targetAffiliate.name}](${ctaUrl})**`
  const thTitle = `กระแสท่องเที่ยว '${cleanKeyword}' พุ่งสูง ยอดจองล่วงหน้าแตะ 90% รับไฮซีซั่น`
  const thSummary = `ความสนใจเดินทางเกี่ยวกับ ${cleanKeyword} เติบโตอย่างก้าวกระโดด ผู้ประกอบการท่องเที่ยวเร่งเพิ่มเที่ยวบินและโปรโมชันพิเศษ`
  const thContent = enforceCharacterCount(`## ยอดจองพุ่งสูงและการเตรียมความพร้อมโครงสร้างพื้นฐาน\n\nกระแสการเดินทางสำหรับ '${cleanKeyword}' ได้รับความนิยมสูงสุดจากนักท่องเที่ยวทั่วโลก โดยยอดค้นหาและสำรองที่นั่งเพิ่มขึ้นกว่า 40%\n\nหน่วยงานการท่องเที่ยวในพื้นที่ได้ปรับปรุงสิ่งอำนวยความสะดวกเพื่อรองรับนักท่องเที่ยวอย่างเต็มที่\n\n${thCta}\n\n[ที่มา: กองบรรณาธิการ Check-in Daily](https://checkindaily.com)`, cleanKeyword, thCta)

  const viCta = `> ✈️ **[Ưu đãi Du lịch Trực tuyến]** So sánh giá vé máy bay và khách sạn '${cleanKeyword}':\n> 👉 **[Đặt ngay trên ${targetAffiliate.name}](${ctaUrl})**`
  const viTitle = `'${cleanKeyword}' Ghi Nhận Lượng Đặt Chỗ Kỷ Lục Bước Vào Mùa Du Lịch Cao Điểm`
  const viSummary = `Nhu cầu tìm kiếm và đặt vé liên quan đến ${cleanKeyword} tăng vọt trên các nền tảng lữ hành quốc tế.`
  const viContent = enforceCharacterCount(`## Nhu Cầu Bùng Nổ Và Nâng Cấp Hạ Tầng\n\nLượng khách quốc tế quan tâm đến '${cleanKeyword}' đang tăng trưởng mạnh mẽ với số lượng đặt phòng trước đạt trên 90%.\n\nCác chuyên gia khuyến nghị du khách nên đặt dịch vụ sớm để nhận được mức giá ưu đãi tốt nhất.\n\n${viCta}\n\n[Nguồn: Ban Biên tập Check-in Daily](https://checkindaily.com)`, cleanKeyword, viCta)

  const esCta = `> ✈️ **[Ofertas Especiales]** Compara vuelos y hoteles para '${cleanKeyword}':\n> 👉 **[Reserva al mejor precio en ${targetAffiliate.name}](${ctaUrl})**`
  const esTitle = `'${cleanKeyword}' Registra un Récord de Reservas para la Temporada Alta`
  const esSummary = `El interés por ${cleanKeyword} ha aumentado más de un 40% con una ocupación anticipada que roza el 90% en los principales destinos.`
  const esContent = enforceCharacterCount(`## Crecimiento Histórico de Reservas e Infraestructura\n\nLa demanda para '${cleanKeyword}' se ha disparado en las últimas semanas. Las aerolíneas y cadenas hoteleras han ampliado sus frecuencias para atender la llegada de viajeros internacionales.\n\n${esCta}\n\n[Fuente: Redacción de Check-in Daily](https://checkindaily.com)`, cleanKeyword, esCta)

  return {
    title,
    slug,
    summary,
    content,
    category,
    author: '체크인데일리 AI 인텔리전스 데스크',
    coverImage: getRandomImage(category),
    publishedAt: new Date().toISOString(),
    charCount,
    ctaTarget: targetAffiliate.name,
    translations: {
      en: { title: enTitle, summary: enSummary, content: enContent },
      zh: { title: zhTitle, summary: zhSummary, content: zhContent },
      th: { title: thTitle, summary: thSummary, content: thContent },
      vi: { title: viTitle, summary: viSummary, content: viContent },
      es: { title: esTitle, summary: esSummary, content: esContent },
    },
  }
}

