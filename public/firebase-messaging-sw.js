// Firebase Cloud Messaging Service Worker for GramCare AI
// Handles background push notifications when application is inactive or in background.

importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker with the project configuration
firebase.initializeApp({
  apiKey: "AIzaSyAhUG1_A502hBiR9169LAuuUMz4b9yiquM",
  authDomain: "gramcare-ai-5fffb.firebaseapp.com",
  projectId: "gramcare-ai-5fffb",
  storageBucket: "gramcare-ai-5fffb.firebasestorage.app",
  messagingSenderId: "164999261973",
  appId: "1:164999261973:web:8d10cd9e5c4469f027431c"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[GramCare FCM SW] Received background message: ', payload);

  const senderName = payload.data?.senderName || 'Your family member';
  const title = payload.notification?.title || payload.data?.title || '🚨 EMERGENCY ALERT';
  const body = payload.notification?.body || payload.data?.body || `${senderName} has triggered an emergency alert.`;
  const alertId = payload.data?.alertId || payload.data?.eventId || '';
  const clickUrl = payload.data?.url || (alertId ? `/emergency/${alertId}` : '/');
  const apiBase = payload.data?.apiBaseUrl || '';

  // Report physical delivery receipt back to backend (confirms true device delivery)
  if (alertId) {
    try {
      fetch(`${apiBase}/api/emergency/${encodeURIComponent(alertId)}/delivered`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'sw_background' })
      }).catch((e) => console.debug('[SW] Delivery ping note:', e));
    } catch (e) {
      console.debug('[SW] Delivery ping error:', e);
    }
  }

  const notificationOptions = {
    body: body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: alertId ? `sos-${alertId}` : 'gramcare-sos',
    renotify: true,
    requireInteraction: true,
    vibrate: [400, 150, 400, 150, 400],
    data: {
      url: clickUrl,
      alertId: alertId,
      eventId: alertId,
      apiBaseUrl: apiBase
    },
    actions: [
      { action: 'open_alert', title: '🚨 View Alert' },
      { action: 'call_112', title: '📞 Call 112' }
    ]
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Handle notification click: Open alert dashboard or call 112
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const alertId = event.notification.data?.alertId || event.notification.data?.eventId;
  const apiBase = event.notification.data?.apiBaseUrl || '';

  // Report that notification was opened
  if (alertId) {
    try {
      fetch(`${apiBase}/api/emergency/${encodeURIComponent(alertId)}/opened`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'sw_click' })
      }).catch((e) => console.debug('[SW] Open ping note:', e));
    } catch (e) {
      console.debug('[SW] Open ping error:', e);
    }
  }

  if (event.action === 'call_112') {
    clients.openWindow('tel:112');
    return;
  }

  const targetUrl = event.notification.data?.url || (alertId ? `/emergency/${alertId}` : '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
