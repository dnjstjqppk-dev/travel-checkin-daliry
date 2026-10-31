// checkin-daily/frontend/composables/useWebPush.ts
// Browser Web Push Subscription & Permission Composable

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function useWebPush() {
  const isSupported = ref(false)
  const isSubscribed = ref(false)
  const permission = ref<'default' | 'granted' | 'denied'>('default')
  const isLoading = ref(false)
  const errorMessage = ref('')

  async function checkStatus() {
    if (!import.meta.client) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      isSupported.value = false
      return
    }

    isSupported.value = true
    permission.value = Notification.permission

    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        isSubscribed.value = Boolean(sub)
      }
    } catch {
      isSubscribed.value = false
    }
  }

  async function subscribe(lang: string = 'ko') {
    if (!import.meta.client) return false
    if (!isSupported.value) {
      errorMessage.value = '이 브라우저는 웹 푸시 알림을 지원하지 않습니다.'
      return false
    }

    isLoading.value = true
    errorMessage.value = ''

    try {
      // 1. Request Notification permission
      const perm = await Notification.requestPermission()
      permission.value = perm
      if (perm !== 'granted') {
        errorMessage.value = '브라우저 알림 권한이 허용되지 않았습니다.'
        return false
      }

      // 2. Register service worker if not already registered
      let reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await navigator.serviceWorker.ready
      }

      // 3. Fetch VAPID public key
      const keyRes = await $fetch<{ success: boolean; publicKey: string }>('/api/push/public-key')
      if (!keyRes?.publicKey) {
        throw new Error('VAPID public key retrieval failed')
      }

      const applicationServerKey = urlBase64ToUint8Array(keyRes.publicKey)

      // 4. Subscribe to PushManager
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      })

      const subJson = subscription.toJSON()
      const endpoint = subJson.endpoint
      const p256dh = subJson.keys?.p256dh
      const auth = subJson.keys?.auth

      if (!endpoint || !p256dh || !auth) {
        throw new Error('Push subscription keys missing')
      }

      // 5. Send to backend
      await $fetch('/api/push/subscribe', {
        method: 'POST',
        body: {
          endpoint,
          keys: { p256dh, auth },
          lang,
          topics: 'all',
        },
      })

      isSubscribed.value = true
      return true
    } catch (err: any) {
      errorMessage.value = err?.message || '푸시 알림 등록 중 오류가 발생했습니다.'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function unsubscribe() {
    if (!import.meta.client) return false
    isLoading.value = true
    errorMessage.value = ''

    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          const endpoint = sub.endpoint
          await sub.unsubscribe()
          await $fetch('/api/push/unsubscribe', {
            method: 'POST',
            body: { endpoint },
          }).catch(() => {})
        }
      }
      isSubscribed.value = false
      return true
    } catch (err: any) {
      errorMessage.value = err?.message || '알림 해제 중 오류가 발생했습니다.'
      return false
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    checkStatus()
  })

  return {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    errorMessage,
    subscribe,
    unsubscribe,
    checkStatus,
  }
}
