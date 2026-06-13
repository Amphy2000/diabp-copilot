
self.addEventListener('push', function(event) {
  let data = { title: '🔥 ELITE PICK ALERT', body: 'New high-confidence banker available!' };
  try {
    data = event.data.json();
  } catch (e) {
    console.log('Push data is not JSON, using default');
  }

  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200, 100, 200, 100, 400],
    tag: 'elite-alert',
    renotify: true,
    requireInteraction: true,
    data: {
      url: 'https://amphyaipredictor.vercel.app'
    },
    actions: [
      { action: 'open', title: 'VIEW BANKER 🚀' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Logic for foreground notifications (when app is open)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body } = event.data;
    const options = {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      tag: 'elite-alert',
      requireInteraction: true,
      data: { url: 'https://amphyaipredictor.vercel.app' }
    };
    self.registration.showNotification(title, options);
  }
});
