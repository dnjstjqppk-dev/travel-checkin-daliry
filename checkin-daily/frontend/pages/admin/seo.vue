<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type SeoStatus = 'PENDING' | 'PASS' | 'FAIL'

interface SeoCheckItem {
  item: string
  url: string
  desc: string
  kind: 'endpoint' | 'page'
  sampleUrl?: string
  marker?: string[]
  status: SeoStatus
  detail: string
}

const seoChecklist = ref<SeoCheckItem[]>([
  { item: 'Google News XML 사이트맵', url: '/sitemap.xml', desc: 'Google 뉴스 표준 네임스페이스 및 최근 2일 이내 발행 기사 우선 색인', kind: 'endpoint', marker: ['<urlset', '<sitemapindex'], status: 'PENDING', detail: '검사 대기 중' },
  { item: 'RSS 2.0 뉴스 배포 피드', url: '/rss.xml', desc: '글로벌 뉴스 집계기 및 피드 리더용 실시간 기사 피드', kind: 'endpoint', marker: ['<rss', '<feed'], status: 'PENDING', detail: '검사 대기 중' },
  { item: '검색로봇 지침 (robots.txt)', url: '/robots.txt', desc: '검색엔진 크롤러 허용 및 sitemap.xml 자동 인덱싱 연계', kind: 'endpoint', marker: ['User-agent', 'Sitemap'], status: 'PENDING', detail: '검사 대기 중' },
  { item: 'NewsArticle Schema.org JSON-LD', url: '/news (표본 실측)', desc: 'SSR HTML 내 application/ld+json 구조화 데이터 확인', kind: 'page', sampleUrl: '/news', marker: ['application/ld+json'], status: 'PENDING', detail: '검사 대기 중' },
  { item: '다국어 hreflang 태그 (6개 국어)', url: '/news (표본 실측)', desc: 'ko, en, zh-Hans, th, vi, es 및 x-default 대체 언어 연결', kind: 'page', sampleUrl: '/news', marker: ['hreflang="ko"', 'hreflang="x-default"'], status: 'PENDING', detail: '검사 대기 중' },
  { item: 'OpenGraph & Twitter Card', url: '/news (표본 실측)', desc: 'og:title, og:description, og:image, twitter:card 지원', kind: 'page', sampleUrl: '/news', marker: ['og:title', 'twitter:card'], status: 'PENDING', detail: '검사 대기 중' },
])

const isChecking = ref(false)
const lastCheckedAt = ref('')

async function checkEndpoint(item: SeoCheckItem) {
  try {
    const text = await $fetch<string>(item.url, { responseType: 'text' })
    const hit = (item.marker || []).find((m) => text.includes(m))
    if (hit) {
      item.status = 'PASS'
      item.detail = `HTTP 200 · '${hit}' 마커 확인 (${text.length.toLocaleString()} bytes)`
    } else {
      item.status = 'FAIL'
      item.detail = `HTTP 200 이지만 필수 마커(${(item.marker || []).join(' / ')})가 없습니다`
    }
  } catch (err: any) {
    item.status = 'FAIL'
    item.detail = `요청 실패: ${err?.statusCode ? `HTTP ${err.statusCode}` : (err?.message || '네트워크 오류')}`
  }
}

async function checkPage(item: SeoCheckItem, pageCache: Map<string, string>) {
  const target = item.sampleUrl || '/news'
  try {
    let html = pageCache.get(target)
    if (html === undefined) {
      html = await $fetch<string>(target, { responseType: 'text' })
      pageCache.set(target, html)
    }
    const missing = (item.marker || []).filter((m) => !html.includes(m))
    if (missing.length === 0) {
      item.status = 'PASS'
      item.detail = `${target} SSR HTML에서 ${(item.marker || []).length}개 마커 전부 확인`
    } else {
      item.status = 'FAIL'
      item.detail = `${target} HTML에 마커 누락: ${missing.join(', ')}`
    }
  } catch (err: any) {
    item.status = 'FAIL'
    item.detail = `표본 페이지 요청 실패: ${err?.statusCode ? `HTTP ${err.statusCode}` : (err?.message || '네트워크 오류')}`
  }
}

async function runSeoChecks() {
  if (isChecking.value) return
  isChecking.value = true
  for (const item of seoChecklist.value) {
    item.status = 'PENDING'
    item.detail = '검사 중…'
  }
  const pageCache = new Map<string, string>()
  for (const item of seoChecklist.value) {
    if (item.kind === 'endpoint') {
      await checkEndpoint(item)
    } else {
      await checkPage(item, pageCache)
    }
  }
  lastCheckedAt.value = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  isChecking.value = false
}

onMounted(() => {
  runSeoChecks()
})
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">SEARCH ENGINE VISIBILITY / SEO & SITEMAP</p>
        <h1>SEO 및 구글 뉴스 검색 최적화 검증</h1>
        <p class="admin-heading-copy">Google 뉴스, 네이버 서치어드바이저 및 검색엔진 색인 표준 준수 상태를 실측합니다. 페이지 진입 시 자동 검사되며, 재검사 버튼으로 다시 측정할 수 있습니다.</p>
      </div>
      <div class="seo-actions">
        <button class="btn-recheck" :disabled="isChecking" @click="runSeoChecks">
          {{ isChecking ? '검사 중…' : '↻ 재검사' }}
        </button>
        <p v-if="lastCheckedAt" class="text-sub">마지막 검사: {{ lastCheckedAt }} (KST)</p>
      </div>
    </div>

    <div class="seo-table-panel">
      <h2>핵심 SEO 인프라 검증 현황</h2>
      <table class="admin-table">
        <thead>
          <tr>
            <th>점검 항목</th>
            <th>엔드포인트 / 적용 대상</th>
            <th>측정 상태</th>
            <th>측정 결과</th>
            <th>확인</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in seoChecklist" :key="item.item">
            <td><strong>{{ item.item }}</strong></td>
            <td class="text-mono">{{ item.url }}</td>
            <td>
              <span v-if="item.status === 'PASS'" class="badge badge-success">PASS</span>
              <span v-else-if="item.status === 'FAIL'" class="badge badge-danger">FAIL</span>
              <span v-else class="badge badge-pending">검사 중</span>
            </td>
            <td><small>{{ item.detail }}</small><br><small class="text-sub">{{ item.desc }}</small></td>
            <td>
              <a :href="item.kind === 'endpoint' ? item.url : (item.sampleUrl || '/news')" target="_blank" class="btn-check">직접 확인 ↗</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="seo-tips-box">
      <h3>Google 뉴스 색인 및 품질 가이드라인 준수</h3>
      <ul>
        <li><strong>중복 콘텐츠 방지:</strong> 모든 기사는 고유한 canonical URL을 보유하며, SHA-256 해시를 통한 중복 기사 수집 방지가 적용됩니다.</li>
        <li><strong>날짜 신뢰성:</strong> 최초 게시일(`first_published_at`)과 수정일(`updated_at`)이 명확히 분리 관리되어 시간 왜곡이 발생하지 않습니다.</li>
        <li><strong>투명한 바이라인:</strong> 작성자 및 체크인데일리 편집국 정보가 본문과 구조화 데이터(JSON-LD)에 100% 일치하도록 보장됩니다.</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.seo-table-panel {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 24px;
  margin-bottom: 24px;
}
.seo-table-panel h2 {
  font-size: 16px;
  font-weight: 800;
  color: var(--admin-heading);
  margin: 0 0 16px;
}
.text-mono {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
}
.badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'DM Mono', monospace;
}
.badge-success { background: var(--accent-dim); color: var(--accent); }
.badge-danger { background: var(--red-dim); color: var(--red); }
.badge-pending { background: rgba(148, 163, 184, 0.15); color: var(--text-muted); }
.seo-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.seo-actions p {
  margin: 0;
}
.btn-recheck {
  font-size: 12px;
  font-weight: 800;
  color: var(--on-accent);
  background: var(--accent);
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-recheck:disabled {
  opacity: 0.6;
  cursor: wait;
}
.btn-check {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  text-decoration: underline;
}
.text-sub {
  color: var(--admin-muted);
  font-size: 11px;
}
.seo-tips-box {
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 20px 24px;
}
.seo-tips-box h3 {
  font-size: 15px;
  font-weight: 800;
  margin: 0 0 10px;
  color: var(--admin-heading);
}
.seo-tips-box ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--admin-text);
  line-height: 1.8;
}
</style>

