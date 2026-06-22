const CACHE_NAME = 'diabp-copilot-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Caching assets during install failed:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/') || event.request.url.includes('/supabase.co/')) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// State for background reminders (held in service worker memory)
let userRole = null;
let reminderConfig = {
  enabled: false,
  reminderTime: '08:00',
  streakDays: 1,
  hasLoggedToday: false,
  lastReminderDate: ''
};

// Background reminder check interval (runs in the Service Worker thread)
setInterval(() => {
  if (!reminderConfig.enabled || userRole !== 'patient') return;

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  if (currentTimeStr === reminderConfig.reminderTime) {
    const todayStr = now.toDateString();
    if (reminderConfig.lastReminderDate !== todayStr && !reminderConfig.hasLoggedToday) {
      reminderConfig.lastReminderDate = todayStr;
      
      const title = "⏰ Daily Health Check-in";
      const body = `Time to log your blood pressure and glucose readings to keep your ${reminderConfig.streakDays}-day care streak active!`;
      
      const options = {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        vibrate: [200, 100, 200],
        tag: 'diabp-copilot-daily-reminder'
      };
      
      self.registration.showNotification(title, options);
    }
  }
}, 30000); // Check every 30 seconds

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body } = event.data;
    const options = {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [200, 100, 200],
      tag: 'diabp-copilot-alert'
    };
    self.registration.showNotification(title, options);
  }

  else if (event.data.type === 'SYNC_USER_ROLE') {
    userRole = event.data.payload.role;
  }

  else if (event.data.type === 'DISPATCH_SYSTEM_BROADCAST') {
    const { title, body, target } = event.data.payload;
    
    // When userRole is null (not yet synced), allow all to ensure delivery
    const isClinician = userRole === null || ['doctor', 'pharmacist', 'admin'].includes(userRole);
    const isPatient = userRole === null || userRole === 'patient';
    const roleMatches = 
      userRole === null ||
      target === 'all' ||
      (target === 'clinicians' && isClinician) ||
      (target === 'patients' && isPatient);

    if (roleMatches) {
      const options = {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        vibrate: [200, 100, 200],
        tag: 'diabp-copilot-system-broadcast',
        data: { target }
      };
      self.registration.showNotification(title, options);
    }

    // Broadcast message to all open tabs
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({
          type: 'SYSTEM_BROADCAST_BROADCAST',
          payload: event.data.payload
        });
      });
    });
  }

  else if (event.data.type === 'SYNC_REMINDER_SETTINGS') {
    const { enabled, reminderTime, streakDays, hasLoggedToday } = event.data.payload;
    reminderConfig.enabled = enabled;
    reminderConfig.reminderTime = reminderTime || '08:00';
    reminderConfig.streakDays = streakDays || 1;
    reminderConfig.hasLoggedToday = hasLoggedToday || false;
  }

  else if (event.data.type === 'PATIENT_LOGGED_VITALS') {
    const { patientId, patientName, systolic, diastolic, glucose, glucoseType, streakDays } = event.data.payload;
    
    // Update reminder state locally in Service Worker immediately so we do not notify them again today
    reminderConfig.hasLoggedToday = true;

    // 1. Display clinician push notification — allow if role is clinician OR not yet synced (null)
    const isClinician = userRole === null || ['doctor', 'pharmacist', 'admin'].includes(userRole);
    if (isClinician) {
      const title = `🚨 Vitals Logged: ${patientName}`;
      const body = `BP: ${systolic}/${diastolic} mmHg | Glucose: ${glucose > 0 ? `${glucose} mg/dL (${glucoseType})` : 'N/A'}. Streak: ${streakDays} days!`;
      const options = {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        vibrate: [200, 100, 200],
        tag: `vitals-log-${patientId}`,
        data: { patientId }
      };
      self.registration.showNotification(title, options);
    }

    // 2. Broadcast this log to all open window tabs (clients)
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({
          type: 'VITALS_LOGGED_BROADCAST',
          payload: event.data.payload
        });
      });
    });
  }
});
