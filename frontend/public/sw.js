self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      data = { title: 'Vybe', body: event.data ? event.data.text() : '' };
    } catch {
      data = { title: 'Vybe', body: '' };
    }
  }

  const title = data.title || 'Vybe';
  const body = data.body || '';
  const url = data.url || '/store/pos';

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url, ...(data.data || {}) },
    tag: data.tag || 'vybe',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 400],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const c of clientsArr) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

