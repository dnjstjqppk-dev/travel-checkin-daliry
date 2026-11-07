<script setup lang="ts">
const { t, locUrl } = useI18n()

// Publisher and statutory details come only from admin settings (/admin/settings).
// Nothing is rendered for a field that has not been configured.
const { data: settings } = await useAsyncData<Record<string, string>>('site-settings', async () => {
  try {
    return (await $fetch<Record<string, string>>('/api/settings')) || {}
  } catch {
    return {}
  }
})

const value = (key: string) => String(settings.value?.[key] || '').trim()
const companyName = computed(() => value('company_name') || 'Check-in Daily')

// Korean internet-newspaper statutory notice (신문법 시행규칙). Labels stay Korean by law.
const statutory = computed(() => [
  ['대표자', value('representative')],
  ['발행인·편집인', value('publisher')],
  ['사업자등록번호', value('business_number')],
  ['통신판매업신고', value('mail_order_number')],
  ['인터넷신문등록번호', value('newspaper_number')],
  ['청소년보호책임자', value('youth_protection_officer')],
  ['주소', value('address')],
  ['대표전화', value('contact_phone')],
  ['이메일', value('contact_email')],
].filter(([, v]) => v))

const SECTIONS = ['major', 'airline', 'hotel', 'destination', 'realtime', 'region'] as const
</script>

<template>
  <footer class="bkp-site-footer">
    <div class="bkp-footer-main">
      <div class="bkp-page-container bkp-footer-grid">
        <div class="bkp-fcol brand-col">
          <NuxtLink :to="locUrl('/news')" class="bkp-footer-logo">
            <img src="/logo.svg" alt="Check-in Daily" class="bkp-footer-vector-logo" width="280" height="46">
          </NuxtLink>
          <p class="bkp-footer-summary">{{ t('footer_tagline') }}</p>
        </div>

        <div class="bkp-fcol">
          <h2 class="footer-heading">{{ t('sections') }}</h2>
          <ul>
            <li><NuxtLink :to="locUrl('/news')">{{ t('all_news') }}</NuxtLink></li>
            <li v-for="slug in SECTIONS" :key="slug"><NuxtLink :to="locUrl(`/news/${slug}`)">{{ t(slug) }}</NuxtLink></li>
          </ul>
        </div>

        <div class="bkp-fcol">
          <h2 class="footer-heading">{{ t('footer_about') }}</h2>
          <ul>
            <li><NuxtLink :to="locUrl('/about')">{{ t('footer_about_us') }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/policy')">{{ t('editorial_policy') }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/policy#privacy')">{{ t('footer_privacy') }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/corrections')">{{ t('request_correction') }}</NuxtLink></li>
            <li><NuxtLink :to="locUrl('/contact')">{{ t('footer_contact') }}</NuxtLink></li>
          </ul>
        </div>

        <div class="bkp-fcol">
          <h2 class="footer-heading">RSS</h2>
          <ul>
            <li><a href="/rss.xml">RSS 2.0</a></li>
            <li><a href="/atom.xml">Atom</a></li>
            <li><a href="/sitemap.xml">Sitemap</a></li>
          </ul>
        </div>
      </div>
    </div>

    <div class="bkp-footer-bottom">
      <div class="bkp-page-container bkp-footer-legal-row">
        <span>© {{ new Date().getFullYear() }} {{ companyName }}</span>
        <span v-if="statutory.length">
          <template v-for="([label, text], index) in statutory" :key="label">{{ index ? ' | ' : '' }}{{ label }}: {{ text }}</template>
        </span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer-heading { margin: 0 0 16px; font-family: var(--font-sans); font-size: 13px; font-weight: 800; color: var(--text-primary); letter-spacing: 0; }
</style>

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
  color: var(--accent);
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

