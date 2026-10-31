<script setup lang="ts">
definePageMeta({ layout: 'admin' })
import { siteConfig } from '~/config/site.config'

const saving = ref(false)
const saveSuccess = ref('')
const saveError = ref('')

const form = reactive({
  company_name: '',
  representative: '',
  business_number: '',
  mail_order_number: '',
  newspaper_number: '',
  youth_protection_officer: '',
  publisher: '',
  address: '',
  contact_email: '',
  contact_phone: '',
  site_url: '',
  brand_name: '',
  brand_subname: '',
  slogan: '',
})

// Load current settings from /api/settings
const { data: initialSettings, refresh } = await useAsyncData<Record<string, string>>('admin-site-settings', async () => {
  try {
    const res = await $fetch<Record<string, string>>('/api/settings')
    return res || {}
  } catch {
    return {}
  }
})

watch(initialSettings, (s) => {
  if (s) {
    const data = s as Record<string, string>
    form.company_name = data.company_name || siteConfig.publisher.name
    form.representative = data.representative || siteConfig.publisher.editorInChief
    form.business_number = data.business_number || '2026-04-52914'
    form.mail_order_number = data.mail_order_number || '2026-서울중구-0123'
    form.newspaper_number = data.newspaper_number || siteConfig.publisher.registrationNumber
    form.youth_protection_officer = data.youth_protection_officer || form.representative
    form.publisher = data.publisher || form.representative
    form.address = data.address || siteConfig.publisher.address
    form.contact_email = data.contact_email || siteConfig.publisher.email
    form.contact_phone = data.contact_phone || '02-738-2026'
    form.site_url = data.site_url || siteConfig.domain
    form.brand_name = data.brand_name || siteConfig.brandName
    form.brand_subname = data.brand_subname || siteConfig.brandSubname
    form.slogan = data.slogan || siteConfig.slogan
  }
}, { immediate: true })

async function saveSettings() {
  saving.value = true
  saveSuccess.value = ''
  saveError.value = ''
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: form,
    })
    saveSuccess.value = '✓ 사이트 설정 및 법적 공시 정보가 성공적으로 저장되었습니다 (실시간 푸터 1초 반영 완료).'
    await refresh()
    setTimeout(() => {
      saveSuccess.value = ''
    }, 4000)
  } catch (err: any) {
    saveError.value = err?.data?.message || err?.message || '설정 저장 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="admin-wrap">
    <div class="admin-page-heading">
      <div>
        <p class="admin-overline">SYSTEM SETTINGS / MASTER CONFIGURATION</p>
        <h1>뉴스룸 미디어그룹 및 발행 정보 설정</h1>
        <p class="admin-heading-copy">
          사이트 하단 푸터, 법적 필수 고지, 정식 도메인 및 언론사 등록 정보를 실시간으로 수정하고 즉시 반영합니다.
        </p>
      </div>
      <button
        class="button button-primary"
        type="button"
        :disabled="saving"
        @click="saveSettings"
      >
        {{ saving ? '저장 중...' : '💾 설정 저장 (1초 즉시 반영)' }}
      </button>
    </div>

    <div v-if="saveSuccess" class="alert alert-success">{{ saveSuccess }}</div>
    <div v-if="saveError" class="alert alert-error">{{ saveError }}</div>

    <form class="settings-form" @submit.prevent="saveSettings">
      <div class="settings-grid">
        <!-- 1. 법적 필수 공시 정보 -->
        <div class="settings-card">
          <h2>🏢 발행사 및 법적 공시 정보 (전자상거래법 & 신문법)</h2>
          <div class="form-fields">
            <label class="field">
              발행 법인 상호명 *
              <input v-model="form.company_name" required placeholder="예: (주)체크인데일리미디어">
            </label>
            <label class="field">
              대표자 성명 *
              <input v-model="form.representative" required placeholder="예: 홍길동">
            </label>
            <label class="field">
              사업자등록번호 *
              <input v-model="form.business_number" required placeholder="예: 123-45-67890">
            </label>
            <label class="field">
              통신판매업신고번호 *
              <input v-model="form.mail_order_number" required placeholder="예: 2026-서울중구-0123">
            </label>
            <label class="field">
              인터넷신문 등록번호 *
              <input v-model="form.newspaper_number" required placeholder="예: 서울 아-52914">
            </label>
            <label class="field">
              발행인 / 편집인 *
              <input v-model="form.publisher" required placeholder="예: 홍길동">
            </label>
            <label class="field">
              청소년보호책임자 *
              <input v-model="form.youth_protection_officer" required placeholder="예: 홍길동">
            </label>
            <label class="field full">
              발행소 사업장 주소 *
              <input v-model="form.address" required placeholder="예: 서울특별시 중구 을지로 100 파인에비뉴 B동">
            </label>
            <label class="field">
              대표 전화번호 *
              <input v-model="form.contact_phone" required placeholder="예: 02-738-2026">
            </label>
            <label class="field">
              편집국 공식 이메일 *
              <input v-model="form.contact_email" required type="email" placeholder="editorial@checkindaily.com">
            </label>
          </div>
        </div>

        <!-- 2. 브랜드 & 도메인 설정 -->
        <div class="settings-card">
          <h2>🌐 브랜드 및 도메인 연동 설정 (Master Template)</h2>
          <div class="form-fields">
            <label class="field full">
              공식 서비스 도메인 (URL) *
              <input v-model="form.site_url" required placeholder="https://checkindaily.com">
              <small class="field-hint">자체 도메인 컷오버 시 이 주소가 Sitemap, RSS, Open Graph의 표준 베이스 URL로 작동합니다.</small>
            </label>
            <label class="field">
              브랜드 명칭 (Main)
              <input v-model="form.brand_name" required placeholder="CHECK-IN">
            </label>
            <label class="field">
              브랜드 서브명칭 (Sub)
              <input v-model="form.brand_subname" required placeholder="DAILY">
            </label>
            <label class="field full">
              브랜드 공식 슬로건
              <input v-model="form.slogan" required placeholder="The World’s Window on Travel Journalism">
            </label>
            <div class="field full info-box">
              <h3>💡 자체 도메인(checkindaily.com) 연결 팁</h3>
              <p>Cloudflare Workers & Pages 대시보드의 <strong>Custom Domains</strong>에서 <code>checkindaily.com</code>을 추가한 뒤, 위 '공식 서비스 도메인'을 <code>https://checkindaily.com</code>으로 설정하시면 1초 만에 전 사이트의 메타 태그와 사이트맵이 전환됩니다.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="form-submit-row">
        <button
          class="button button-primary action-btn-large"
          type="submit"
          :disabled="saving"
        >
          {{ saving ? '저장 중...' : '💾 법적 공시 및 사이트 설정 즉시 저장' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.settings-form {
  margin-top: 20px;
}
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.settings-card {
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 8px;
  padding: 24px;
}
.settings-card h2 {
  font-size: 16px;
  font-weight: 800;
  color: var(--admin-heading);
  margin: 0 0 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--admin-border);
}
.form-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--admin-text);
}
.field.full {
  grid-column: 1 / -1;
}
.field input, .field select {
  background: var(--admin-input);
  height: 40px;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--admin-heading);
}
.field input:focus {
  border-color: var(--accent);
  outline: none;
}
.field-hint {
  font-size: 12px;
  font-weight: normal;
  color: var(--admin-muted);
  margin-top: 4px;
}
.info-box {
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 14px;
  margin-top: 8px;
}
.info-box h3 {
  font-size: 13px;
  font-weight: 800;
  color: var(--accent);
  margin: 0 0 6px;
}
.info-box p {
  font-size: 12px;
  color: var(--admin-text);
  line-height: 1.5;
  margin: 0;
}
.form-submit-row {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}
.action-btn-large {
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 800;
}
@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
