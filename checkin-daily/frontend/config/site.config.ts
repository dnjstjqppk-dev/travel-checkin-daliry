// checkin-daily/frontend/config/site.config.ts
// Master Template Configuration (Clone-Ready Architecture for News Sites: Travel, Coin, Stock, etc.)

export interface AffiliateTarget {
  id: string
  name: string
  tagline: string
  url: string
  badgeText: string
  ctaText: string
  themeColor: string
  iconName: string
  keywords: string[]
  description: string
}

export interface SiteConfig {
  domain: string
  siteId: string
  brandName: string
  brandSubname: string
  slogan: string
  description: string
  publisher: {
    name: string
    registrationNumber: string
    editorInChief: string
    address: string
    email: string
  }
  theme: {
    primaryColor: string
    primaryDark: string
    accentColor: string
    bgLight: string
    bgDark: string
  }
  categories: Array<{
    slug: string
    nameKo: string
    nameEn: string
    description: string
  }>
  // Strategic Traffic Destination Platforms (e.g., tripscanner, getfortrip -> coinscanner, stockscanner)
  affiliates: AffiliateTarget[]
}

export const siteConfig: SiteConfig = {
  domain: (typeof process !== 'undefined' && process.env?.SITE_URL) || 'https://travel-checkin-daily.dnjstjqppk.workers.dev',
  siteId: 'travel-news',
  brandName: 'CHECK-IN',
  brandSubname: 'DAILY',
  slogan: '글로벌 여행 인텔리전스 & 마켓 트렌드 뉴스 미디어',
  description: '전 세계 항공, 호텔, 여행지 트렌드 및 여행 정책을 가장 빠르고 깊이 있게 전달하는 글로벌 여행 전문 디지털 뉴스룸',
  publisher: {
    name: '체크인데일리 미디어그룹',
    registrationNumber: '서울 아-52914',
    editorInChief: '원섭',
    address: '서울특별시 중구 을지로 100 파인에비뉴 B동',
    email: 'editorial@checkindaily.com',
  },
  theme: {
    primaryColor: '#176B52',
    primaryDark: '#0e4c3a',
    accentColor: '#D9534F',
    bgLight: '#F7F8F7',
    bgDark: '#121413',
  },
  categories: [
    { slug: 'major', nameKo: '주요뉴스', nameEn: 'Top Stories', description: '글로벌 여행 업계 핵심 헤드라인' },
    { slug: 'airline', nameKo: '항공', nameEn: 'Aviation', description: '항공사 증편, 신규 취항, 항공권 트렌드' },
    { slug: 'hotel', nameKo: '호텔', nameEn: 'Hotels & Resorts', description: '럭셔리 리조트, 풀빌라, 호스피탈리티' },
    { slug: 'destination', nameKo: '여행지', nameEn: 'Destinations', description: '도시별 관광 정책, 비자, 명소' },
    { slug: 'realtime', nameKo: '실시간', nameEn: 'Realtime', description: '실시간 인기 랭킹 및 이슈' },
  ],
  affiliates: [
    {
      id: 'tripscanner',
      name: '트립스캐너 (TripScanner)',
      tagline: '실시간 전 세계 최저가 항공권 & 호텔 비교 검색',
      url: 'https://tripscanner.com',
      badgeText: '최저가 보장',
      ctaText: '실시간 항공권·호텔 가격 비교하기 →',
      themeColor: '#0052CC',
      iconName: 'plane',
      keywords: ['항공', '항공권', '비행기', '공항', '수완나품', '특가', '발권', '노선', '취항', '호텔', '숙소', '리조트', 'flight', 'airline', 'airport'],
      description: '수백만 개 항공권과 전 세계 특가 호텔 요금을 실시간으로 비교하여 최저가를 찾아드립니다.',
    },
    {
      id: 'getfortrip',
      name: '겟포트립 (GetForTrip)',
      tagline: '글로벌 현지 투어, 입장권, 액티비티, eSIM 할인 예약',
      url: 'https://getfortrip.com',
      badgeText: '인기 액티비티',
      ctaText: '현지 투어·입장권 최저가 예약하기 →',
      themeColor: '#FF5A5F',
      iconName: 'ticket',
      keywords: ['투어', '액티비티', '입장권', '비자', 'DTV', '티켓', '패스', 'eSIM', '페스티벌', '등불축제', '크루즈', '체험', 'tour', 'activity', 'ticket'],
      description: '검증된 현지 액티비티와 교통 패스, 필수 입장권을 간편하고 안전하게 즉시 예약하세요.',
    },
  ],
}

