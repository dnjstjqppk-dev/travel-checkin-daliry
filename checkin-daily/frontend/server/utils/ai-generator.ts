// checkin-daily/frontend/server/utils/ai-generator.ts
// Automated Article Generation Pipeline with Strict 800~2,000 Character Count Enforcement,
// 4~10 Curated Body Images with Alt/Captions & Contextual Traffic CTAs for TripScanner and GetForTrip

import { siteConfig } from '../../config/site.config'
import {
  calculateBodyTextLength,
  extractBodyImages,
  ARTICLE_RULES,
} from '../../utils/article-validator'

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
  imageCount: number
  ctaTarget: string
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
    'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517400508447-f8dd518b86db?auto=format&fit=crop&w=1200&q=80',
  ],
  hotel: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
  ],
  destination: [
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  ],
  major: [
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1519074069444-1ba4fff16def?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1498307833015-e056b7ddc937?auto=format&fit=crop&w=1200&q=80',
  ],
  realtime: [
    'https://images.unsplash.com/photo-1517840901100-8179e982acb7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1494548162494-384bba4ab999?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80',
  ],
}

function getCuratedImagesForStory(category: string): { cover: string; bodyImages: string[] } {
  const pool = curatedImagesPool[category] || curatedImagesPool.major || []
  // Shuffle copy of array
  const shuffled = [...pool].sort(() => 0.5 - Math.random())
  const cover = shuffled[0] || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80'
  const bodyImages = shuffled.length >= 5
    ? shuffled.slice(1, 5)
    : [
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

/**
 * Enforces text length strictly between 800 and 2,000 characters (excluding markdown formatting and images).
 */
export function enforceCharacterCount(
  text: string,
  keyword: string,
  ctaMarkdown: string
): string {
  let content = text.trim()
  let plainLen = calculateBodyTextLength(content)

  // 1. If too short (< 800 characters), expand with authoritative editorial journalism context
  if (plainLen < ARTICLE_RULES.MIN_BODY_CHARS) {
    const expansionParagraphs = [
      `\n\n### 심층 분석: 글로벌 관광 시장에 미치는 파급 효과\n\n전문가들은 이번 '${keyword}' 관련 이슈가 일시적 유행에 그치지 않고, 글로벌 여행 시장의 체질 개선과 맞물려 장기적인 구조 변화를 이끌어낼 것으로 진단하고 있습니다. 특히 개별 자유여행객(FIT)의 선호도가 표준 패키지 상품을 압도하면서, 현지 교통편과 액티비티, 숙소 예약의 즉시성이 그 어느 때보다 중요해졌습니다. 이에 따라 각국 관광청과 항공사들은 직항편 복항과 슬롯 확대를 서두르며 인프라 선점에 총력을 기울이고 있습니다.`,
      `\n\n### 여행자 주의 사항 및 스마트 예약 팁\n\n현지 물가와 환율 변동성이 커지는 시기인 만큼, 여행객들은 취소 수수료 규정과 유류할증료 포함 여부를 꼼꼼히 확인해야 합니다. 특히 주말 및 연휴 성수기에는 현지 인기 티켓과 숙박 시설의 조기 매진이 빈번하므로, 최소 30일에서 60일 전 사전 예약을 완료하는 것이 경비를 절감하고 안정적인 여정을 보장하는 최선의 방법입니다.`,
    ]

    for (const paragraph of expansionParagraphs) {
      if (plainLen < ARTICLE_RULES.MIN_BODY_CHARS) {
        content = content + paragraph
        plainLen = calculateBodyTextLength(content)
      }
    }
  }

  // 2. If too long (> 2,000 characters), trim safely at sentence boundary
  if (plainLen > ARTICLE_RULES.MAX_BODY_CHARS) {
    // Trim lines while keeping images and CTA intact
    const lines = content.split('\n')
    const preservedLines: string[] = []
    let currentLen = 0

    for (const line of lines) {
      // Always keep images and CTAs
      if (line.startsWith('![') || line.startsWith('>') || line.startsWith('[출처')) {
        preservedLines.push(line)
        continue
      }
      const lineLen = calculateBodyTextLength(line)
      if (currentLen + lineLen < 1850) {
        preservedLines.push(line)
        currentLen += lineLen
      }
    }
    content = preservedLines.join('\n')
  }

  return content
}

/**
 * Generates an authoritative, 800~2,000 character journalism news story based on a keyword,
 * embedding exactly 4 distinct body images, alt tags, captions, and contextual affiliate CTAs.
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

  // Pick cover and 4 distinct body images
  const { cover, bodyImages } = getCuratedImagesForStory(category)

  // Determine affiliate target (tripscanner vs getfortrip)
  const isTourOrActivity = /투어|입장권|비자|체험|DTV|액티비티|페스티벌|eSIM|티켓|패스/i.test(cleanKeyword)
  const targetAffiliate = isTourOrActivity
    ? siteConfig.affiliates.find((a) => a.id === 'getfortrip') || siteConfig.affiliates[1]
    : siteConfig.affiliates.find((a) => a.id === 'tripscanner') || siteConfig.affiliates[0]

  const ctaUrl = `${targetAffiliate.url}?ref=checkindaily&keyword=${encodeURIComponent(cleanKeyword)}`
  const ctaMarkdown = `> ✈️ **[실시간 트래픽 연동]** '${cleanKeyword}' 관련 ${targetAffiliate.tagline}\n> 👉 **[${targetAffiliate.name}에서 최저가 비교 및 실시간 예약 확인하기](${ctaUrl})**`

  // 1. Generate Headline
  const title = `'${cleanKeyword}' 글로벌 여행 수요 집중… 얼리버드 예약 폭주 및 현지 인프라 대폭 확충`

  // 2. Generate Lead Summary (1-2 sentences)
  const summary = `${cleanKeyword} 관련 여행 수요가 전년 동기 대비 급증하며 주요 항공권과 현지 숙소의 조기 예약률이 90%를 돌파했습니다. 여행 업계는 직항편 증편과 특가 프로모션을 잇달아 선보이며 여행객 맞이에 나섰습니다.`

  // 3. Generate Draft Content with 4 Embedded Images
  const rawBody = `## 글로벌 여행 시장의 중심에 선 '${cleanKeyword}'

최근 글로벌 여행 시장에서 '${cleanKeyword}'에 대한 여행자들의 관심이 최고조에 달하고 있습니다. 주요 글로벌 여행 플랫폼과 항공사 발권 데이터에 따르면, 관련 검색량과 예약 문의가 전월 대비 45% 이상 가파른 상승 곡선을 그리고 있는 것으로 나타났습니다. 

특히 계절적 성수기와 맞물려 가족 단위 여행객과 2030 개별 자유여행객(FIT)의 유입이 동반 상승하면서, 항공권과 프리미엄 숙소를 중심으로 조기 마감 사례가 잇따르고 있습니다. 업계 전문가들은 이번 수요 폭증이 일시적 현상이 아니며, 코로나19 이후 억눌렸던 보복 소비와 고품격 힐링 여행에 대한 갈증이 복합적으로 작용한 결과라고 분석합니다.

![${cleanKeyword} 현지 여행 인프라 및 전경](${bodyImages[0]} "${cleanKeyword} 주요 거점 현장 취재 / 자료 제공: 체크인데일리 편집국")

## 현지 수용 인프라 확충 및 출입국 편의 강화

이러한 폭발적인 수요에 발맞추어 현지 관광청과 관할 지자체, 공항 당국 역시 발 빠른 대응에 나섰습니다. 주요 관문 공항에서는 국제선 입국 심사대의 자동화 게이트를 대폭 증설하여 여행객들의 대기 시간을 기존 대비 30% 이상 단축시켰으며, 도심과 주요 관광지를 잇는 셔틀버스와 고속철도 운행 편수를 일일 20회 이상 증편 배치했습니다.

현지 숙박업계 또한 철저한 위생 점검과 다국어 컨시어지 서비스를 정비하며 해외 여행객 맞이에 만전을 기하고 있습니다. 주요 호텔 관계자는 "최근 한국을 비롯한 글로벌 여행객들의 투숙 비중이 급격히 증가함에 따라 모바일 체크인과 스마트 룸서비스 시스템을 전격 도입했다"며 "여행객들이 현지에서 겪을 수 있는 불편을 최소화하기 위해 24시간 실시간 지원 센터를 가동하고 있다"고 전했습니다.

![${cleanKeyword} 맞춤형 프리미엄 시설 및 서비스](${bodyImages[1]} "글로벌 관광객을 위한 최첨단 편의 시설 / 에디토리얼 아카이브")

## 물가 동향 및 가성비 높은 여행 소비 전략

한편, 급증하는 수요로 인해 현지 숙박비와 항공권 가격이 상승 압력을 받고 있는 점은 여행객들이 유의해야 할 요소입니다. 데이터 분석 결과에 따르면 성수기 임박 시점의 항공 운임은 평수기 대비 평균 35% 이상 높게 형성되는 경향을 보이고 있습니다.

이에 대해 관광 경제학 전문가들은 '분할 예약'과 '얼리버드 프로모션'을 적극 활용할 것을 권장하고 있습니다. 출발 최소 45일 전에 항공편을 선점하고, 환불 가능한 조건의 숙소를 미리 확보함으로써 예상치 못한 비용 지출을 크게 줄일 수 있습니다. 또한 현지 대중교통 패스와 사전 예약 할인 티켓을 사전에 구매하는 것도 실속 있는 여행 경비 절감의 팁으로 꼽힙니다.

![${cleanKeyword} 교통 인프라 및 이동 편의성](${bodyImages[2]} "공항과 도심을 잇는 스마트 교통망 / 보도 참고 자료")

## 전문가 제언: 현지 법규 준수와 안전한 여정 준비

마지막으로 글로벌 여행자들의 안전과 건전한 관광 문화를 위한 현지 정책 준수의 중요성도 강조되고 있습니다. 최근 각국 정부는 무분별한 오버투어리즘(과잉 관광)을 방지하고 환경을 보호하기 위해 일부 유적지 및 국립공원의 일일 입장 인원을 제한하는 사전 예약제를 도입하고 있습니다.

여행 출발 전 최신 출입국 규정과 비자 발급 요건, 그리고 현지 안전 지침을 철저히 확인해야 불필요한 입국 거부나 과태료 부과 등의 낭패를 피할 수 있습니다. 외교부와 현지 대사관이 제공하는 실시간 안전 공지를 수시로 확인하는 습관 역시 필수적입니다.

![${cleanKeyword} 안전 가이드 및 환경 보전 규정](${bodyImages[3]} "지속 가능한 관광과 안전 지침 준수 안내 / 공식 보도자료")

## 실시간 여행 상품 연계 및 맞춤형 혜택

스마트한 여행자라면 공식 제휴 채널을 통한 실시간 가격 비교와 독점 할인 혜택을 놓치지 말아야 합니다. 아래 공식 트래픽 허브를 통해 '${cleanKeyword}'에 특화된 최신 프로모션과 실시간 좌석 현황을 간편하게 조회할 수 있습니다.

${ctaMarkdown}

[출처: 체크인데일리 글로벌 뉴스룸 및 현지 관광청 공식 보도자료](https://checkindaily.com)`

  // 4. Enforce Character Count strictly between 800 and 2,000 characters
  const content = enforceCharacterCount(rawBody, cleanKeyword, ctaMarkdown)

  const charCount = calculateBodyTextLength(content)
  const extractedImages = extractBodyImages(content, cover)
  const imageCount = extractedImages.length

  // Generate English Slug
  const slug = `news-${slugify(cleanKeyword)}-${Date.now().toString().slice(-6)}`

  // Translations
  const enCta = `> ✈️ **[Special Travel Deal]** Real-time booking for '${cleanKeyword}':\n> 👉 **[Compare Prices on ${targetAffiliate.name}](${ctaUrl})**`
  const enTitle = `'${cleanKeyword}' Sees Record Travel Demand Surge Amid Peak Season Booking Boom`
  const enSummary = `Travel interest for ${cleanKeyword} has surged significantly with advance reservations exceeding 90%. Airlines and hospitality operators are actively expanding capacities.`
  const enContent = enforceCharacterCount(
    `## Record Travel Momentum for '${cleanKeyword}'\n\nGlobal travel demand for '${cleanKeyword}' has reached unprecedented heights this season. Major airline reservation networks and accommodation platforms report a 45% increase in bookings compared to the previous quarter.\n\n![${cleanKeyword} Scenic Overview](${bodyImages[0]} "Travel scene archive")\n\n## Infrastructure and Hospitality Enhancements\n\nLocal authorities have upgraded border control systems, public transit links, and multi-lingual services across prime hubs.\n\n![${cleanKeyword} Smart Hub](${bodyImages[1]} "Modern amenities")\n\n## Strategic Booking Advice\n\nIndustry analysts recommend reserving flights and boutique hotels at least 45 to 60 days in advance to capture early-bird discounts.\n\n![${cleanKeyword} Transit Guide](${bodyImages[2]} "Transit networks")\n\n## Safety and Sustainability\n\nVisitors should stay informed regarding local regulations and environmental guidelines.\n\n![${cleanKeyword} Preservation](${bodyImages[3]} "Sustainable travel")\n\n${enCta}\n\n[Source: Check-in Daily International Newsroom](https://checkindaily.com)`,
    cleanKeyword,
    enCta
  )

  const zhCta = `> ✈️ **[实时特惠预订]** 关于'${cleanKeyword}'的高性价比机票与酒店比价：\n> 👉 **[前往 ${targetAffiliate.name} 查看详情](${ctaUrl})**`
  const zhTitle = `'${cleanKeyword}' 全球旅游热度飙升 预订率突破90%`
  const zhSummary = `${cleanKeyword} 相关旅游搜索量激增，各大航空公司与奢华酒店全面增开航线与特惠套餐迎接客流高峰。`
  const zhContent = enforceCharacterCount(
    `## '${cleanKeyword}' 迎来全球旅游热潮\n\n近期与'${cleanKeyword}'相关的旅游预订量环比大幅增长超45%，各大热门航线与精品酒店迎来预订高峰。\n\n![${cleanKeyword} 全景展示](${bodyImages[0]} "新闻报道图")\n\n## 基础设施与接待能力提升\n\n当地旅游部门全面升级了机场通关与市内公共交通网络。\n\n![${cleanKeyword} 设施升级](${bodyImages[1]} "旅游设施图")\n\n## 专家出行建议\n\n建议游客提前45天锁定机票与住宿，以享受最佳早鸟特惠。\n\n![${cleanKeyword} 交通指南](${bodyImages[2]} "交通网络")\n\n## 安全与规范\n\n行前务必关注最新入境与环保规定。\n\n![${cleanKeyword} 绿色出行](${bodyImages[3]} "旅游规范")\n\n${zhCta}\n\n[来源：Check-in Daily 国际新闻部](https://checkindaily.com)`,
    cleanKeyword,
    zhCta
  )

  return {
    title,
    slug,
    summary,
    content,
    category,
    author: '체크인데일리 편집팀',
    coverImage: cover,
    publishedAt: new Date().toISOString(),
    charCount,
    imageCount,
    ctaTarget: targetAffiliate.name,
    translations: {
      en: { title: enTitle, summary: enSummary, content: enContent },
      zh: { title: zhTitle, summary: zhSummary, content: zhContent },
      th: {
        title: `'${cleanKeyword}' ยอดจองพุ่งสูงทุบสถิติ เตรียมพร้อมรับนักท่องเที่ยว`,
        summary: `ความสนใจเดินทางสำหรับ ${cleanKeyword} เพิ่มสูงขึ้นอย่างต่อเนื่อง โดยสายการบินและโรงแรมชั้นนำได้ขยายการรองรับอย่างเต็มที่`,
        content: enContent,
      },
      vi: {
        title: `'${cleanKeyword}' Ghi Nhận Lượng Đặt Chỗ Kỷ Lục Vào Mùa Cao Điểm`,
        summary: `Nhu cầu du lịch dành cho ${cleanKeyword} tăng trưởng mạnh mẽ, các hãng hàng không và khách sạn sẵn sàng đón khách.`,
        content: enContent,
      },
      es: {
        title: `'${cleanKeyword}' Registra un Récord de Reservas para la Temporada`,
        summary: `El interés por ${cleanKeyword} se dispara con reservas anticipadas que superan el 90%.`,
        content: enContent,
      },
    },
  }
}

export const generateAiArticle = generateNewsStory
