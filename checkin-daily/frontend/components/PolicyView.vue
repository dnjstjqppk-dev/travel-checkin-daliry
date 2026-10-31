<script setup lang="ts">
import { siteConfig } from '~/config/site.config'

const { locUrl } = useI18n()

useSeoMeta({
  title: `Editorial & Fact-Checking Policy | ${siteConfig.brandName} ${siteConfig.brandSubname}`,
  description: '체크인데일리 편집 윤리, 사실 검증 규정, 기사 정정 및 저작권 정책',
})
</script>

<template>
  <div class="ttr-page-container policy-page">
    <nav class="ttr-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink :to="locUrl('/news')" class="ttr-bc-link">HOME</NuxtLink>
      <span class="ttr-bc-sep">/</span>
      <span class="ttr-bc-current">EDITORIAL POLICY</span>
    </nav>

    <header class="policy-header">
      <div class="ttr-kicker-tag">
        <span class="ping-dot" />
        <span>EDITORIAL INTEGRITY & COMPLIANCE</span>
      </div>
      <h1 class="policy-title">편집 윤리, 팩트체크 및 저작권 정책</h1>
      <p class="policy-lead">
        체크인데일리는 글로벌 저널리즘 윤리와 저작권 법령을 철저히 준수하며, 신뢰할 수 있는 공식 1차 출처만을 바탕으로 콘텐츠를 생산합니다.
      </p>
    </header>

    <div class="policy-content">
      <section class="policy-section">
        <h2>1. 사실 검증 (Fact-Checking) 원칙</h2>
        <p>본 플랫폼의 모든 보도는 다음의 공식 1차 출처 검증을 필수로 합니다.</p>
        <ul>
          <li><strong>항공/공항:</strong> 해당 항공사 공식 보도자료, 공항 당국(AOT 등), IATA 공식 통계 자료에 명시된 수치 및 일정만을 인용합니다.</li>
          <li><strong>관광/비자:</strong> 정부 기관, 이민국, 국영 관광청(TAT 등)의 정식 고시 및 법령에 근거합니다.</li>
          <li><strong>고위험 보도 차단:</strong> 인명 사고, 테러, 비상사태 관련 이슈는 자동 발행을 엄격히 금지하며 편집국장(Editor-in-Chief)의 최종 서면 승인을 거쳐야만 발행됩니다.</li>
        </ul>
      </section>

      <section class="policy-section">
        <h2>2. 기사 정정 및 철회 (Corrections & Retractions)</h2>
        <p>보도 내용 중 명백한 사실 오류가 확인될 경우, 지체 없이 수정 및 정정 고지를 게재합니다.</p>
        <ul>
          <li><strong>투명한 정정:</strong> 기사 본문 상단에 '기사 정정 고지' 배너를 배치하고, 원문 진술과 수정된 진술, 정정 일시를 영구 보존합니다.</li>
          <li><strong>기사 철회:</strong> 출처의 허위 발표 또는 중대한 법적 하자가 발생한 경우, 기사를 즉시 비공개 철회(Retracted) 상태로 전환하고 사유를 기록합니다.</li>
          <li><strong>독자 정정 신청:</strong> 모든 독자는 <NuxtLink :to="locUrl('/corrections')" class="policy-inline-link">정정 신청 센터</NuxtLink>를 통해 사실 오류 수정을 요청할 수 있습니다.</li>
        </ul>
      </section>

      <section class="policy-section">
        <h2>3. 이미지 및 저작권 (Copyright & Licensing)</h2>
        <ul>
          <li>뉴스 보도용 이미지는 상업적 보도 허가 라이선스(Unsplash Editorial License 등) 및 정부 기관의 공공누리/공식 PR 이미지에 한하여 사용합니다.</li>
          <li>모든 보도 이미지 하단에는 라이선스 출처 및 보도 참고용 캡션을 필수 표기합니다.</li>
          <li>권한이 확인되지 않은 이미지나 무단 캡처 사진의 사용을 엄격히 금지합니다.</li>
        </ul>
      </section>

      <section class="policy-section">
        <h2>4. 제휴 링크 및 상업적 이해관계 고지 (Affiliate Disclosure)</h2>
        <p>체크인데일리는 독자 여러분께 유용한 여행 서비스 정보 제공을 위해 트립스캐너(TripScanner), 겟포트립(GetForTrip) 등 제휴 플랫폼의 링크를 포함할 수 있습니다.</p>
        <ul>
          <li>해당 링크를 통한 구매나 예약 시 플랫폼은 제휴 수수료를 지원받을 수 있으나, 독자에게 추가 비용은 일절 발생하지 않습니다.</li>
          <li>제휴 수수료 발생 여부가 기사의 편집 방향 및 사실 검증 결과에 영향을 미치지 않습니다.</li>
        </ul>
      </section>

      <section class="policy-section">
        <h2>5. 청소년 보호 정책</h2>
        <p>체크인데일리는 청소년보호법에 의거하여 청소년이 유해한 환경으로부터 보호받을 수 있도록 관련 법령을 엄격히 준수합니다.</p>
        <ul>
          <li>청소년 유해 매체물 및 음란·폭력적 내용의 유통을 일절 금지합니다.</li>
          <li>청소년보호책임자: {{ siteConfig.publisher.editorInChief }} ({{ siteConfig.publisher.email }})</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.policy-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px 20px 80px;
}

.ttr-breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  margin-bottom: 20px;
  color: var(--text-muted, #8b949e);
  letter-spacing: 0.8px;
}

.ttr-bc-link {
  color: var(--text-muted, #8b949e);
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s;
}

.ttr-bc-link:hover {
  color: #00d4aa;
}

.ttr-bc-sep {
  color: #383b52;
}

.ttr-bc-current {
  color: #00d4aa;
  font-weight: 700;
}

.policy-header {
  margin-bottom: 40px;
  border-bottom: 1px solid var(--border, #23253a);
  padding-bottom: 24px;
}

.ttr-kicker-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  color: #00d4aa;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.ping-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00d4aa;
  box-shadow: 0 0 8px #00d4aa;
}

.policy-title {
  font-size: 28px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 14px;
  line-height: 1.3;
  letter-spacing: -0.6px;
}

.policy-lead {
  font-size: 15px;
  color: var(--text-muted, #8b949e);
  line-height: 1.7;
  max-width: 880px;
  margin: 0;
}

.policy-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.policy-section {
  background: var(--bg-surface, #13141f);
  border: 1px solid var(--border, #23253a);
  border-radius: 8px;
  padding: 28px 32px;
  position: relative;
  overflow: hidden;
}

.policy-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #00d4aa, transparent);
}

.policy-section h2 {
  font-size: 17px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 14px;
  border-left: 3px solid #00d4aa;
  padding-left: 10px;
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.5px;
}

.policy-section p {
  font-size: 14px;
  color: var(--text-muted, #8b949e);
  line-height: 1.7;
  margin: 0 0 14px;
}

.policy-section ul {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.policy-section li {
  font-size: 13.5px;
  color: var(--text-muted, #8b949e);
  line-height: 1.6;
}

.policy-section strong {
  color: #c9d1d9;
}

.policy-inline-link {
  color: #00d4aa;
  font-weight: 700;
  text-decoration: underline;
}
</style>

