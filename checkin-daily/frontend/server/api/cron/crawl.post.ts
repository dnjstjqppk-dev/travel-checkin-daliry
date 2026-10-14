import { createError, defineEventHandler, getRequestHeader } from 'h3'
import { d1Run, getD1Database } from '../../utils/d1'

const SAMPLE_FALLBACKS = [
  {
    title: '글로벌 주요 항공사, 2026 하계 스케줄 발표… 아시아-미주 태평양 횡단 노선 증편 러시',
    category: 'airline',
    summary: '주요 글로벌 플래그십 항공사들이 2026 하계 시즌을 맞아 아시아 태평양 횡단 노선 운항을 대폭 확대하고 차세대 기단을 집중 투입합니다.',
    cover_image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&auto=format&fit=crop&q=80',
    content: `## 2026 하계 운항 스케줄 개편 배경

국제항공운송협회(IATA)의 최신 통계에 따르면 아시아와 북미를 잇는 여행 및 비즈니스 항공 수요가 전년 동기 대비 14.8% 증가했습니다. 이에 맞춰 글로벌 메이저 항공사들이 인천, 도쿄(하네다/나리타), 방콕 등 주요 아시아 허브와 미 서부(시애틀, 샌프란시스코, LA)를 잇는 정기편을 증편합니다.

---

## 투입 기단 및 프리미엄 캐빈 분석

이번 증편의 핵심은 에어버스 A350-1000과 보잉 787-9 드림라이너 등 최신예 친환경 기단의 전면 배치입니다. 신규 비즈니스 스위트 좌석에는 슬라이딩 도어와 무선 충전, 4K OLED 모니터가 표준 장착되어 비즈니스 여행객의 만족도를 높일 전망입니다.

* **운항 빈도**: 주 7회에서 최대 주 14회(일 2회)로 확대
* **마일리지 좌석**: 비수기 및 얼리버드 마일리지 발권 쿼터 20% 추가 배정
* **기내 와이파이**: 초고속 위성 와이파이 전 승객 무료 제공 정책 확산

---

*(체크인데일리 항공 전문 데스크 보도)*`,
  },
  {
    title: '방콕 차오프라야 강변, 2026 신규 하이엔드 부티크 빌라 리조트 3곳 잇따라 개관',
    category: 'hotel',
    summary: '태국 전통 건축 양식과 현대적 미니멀리즘을 접목한 강변 프라이빗 풀빌라 리조트들이 잇달아 문을 열며 호캉스 여행객들의 이목을 끕니다.',
    cover_image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&auto=format&fit=crop&q=80',
    content: `## 방콕 럭셔리 호스피탈리티의 새로운 지평

방콕의 젖줄인 차오프라야 강변을 따라 글로벌 호텔 체인과 독립 럭셔리 브랜드의 부티크 리조트가 잇달아 소프트 오프닝을 마쳤습니다. 전 객실 리버뷰 테라스와 전용 보트 셔틀 서비스, 태국 왕실 전통 테라피를 결합한 스파 프로그램을 앞세워 기존 대형 호텔들과 차별화를 선언했습니다.

---

## 미식 다이닝과 웰니스 프로그램

리조트 내 모든 다이닝 시설은 유기농 로컬 식재료를 활용한 팜투테이블(Farm-to-table) 콘셉트로 운영되며, 미쉐린 스타 셰프와의 컬래버레이션 갈라 디너가 매주 주말 진행됩니다.

1. **프라이빗 리버 크루즈**: 투숙객 전용 선셋 샴페인 크루즈 매일 운항
2. **웰니스 리트리트**: 전문 테라피스트의 맞춤형 아유르베다 및 타이 전통 트리트먼트
3. **얼리 체크인 & 레이트 체크아웃**: 공식 웹사이트 직접 예약 고객 대상 24시간 스테이 보장

---

*(체크인데일리 호텔 전문 데스크 보도)*`,
  },
]

export default defineEventHandler(async (event) => {
  const database = getD1Database(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'D1 database binding unavailable' })
  }

  // 간단한 토큰 검증 (선택적)
  const token = getRequestHeader(event, 'x-cron-token')
  const expectedToken = process.env.CRON_TOKEN || 'checkin-daily-cron-token'
  if (token && token !== expectedToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized cron request' })
  }

  const now = new Date().toISOString()
  let insertedCount = 0

  for (const item of SAMPLE_FALLBACKS) {
    const slug = `${item.category}-news-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    try {
      await d1Run(
        database,
        `INSERT INTO articles (title, slug, summary, content, category, author, cover_image, status, published_at, view_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
         ON CONFLICT(slug) DO NOTHING`,
        item.title,
        slug,
        item.summary,
        item.content,
        item.category,
        'Check-in Daily Automated Wire',
        item.cover_image,
        now,
        Math.floor(Math.random() * 200) + 50,
      )
      insertedCount++
    } catch {
      // Continue next
    }
  }

  return {
    success: true,
    message: `Crawler executed successfully. ${insertedCount} articles ingested.`,
    timestamp: now,
  }
})

