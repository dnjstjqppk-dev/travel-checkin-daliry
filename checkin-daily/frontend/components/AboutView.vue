<script setup lang="ts">
import { siteConfig } from '~/config/site.config'

const { locUrl } = useI18n()

useSeoMeta({
  title: `About Us | ${siteConfig.brandName} ${siteConfig.brandSubname}`,
  description: `${siteConfig.slogan} - 체크인데일리 소개 및 편집국 윤리 강령`,
})
</script>

<template>
  <div class="ttr-page-container about-page">
    <nav class="ttr-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink :to="locUrl('/news')" class="ttr-bc-link">HOME</NuxtLink>
      <span class="ttr-bc-sep">/</span>
      <span class="ttr-bc-current">ABOUT US</span>
    </nav>

    <header class="about-header">
      <div class="ttr-kicker-tag">
        <span class="ping-dot" />
        <span>THE WORLD'S WINDOW ON TRAVEL JOURNALISM</span>
      </div>
      <h1 class="about-title">글로벌 여행 인텔리전스 디지털 뉴스룸, 체크인데일리</h1>
      <p class="about-lead">
        체크인데일리(Check-in Daily)는 전 세계 항공, 호텔, 여행 정책, 그리고 관광 거시경제 데이터를 가장 신속하고 정확하게 분석하여 전달하는 글로벌 여행 전문 디지털 미디어 플랫폼입니다.
      </p>
    </header>

    <div class="about-grid">
      <section class="about-card">
        <div class="card-icon">✈️</div>
        <h2>항공 & 모빌리티 저널리즘</h2>
        <p>국제항공운송협회(IATA) 및 전 세계 주요 항공사들의 공식 운항 스케줄, 신규 취항, 항공권 발권 동향, 마일리지 정책 개편을 심층 취재합니다.</p>
      </section>

      <section class="about-card">
        <div class="card-icon">🏨</div>
        <h2>호스피탈리티 & 리조트 인텔리전스</h2>
        <p>글로벌 호텔 체인, 풀빌라, 부티크 리조트의 개관 및 오프닝, 멤버십 프로그램, 로컬 미식 다이닝 트렌드를 객관적인 시각으로 검증 보도합니다.</p>
      </section>

      <section class="about-card">
        <div class="card-icon">🌐</div>
        <h2>관광 정책 & 비자 정보</h2>
        <p>각국 정부 관광청(TAT 등), 이민국, 외교부의 공식 발표에 근거하여 입국 규정, 비자(DTV 등), 여행 안전 정보를 왜곡 없이 신속하게 전합니다.</p>
      </section>
    </div>

    <section class="about-legal-section">
      <h2>사업자 및 편집국 등록 정보</h2>
      <div class="legal-table-wrap">
        <table class="legal-table">
          <tbody>
            <tr><th>미디어 명칭</th><td>{{ siteConfig.brandName }} {{ siteConfig.brandSubname }} (체크인데일리)</td></tr>
            <tr><th>발행·편집인</th><td>{{ siteConfig.publisher.editorInChief }}</td></tr>
            <tr><th>정기간행물 등록번호</th><td>{{ siteConfig.publisher.registrationNumber }}</td></tr>
            <tr><th>발행소 소재지</th><td>{{ siteConfig.publisher.address }}</td></tr>
            <tr><th>편집국 대표 문의</th><td>{{ siteConfig.publisher.email }}</td></tr>
            <tr><th>제휴 트래픽 플랫폼</th><td>트립스캐너 (TripScanner) · 겟포트립 (GetForTrip)</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.about-page {
  max-width: 1200px;
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
  color: #8b949e;
  letter-spacing: 0.8px;
}

.ttr-bc-link {
  color: #8b949e;
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

.about-header {
  margin-bottom: 40px;
  border-bottom: 1px solid #23253a;
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

.about-title {
  font-size: 28px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 14px;
  line-height: 1.3;
  letter-spacing: -0.6px;
}

.about-lead {
  font-size: 15px;
  color: #8b949e;
  line-height: 1.7;
  max-width: 880px;
  margin: 0;
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  margin-bottom: 40px;
}

.about-card {
  background: #13141f;
  border: 1px solid #23253a;
  border-radius: 8px;
  padding: 24px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s;
}

.about-card:hover {
  border-color: #00d4aa;
}

.about-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #00d4aa, transparent);
}

.card-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.about-card h2 {
  font-size: 17px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 10px;
}

.about-card p {
  font-size: 13px;
  color: #8b949e;
  line-height: 1.6;
  margin: 0;
}

.about-legal-section {
  background: #13141f;
  border: 1px solid #23253a;
  border-radius: 8px;
  padding: 24px 28px;
}

.about-legal-section h2 {
  font-size: 17px;
  font-weight: 800;
  color: #e6edf3;
  margin: 0 0 16px;
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.5px;
}

.legal-table-wrap {
  overflow-x: auto;
}

.legal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.legal-table th {
  width: 180px;
  text-align: left;
  padding: 12px 16px;
  background: #181927;
  color: #8b949e;
  border-bottom: 1px solid #23253a;
  font-weight: 700;
}

.legal-table td {
  padding: 12px 16px;
  color: #c9d1d9;
  border-bottom: 1px solid #23253a;
}

@media (max-width: 800px) {
  .about-grid {
    grid-template-columns: 1fr;
  }
}
</style>

