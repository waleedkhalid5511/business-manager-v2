self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  self.registration.showNotification(data.title || '🔔 Office Bell!', {
    body: data.body || 'You are being called',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    tag: 'office-bell',
    renotify: true,
    data: { url: self.location.origin }
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          return
        }
      }
      clients.openWindow(self.location.origin)
    })
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_BELL') {
    const { callerName } = event.data
    self.registration.showNotification('🔔 Office Bell!', {
      body: `${callerName} is calling you to the office`,
      icon: '/favicon.ico',
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300, 100, 300],
      tag: 'office-bell',
      renotify: true,
      actions: [
        { action: 'coming', title: '✅ Coming!' },
        { action: 'dismiss', title: '✕ Dismiss' }
      ],
      data: { url: self.location.origin }
    })
  }
})

self.addEventListener('notificationclose', (event) => {})
