// checkin-daily/frontend/config/brand.config.ts
// Multi-Brand White-Label Presets for Cloning Master Architecture
// Supports: Travel (default), Coin/Crypto, and Stock/Equities

import type { SiteConfig } from './site.config'

export const brandPresets: Record<string, SiteConfig> = {
  travel: {
    domain: 'https://travel-checkin-daily.dnjstjqppk.workers.dev',
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
  },
  coin: {
    domain: 'https://coinpulse-daily.workers.dev',
    siteId: 'coin-news',
    brandName: 'COINPULSE',
    brandSubname: 'DAILY',
    slogan: '글로벌 웹3·암호화폐 인텔리전스 & 온체인 데이터 뉴스 미디어',
    description: '비트코인, 이더리움, L1/L2 블록체인, DeFi, 온체인 고래 데이터 및 규제 정책을 심층 보도하는 가상자산 전문 디지털 뉴스룸',
    publisher: {
      name: '코인펄스 미디어랩',
      registrationNumber: '서울 아-53102',
      editorInChief: '크립토데스크',
      address: '서울특별시 강남구 테헤란로 152 강남파이낸스센터',
      email: 'editorial@coinpulsedaily.com',
    },
    theme: {
      primaryColor: '#F59E0B',
      primaryDark: '#B45309',
      accentColor: '#3B82F6',
      bgLight: '#FAFAFA',
      bgDark: '#0B0F19',
    },
    categories: [
      { slug: 'major', nameKo: '주요뉴스', nameEn: 'Top Stories', description: '글로벌 크립토 시장 핵심 뉴스' },
      { slug: 'bitcoin', nameKo: '비트코인', nameEn: 'Bitcoin & Macro', description: 'BTC ETF 유입, 반감기, 거시경제 지표' },
      { slug: 'altcoin', nameKo: '알트코인', nameEn: 'Altcoins & L2', description: '이더리움, 솔라나, 유망 레이어 프로젝트' },
      { slug: 'onchain', nameKo: '온체인분석', nameEn: 'On-chain & DeFi', description: '고래 지갑 추적, TVL 변동, 덱스 거래량' },
      { slug: 'regulation', nameKo: '규제·정책', nameEn: 'Policy & Legal', description: 'SEC 규제, 각국 가상자산 법안' },
    ],
    affiliates: [
      {
        id: 'coinscanner',
        name: '코인스캐너 (CoinScanner)',
        tagline: '실시간 전 세계 거래소 김치프리미엄 & 호가 스프레드 비교',
        url: 'https://coinscanner.io',
        badgeText: '실시간 시세',
        ctaText: '실시간 김프 & 거래소 호가 비교하기 →',
        themeColor: '#F59E0B',
        iconName: 'coins',
        keywords: ['비트코인', '이더리움', '솔라나', '알트코인', '거래소', '업비트', '바이낸스', '김프', '시세', '호가', '차트', 'btc', 'eth'],
        description: '업비트, 빗썸, 바이낸스, 바이비트 실시간 호가 및 김치프리미엄을 1초 단위로 비교 분석합니다.',
      },
      {
        id: 'dexradar',
        name: '덱스레이더 (DexRadar)',
        tagline: '온체인 스마트머니 추적 & 밈코인 실시간 스나이핑',
        url: 'https://dexradar.io',
        badgeText: '스마트머니',
        ctaText: '고래 지갑 & 신규 페어 온체인 추적하기 →',
        themeColor: '#8B5CF6',
        iconName: 'radar',
        keywords: ['온체인', '고래', '스마트머니', '스왑', '디파이', '유니스왑', '레이디움', 'dex', 'defi', 'airdrop', '에어드랍'],
        description: '최상위 수익률 온체인 고래 지갑의 실시간 매수/매도 시그널과 신규 유동성 풀을 즉시 포착합니다.',
      },
    ],
  },
  stock: {
    domain: 'https://marketpulse-daily.workers.dev',
    siteId: 'stock-news',
    brandName: 'MARKETPULSE',
    brandSubname: 'DAILY',
    slogan: '글로벌 거시경제·증시 인텔리전스 & 기업 실적 분석 미디어',
    description: '뉴욕증시, 코스피, 금리 정책, 기업 분기 실적 및 테크 산업 트렌드를 날카롭게 분석하는 비즈니스 뉴스 플랫폼',
    publisher: {
      name: '마켓펄스 파이낸스그룹',
      registrationNumber: '서울 아-54019',
      editorInChief: '증권데스크',
      address: '서울특별시 영등포구 여의대로 108 파크원 타워',
      email: 'editorial@marketpulsedaily.com',
    },
    theme: {
      primaryColor: '#1E3A8A',
      primaryDark: '#172554',
      accentColor: '#DC2626',
      bgLight: '#F8FAFC',
      bgDark: '#020617',
    },
    categories: [
      { slug: 'major', nameKo: '주요뉴스', nameEn: 'Top Stories', description: '국내외 증시 및 금융 핵심 속보' },
      { slug: 'us-stock', nameKo: '미국증시', nameEn: 'Wall Street', description: '나스닥, S&P500, 빅테크 실적' },
      { slug: 'kr-stock', nameKo: '국내증시', nameEn: 'KOSPI & KOSDAQ', description: '반도체, 2차전지, 밸류업 프로그램' },
      { slug: 'macro', nameKo: '거시경제', nameEn: 'Macro & Fed', description: '연준 FOMC, 금리, 환율, 고용보고서' },
      { slug: 'etf', nameKo: 'ETF·채권', nameEn: 'ETF & Yields', description: '배당 ETF, 채권 금리, 자산배분' },
    ],
    affiliates: [
      {
        id: 'stockscanner',
        name: '스탁스캐너 (StockScanner)',
        tagline: '글로벌 테크 대형주 실시간 밸류에이션 & 기관 수급 비교',
        url: 'https://stockscanner.io',
        badgeText: '수급 분석',
        ctaText: '실시간 기관·외국인 수급 포착하기 →',
        themeColor: '#1E3A8A',
        iconName: 'trending-up',
        keywords: ['주식', '나스닥', '코스피', '삼성전자', '엔비디아', '테슬라', '애플', '실적', '배당', '수급', '기관', '외인'],
        description: '국내 및 미국 상장 종목의 PER/PBR, 컨센서스 달성률, 외국인 순매수 추이를 원클릭 비교합니다.',
      },
      {
        id: 'etffinder',
        name: 'ETF파인더 (ETFFinder)',
        tagline: '글로벌 배당 & 테마형 ETF 총보수 및 구성종목 비교 검색',
        url: 'https://etffinder.com',
        badgeText: '배당 비교',
        ctaText: '최적 배당 & 테마 ETF 포트폴리오 설계하기 →',
        themeColor: '#059669',
        iconName: 'pie-chart',
        keywords: ['etf', '배당', '슈드', 'schd', 'qylg', '커버드콜', '월배당', '채권', '포트폴리오', '자산배분'],
        description: '국내외 3,000여 개 ETF의 배당수익률, 총보수율, 종목 중복도를 비교하여 최적의 월배당 파이프라인을 설계합니다.',
      },
    ],
  },
}

export function getBrandConfig(brandKey?: string): SiteConfig {
  const target = brandKey || process.env.BRAND_PRESET || 'travel'
  return brandPresets[target] || brandPresets.travel
}

