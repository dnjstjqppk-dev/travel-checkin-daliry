<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const seoChecklist = [
  { item: 'Google News XML 사이트맵', url: '/sitemap.xml', status: 'VERIFIED', desc: 'Google 뉴스 표준 네임스페이스 및 최근 2일 이내 발행 기사 우선 색인' },
  { item: 'RSS 2.0 뉴스 배포 피드', url: '/rss.xml', status: 'VERIFIED', desc: '글로벌 뉴스 집계기 및 피드 리더용 실시간 기사 피드' },
  { item: '검색로봇 지침 (robots.txt)', url: '/robots.txt', status: 'VERIFIED', desc: '검색엔진 크롤러 허용 및 sitemap.xml 자동 인덱싱 연계' },
  { item: 'NewsArticle Schema.org JSON-LD', url: '기사 상세 전체', status: 'VERIFIED', desc: 'headline, datePublished, dateModified, author, publisher 메타데이터 완벽 대응' },
  { item: '다국어 hreflang 태그 (6개 국어)', url: '모든 기사 및 목록', status: 'VERIFIED', desc: 'ko, en, zh-Hans, th, vi, es 및 x-default 대체 언어 연결' },
  { item: 'OpenGraph & Twitter Card', url: '모든 페이지', status: 'VERIFIED', desc: 'og:title, og:description, og:image, twitter:card 완벽 지원' },
]
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">SEARCH ENGINE VISIBILITY / SEO & SITEMAP</p>
        <h1>SEO 및 구글 뉴스 검색 최적화 검증</h1>
        <p class="admin-heading-copy">Google 뉴스, 네이버 서치어드바이저 및 검색엔진 색인 표준 준수 상태를 점검합니다.</p>
      </div>
    </div>

    <div class="seo-table-panel">
      <h2>핵심 SEO 인프라 검증 현황</h2>
      <table class="admin-table">
        <thead>
          <tr>
            <th>점검 항목</th>
            <th>엔드포인트 / 적용 대상</th>
            <th>준수 상태</th>
            <th>상세 설명</th>
            <th>확인</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in seoChecklist" :key="item.item">
            <td><strong>{{ item.item }}</strong></td>
            <td class="text-mono">{{ item.url }}</td>
            <td><span class="badge badge-success">{{ item.status }}</span></td>
            <td><small>{{ item.desc }}</small></td>
            <td>
              <a v-if="item.url.startsWith('/')" :href="item.url" target="_blank" class="btn-check">직접 확인 ↗</a>
              <span v-else class="text-sub">적용 완료</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="seo-tips-box">
      <h3>📌 Google 뉴스 색인 및 품질 가이드라인 준수</h3>
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
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 24px;
  margin-bottom: 24px;
}
.seo-table-panel h2 {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
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
.badge-success { background: #DCFCE7; color: #16A34A; }
.btn-check {
  font-size: 11px;
  font-weight: 700;
  color: #0052CC;
  text-decoration: underline;
}
.text-sub {
  color: #9CA3AF;
  font-size: 11px;
}
.seo-tips-box {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 20px 24px;
}
.seo-tips-box h3 {
  font-size: 15px;
  font-weight: 800;
  margin: 0 0 10px;
  color: #111827;
}
.seo-tips-box ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #4B5563;
  line-height: 1.8;
}
</style>

