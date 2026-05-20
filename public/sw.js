self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'MHD Kontrolle', body: event.data ? event.data.text() : 'Neue Benachrichtigung' };
  }

  const title = data.title || 'MHD Kontrolle';
  const options = {
    body: data.body || 'Es gibt neue MHD-Hinweise.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'mhd-kontrolle',
    renotify: true,
    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
