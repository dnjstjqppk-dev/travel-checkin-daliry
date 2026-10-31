<script setup lang="ts">
import { useWebPush } from '~/composables/useWebPush'

const { isSupported, isSubscribed, permission, isLoading, errorMessage, subscribe, unsubscribe } = useWebPush()
const { locale } = useI18n()

const showToast = ref(false)
const toastMessage = ref('')

async function togglePush() {
  if (isLoading.value) return

  if (isSubscribed.value) {
    const ok = await unsubscribe()
    if (ok) {
      triggerToast('속보 웹 푸시 알림이 해제되었습니다.')
    }
  } else {
    const ok = await subscribe(locale.value)
    if (ok) {
      triggerToast('속보 웹 푸시 알림이 등록되었습니다! 🔔')
    } else if (errorMessage.value) {
      triggerToast(errorMessage.value)
    }
  }
}

function triggerToast(msg: string) {
  toastMessage.value = msg
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 3500)
}
</script>

<template>
  <div v-if="isSupported" class="push-bell-wrap">
    <button
      class="push-bell-btn"
      :class="{ 'is-active': isSubscribed, 'is-loading': isLoading }"
      type="button"
      :title="isSubscribed ? '속보 푸시 알림 수신 중 (클릭하여 해제)' : '실시간 속보 웹 푸시 알림 받기'"
      aria-label="속보 푸시 알림 토글"
      :disabled="isLoading"
      @click="togglePush"
    >
      <span v-if="isLoading" class="bell-spinner" aria-hidden="true" />
      <svg
        v-else
        width="16"
        height="16"
        viewBox="0 0 24 24"
        :fill="isSubscribed ? 'currentColor' : 'none'"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span v-if="isSubscribed" class="bell-active-dot" />
    </button>

    <!-- Notification Toast Popup -->
    <Teleport to="body">
      <div v-if="showToast" class="push-toast-banner" role="status">
        <span class="toast-icon">{{ isSubscribed ? '🔔' : '🔕' }}</span>
        <span>{{ toastMessage }}</span>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.push-bell-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.push-bell-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 6px;
  background: #181927;
  border: 1px solid #23253a;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

.push-bell-btn:hover {
  color: #00d4aa;
  border-color: #00d4aa;
  background: rgba(0, 212, 170, 0.08);
}

.push-bell-btn.is-active {
  color: #00d4aa;
  border-color: rgba(0, 212, 170, 0.4);
  background: rgba(0, 212, 170, 0.12);
}

.push-bell-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.bell-active-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #00d4aa;
  box-shadow: 0 0 6px #00d4aa;
}

.bell-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 212, 170, 0.2);
  border-top-color: #00d4aa;
  border-radius: 50%;
  animation: bell-spin 0.6s linear infinite;
}

@keyframes bell-spin {
  to {
    transform: rotate(360deg);
  }
}

.push-toast-banner {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  background: #181927;
  border: 1px solid #00d4aa;
  color: #f1f5f9;
  padding: 12px 18px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  animation: toast-fade-in 0.25s ease-out;
}

.toast-icon {
  font-size: 16px;
}

@keyframes toast-fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

