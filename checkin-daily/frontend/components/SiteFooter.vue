<script setup lang="ts">
import { siteConfig } from '~/config/site.config'

const { t, locUrl } = useI18n()

// Fetch dynamic legal and publisher information from /api/settings
const { data: settings } = await useAsyncData<Record<string, string>>('site-settings', async () => {
  try {
    const res = await $fetch<Record<string, string>>('/api/settings')
    return res || {}
  } catch {
    return {}
  }
})

const settingsMap = computed<Record<string, string>>(() => (settings.value as Record<string, string>) || {})

const companyName = computed(() => settingsMap.value.company_name || siteConfig.publisher.name)
const representative = computed(() => settingsMap.value.representative || siteConfig.publisher.editorInChief)
const businessNumber = computed(() => settingsMap.value.business_number || '')
const mailOrderNumber = computed(() => settingsMap.value.mail_order_number || '')
const newspaperNumber = computed(() => settingsMap.value.newspaper_number || '')
const youthProtectionOfficer = computed(() => settingsMap.value.youth_protection_officer || representative.value)
const publisher = computed(() => settingsMap.value.publisher || representative.value)
const address = computed(() => settingsMap.value.address || siteConfig.publisher.address)
const contactEmail = computed(() => settingsMap.value.contact_email || siteConfig.publisher.email)
const contactPhone = computed(() => settingsMap.value.contact_phone || '')
</script>

<template>
  <footer class="bkp-site-footer">
    <div class="bkp-footer-main">
      <div class="bkp-page-container bkp-footer-grid">
        <div class="bkp-fcol brand-col">
          <NuxtLink :to="locUrl('/news')" class="bkp-footer-logo">
            <img src="/logo-white.svg" :alt="siteConfig.brandName" class="bkp-footer-vector-logo" width="280" height="46">
          </NuxtLink>
          <p class="bkp-footer-summary">
            {{ t('footer_tagline') }}
          </p>
          <div class="bkp-footer-meta-tags">
            <span>EDITORIAL OFFICE: SEOUL & BANGKOK</span>
            <span>•</span>
            <span>EST. 2026</span>
          </div>
        </div>

        <div class="bkp-fcol">
          <h4>{{ t('sections').toUpperCase() }}</h4>
          <ul>
            <li><NuxtLink :to="locUrl('/news')">{{ t('all_news') }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/news/major')">{{ t('major') }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/news/airline')">{{ t('airline') }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/news/hotel')">{{ t('hotel') }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/news/destination')">{{ t('destination') }}</NuxtLink></li>
          </ul>
        </div>

        <div class="bkp-fcol">
          <h4>{{ t('my_services').toUpperCase() }}</h4>
          <ul>
            <li><NuxtLink :to="locUrl('/news/realtime')">{{ t('realtime') }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/news/region')">{{ t('region') }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/saved')">{{ t('saved') }}</NuxtLink></li>
            <li><NuxtLink to="/admin/login">{{ t('admin_login') }}</NuxtLink></li>
          </ul>
        </div>

        <div class="bkp-fcol">
          <h4>LEGAL & POLICY</h4>
          <ul>
            <li><NuxtLink :to="locUrl('/policy')">이용약관</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/policy#privacy')">개인정보처리방침</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/about')">편집 규약 및 윤리 강령</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/corrections')">정정보도 청구 센터</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/contact')">제휴 및 취재 문의</NuxtLink></li>
          </ul>
        </div>
      </div>
    </div>

    <div class="bkp-footer-bottom">
      <div class="bkp-page-container bkp-footer-legal-row">
        <span>© 2026 {{ companyName.toUpperCase() }}. ALL RIGHTS RESERVED.</span>
        <span>
          {{ companyName }} | 대표자: {{ representative }} | 발행인·편집인: {{ publisher }} | 사업자등록번호: {{ businessNumber }} | 통신판매업신고: {{ mailOrderNumber }} | 인터넷신문등록번호: {{ newspaperNumber }} | 청소년보호책임자: {{ youthProtectionOfficer }}
        </span>
        <span>
          주소: {{ address }} | 대표전화: {{ contactPhone }} | 편집국 문의: {{ contactEmail }} | 모든 기사는 저작권법의 보호를 받습니다.
        </span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.bkp-site-footer {
  background: var(--bg-secondary, #13141f);
  border-top: 1px solid var(--border, #23253a);
  color: var(--text-muted, #8e99aa);
  font-size: 12px;
}

.bkp-footer-main {
  padding: 40px 0 30px;
}

.bkp-footer-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr;
  gap: 32px;
}

.bkp-fcol h4 {
  margin: 0 0 16px;
  font-size: 11px;
  font-weight: 800;
  color: var(--text-primary, #f0f4f8);
  letter-spacing: 0.8px;
}

.bkp-fcol ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bkp-fcol ul a {
  color: var(--text-muted, #8e99aa);
  text-decoration: none;
  transition: color 0.15s;
}

.bkp-fcol ul a:hover {
  color: var(--accent, #00d4aa);
}

.brand-col .bkp-footer-logo {
  display: inline-block;
  margin-bottom: 12px;
}

.brand-col .bkp-footer-summary {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--text-secondary, #d2d9e3);
  line-height: 1.6;
}

.brand-col .bkp-footer-meta-tags {
  display: flex;
  gap: 8px;
  font-size: 10.5px;
  color: var(--text-dim, #7d8696);
  font-weight: 700;
}

.bkp-footer-bottom {
  border-top: 1px solid var(--border, #23253a);
  padding: 20px 0;
  background: rgba(0, 0, 0, 0.2);
}

.bkp-footer-legal-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  color: var(--text-dim, #7d8696);
  line-height: 1.5;
}

@media (max-width: 900px) {
  .bkp-footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 600px) {
  .bkp-footer-grid {
    grid-template-columns: 1fr;
  }
}
</style>

