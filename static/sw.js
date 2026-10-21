// static/sw.js
// Service Worker Q-Smart — gère les notifications Web Push reçues

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'Q-Smart',
      body: event.data.text(),
      icon: '/icon-192.png'
    };
  }

  const options = {
    body: payload.body,
    icon: payload.icon ?? '/icon-192.png',
    badge: payload.badge ?? '/badge-72.png',
    vibrate: [200, 100, 200],
    data: payload.data ?? {},
    actions: [
      { action: 'open', title: 'Voir mon ticket' }
    ],
    requireInteraction: payload.data?.ticketId !== undefined
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Ouvrir dans un onglet existant si possible
      for (const client of clientList) {
        if (client.url.includes('/queue/') && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon ouvrir un nouvel onglet
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Activation immédiate du nouveau SW
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
