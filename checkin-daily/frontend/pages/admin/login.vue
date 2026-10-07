<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const route = useRoute()
const router = useRouter()
const username = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref('')

function safeRedirect(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/admin/') || value.startsWith('//') || value === '/admin/login') {
    return '/admin/dashboard'
  }
  return value
}

async function submit() {
  submitting.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    password.value = ''
    await router.replace(safeRedirect(route.query.redirect))
  } catch (cause) {
    const status = (cause as { statusCode?: number }).statusCode
    error.value = status === 429
      ? '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.'
      : '아이디 또는 비밀번호를 확인해 주세요.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="auth-card">
    <NuxtLink class="wordmark auth-wordmark" to="/news"><span class="wordmark-mark">C.</span><span>CHECK-IN <b>DAILY</b></span></NuxtLink>
    <p class="eyebrow">PRIVATE EDITOR ACCESS</p>
    <h1>관리자 로그인</h1>
    <p class="auth-description">뉴스룸 관리 페이지는 승인된 관리자만 이용할 수 있습니다.</p>
    <form class="auth-form" @submit.prevent="submit">
      <label class="field">아이디 또는 이메일<input v-model="username" required maxlength="254" autocomplete="username" autofocus></label>
      <label class="field">비밀번호<input v-model="password" required type="password" maxlength="1024" autocomplete="current-password"></label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="button button-primary" type="submit" :disabled="submitting">{{ submitting ? '확인 중...' : '로그인' }}</button>
    </form>
    <NuxtLink class="auth-back-link" to="/news">← 뉴스 홈으로</NuxtLink>
  </section>
</template>
