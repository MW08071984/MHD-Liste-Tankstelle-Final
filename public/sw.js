self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('push', event => {
  let data = { title: 'MHD Warnung', body: 'Ein Artikel läuft bald ab.' }
  try { data = event.data ? event.data.json() : data } catch(e) {}
  event.waitUntil(self.registration.showNotification(data.title || 'MHD Warnung', {
    body: data.body || 'Ein Artikel läuft bald ab.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'mhd-warning',
    renotify: true
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients => clients[0]?.focus() || self.clients.openWindow('/')))
})
