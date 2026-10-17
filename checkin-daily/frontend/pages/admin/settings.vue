<script setup lang="ts">
definePageMeta({ layout: 'admin' })
import { siteConfig } from '~/config/site.config'
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">SYSTEM SETTINGS / MASTER CONFIGURATION</p>
        <h1>뉴스룸 미디어그룹 및 발행 정보 설정</h1>
        <p class="admin-heading-copy">마스터 아키텍처 설정 파일(site.config.ts)의 발행인 정보 및 브랜딩 구성을 확인합니다.</p>
      </div>
    </div>

    <div class="settings-grid">
      <div class="settings-card">
        <h2>발행사 및 법적 공시 정보</h2>
        <table class="settings-table">
          <tbody>
            <tr><th>미디어 명칭</th><td>{{ siteConfig.brandName }} {{ siteConfig.brandSubname }}</td></tr>
            <tr><th>발행 법인</th><td>{{ siteConfig.publisher.name }}</td></tr>
            <tr><th>편집인 겸 발행인</th><td>{{ siteConfig.publisher.editorInChief }}</td></tr>
            <tr><th>간행물 등록번호</th><td>{{ siteConfig.publisher.registrationNumber }}</td></tr>
            <tr><th>발행소 주소</th><td>{{ siteConfig.publisher.address }}</td></tr>
            <tr><th>대표 이메일</th><td>{{ siteConfig.publisher.email }}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="settings-card">
        <h2>브랜드 슬로건 및 도메인 설정</h2>
        <table class="settings-table">
          <tbody>
            <tr><th>운영 도메인</th><td class="text-mono">{{ siteConfig.domain }}</td></tr>
            <tr><th>플랫폼 식별자</th><td class="text-mono">{{ siteConfig.siteId }}</td></tr>
            <tr><th>브랜드 슬로건</th><td>{{ siteConfig.slogan }}</td></tr>
            <tr><th>테마 프라이머리 컬러</th><td><span class="color-pill" :style="{ background: siteConfig.theme.primaryColor }" /> {{ siteConfig.theme.primaryColor }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.settings-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 24px;
}
.settings-card h2 {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  margin: 0 0 16px;
}
.settings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.settings-table th {
  width: 140px;
  text-align: left;
  padding: 8px 10px;
  background: #F9FAFB;
  color: #4B5563;
  border-bottom: 1px solid #E5E7EB;
}
.settings-table td {
  padding: 8px 10px;
  color: #111827;
  border-bottom: 1px solid #E5E7EB;
}
.text-mono {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
}
.color-pill {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-right: 4px;
  vertical-align: middle;
}
@media (max-width: 800px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>

