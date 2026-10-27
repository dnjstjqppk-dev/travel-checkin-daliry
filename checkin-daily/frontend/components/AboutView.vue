<script setup lang="ts">
import { siteConfig } from '~/config/site.config'

const { locUrl } = useI18n()

useSeoMeta({
  title: `About Us | ${siteConfig.brandName} ${siteConfig.brandSubname}`,
  description: `${siteConfig.slogan} - 체크인데일리 소개 및 편집국 윤리 강령`,
})
</script>

<template>
  <div class="bkp-page-container about-page">
    <nav class="bkp-breadcrumb-nav" aria-label="현재 위치">
      <NuxtLink :to="locUrl('/news')" class="bkp-bc-link">HOME</NuxtLink>
      <span class="bkp-bc-sep">›</span>
      <span class="bkp-bc-current">ABOUT US</span>
    </nav>

    <header class="about-header">
      <span class="about-eyebrow">THE WORLD'S WINDOW ON TRAVEL JOURNALISM</span>
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
  padding: 24px 0 60px;
}
.about-header {
  margin-bottom: 36px;
  border-bottom: 2px solid #060D81;
  padding-bottom: 20px;
}
.about-eyebrow {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: #D0021B;
  letter-spacing: 1px;
  display: block;
  margin-bottom: 8px;
}
.about-title {
  font-size: 28px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 12px;
  line-height: 1.3;
}
.about-lead {
  font-size: 15px;
  color: #4B5563;
  line-height: 1.7;
  max-width: 840px;
  margin: 0;
}
.about-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  margin-bottom: 40px;
}
.about-card {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 24px;
}
.card-icon {
  font-size: 32px;
  margin-bottom: 12px;
}
.about-card h2 {
  font-size: 17px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 8px;
}
.about-card p {
  font-size: 13px;
  color: #4B5563;
  line-height: 1.6;
  margin: 0;
}
.about-legal-section {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 24px 28px;
}
.about-legal-section h2 {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 16px;
}
.legal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.legal-table th {
  width: 180px;
  text-align: left;
  padding: 10px 14px;
  background: #F3F4F6;
  color: #374151;
  border-bottom: 1px solid #E5E7EB;
}
.legal-table td {
  padding: 10px 14px;
  color: #111827;
  border-bottom: 1px solid #E5E7EB;
}
@media (max-width: 800px) {
  .about-grid {
    grid-template-columns: 1fr;
  }
}
</style>

