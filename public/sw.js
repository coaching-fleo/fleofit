self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      // Fino al 13/10/2026 puntavano a /vite.svg, che non esiste: la notifica web usciva senza icona.
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});