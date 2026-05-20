self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || 'MHD Kontrolle', {
    body: data.body || 'Neue MHD-Benachrichtigung',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  }));
});
