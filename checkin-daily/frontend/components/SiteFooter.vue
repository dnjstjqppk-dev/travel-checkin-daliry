<script setup lang="ts">
import { siteConfig } from '~/config/site.config'

const { t, locUrl } = useI18n()

// Fetch dynamic legal and publisher information from /api/settings
const { data: settings } = await useAsyncData('site-settings', () =>
  $fetch<Record<string, string>>('/api/settings').catch(() => ({}))
)

const companyName = computed(() => settings.value?.company_name || siteConfig.publisher.name)
const representative = computed(() => settings.value?.representative || siteConfig.publisher.editorInChief)
const businessNumber = computed(() => settings.value?.business_number || '2026-04-52914')
const mailOrderNumber = computed(() => settings.value?.mail_order_number || '2026-서울중구-0123')
const newspaperNumber = computed(() => settings.value?.newspaper_number || siteConfig.publisher.registrationNumber)
const youthProtectionOfficer = computed(() => settings.value?.youth_protection_officer || representative.value)
const publisher = computed(() => settings.value?.publisher || representative.value)
const address = computed(() => settings.value?.address || siteConfig.publisher.address)
const contactEmail = computed(() => settings.value?.contact_email || siteConfig.publisher.email)
const contactPhone = computed(() => settings.value?.contact_phone || '02-738-2026')
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

