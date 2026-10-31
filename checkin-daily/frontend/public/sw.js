// checkin-daily/frontend/public/sw.js
// Check-in Daily Web Push Service Worker

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data = {
        title: '체크인데일리 속보 알림',
        body: '새로운 주요 여행 뉴스가 등록되었습니다.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: {
          url: '/news',
        },
      }

      if (event.data) {
        try {
          const json = event.data.json()
          data = { ...data, ...json }
        } catch {
          const text = event.data.text()
          if (text) data.body = text
        }
      } else {
        // Fallback: fetch latest breaking notification payload
        try {
          const res = await fetch('/api/push/latest')
          if (res.ok) {
            const latest = await res.json()
            if (latest && latest.title) {
              data = { ...data, ...latest }
            }
          }
        } catch {}
      }

      const options = {
        body: data.body,
        icon: data.icon || '/icons/icon-192.png',
        badge: data.badge || '/icons/icon-192.png',
        vibrate: [100, 50, 100],
        data: data.data || { url: '/news' },
        actions: [
          { action: 'open', title: '기사 읽기' },
          { action: 'close', title: '닫기' },
        ],
      }

      await self.registration.showNotification(data.title, options)
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'close') {
    return
  }

  const targetUrl = event.notification.data?.url || '/news'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
