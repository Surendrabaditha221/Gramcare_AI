/**
 * Firebase Cloud Messaging Client Service for GramCare AI
 * Handles device notification permission requests, FCM web push token registration,
 * foreground message notifications, and true delivery status synchronization.
 */
import { getMessaging, getToken, onMessage, isSupported, deleteToken, Messaging } from 'firebase/messaging';
import { app } from './firebase';
import {
  registerDeviceTokenBackend,
  unregisterDeviceTokenBackend,
  markAlertDeliveredBackend
} from './api';

let messagingInstance: Messaging | null = null;

// Public VAPID Key: Can be supplied via VITE_FIREBASE_VAPID_KEY in .env
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;

/**
 * Initializes and returns the Firebase Messaging instance if supported.
 */
export async function getFCMInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;

  try {
    const supported = await isSupported();
    if (!supported || !app) {
      console.info('[GramCare FCM] Web Push Messaging is not supported in this browser environment.');
      return null;
    }
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.warn('[GramCare FCM] Error initializing messaging instance:', err);
    return null;
  }
}

/**
 * Requests browser notification permission and retrieves an FCM registration token.
 * Securely associates the token with the authenticated user via backend API.
 */
export async function requestNotificationPermissionAndGetToken(
  contactId?: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, error: 'Notifications are not supported on this browser.' };
  }

  try {
    // 1. Request Browser Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error: permission === 'denied'
          ? 'Notification permission was denied. Please allow notifications in your browser site settings.'
          : 'Notification permission request was dismissed.'
      };
    }

    // 2. Register Service Worker if needed
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      await navigator.serviceWorker.ready;
    }

    // 3. Obtain Messaging Instance
    const messaging = await getFCMInstance();
    if (!messaging) {
      return { success: false, error: 'Push messaging is unavailable.' };
    }

    // 4. Retrieve FCM Token
    const tokenOptions: any = {
      serviceWorkerRegistration: swRegistration
    };
    if (VAPID_KEY && VAPID_KEY.trim() !== '') {
      tokenOptions.vapidKey = VAPID_KEY.trim();
    }

    const currentToken = await getToken(messaging, tokenOptions);

    if (!currentToken) {
      return {
        success: false,
        error: 'No registration token available. Please allow notifications and try again.'
      };
    }

    console.log('[GramCare FCM] Generated device token hash:', currentToken.slice(0, 8) + '...' + currentToken.slice(-4));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gramcare_fcm_token', currentToken);
    }

    // 5. Register with authenticated backend (Strict requirement: do NOT claim push ready unless backend succeeds)
    try {
      const regRes = await registerDeviceTokenBackend({
        fcmToken: currentToken,
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile_web' : 'desktop_web',
        deviceName: navigator.userAgent.slice(0, 50),
        contactId: contactId,
        consentGranted: true
      });
      if (!regRes || regRes.success === false) {
        throw new Error(regRes?.message || 'Device registration could not be verified by backend.');
      }
    } catch (apiErr: any) {
      console.error('[GramCare FCM] Backend token registration failed:', apiErr);
      return {
        success: false,
        error: apiErr?.message || 'Could not register push token with GramCare backend. Please make sure you are logged in.'
      };
    }

    return { success: true, token: currentToken };
  } catch (err: any) {
    console.error('[GramCare FCM] Unable to get FCM token:', err);
    return { success: false, error: err?.message || 'Failed to acquire notification permission' };
  }
}

/**
 * Verifies with the backend whether this user has active registered device tokens.
 */
export async function verifyDeviceRegistrationStatus(): Promise<{ registered: boolean; activeCount: number; devices?: any[] }> {
  try {
    const { getNotificationStatusBackend } = await import('./api');
    return await getNotificationStatusBackend();
  } catch {
    return { registered: false, activeCount: 0, devices: [] };
  }
}

/**
 * Unregisters the current device token from FCM and the backend.
 */
export async function unregisterCurrentDeviceToken(): Promise<boolean> {
  try {
    const messaging = await getFCMInstance();
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('gramcare_fcm_token') : null;

    if (messaging) {
      await deleteToken(messaging).catch(() => {});
    }

    if (token) {
      await unregisterDeviceTokenBackend(token).catch(() => {});
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('gramcare_fcm_token');
      }
    }
    return true;
  } catch (err) {
    console.warn('[GramCare FCM] Error unregistering device token:', err);
    return false;
  }
}

/**
 * Subscribes to foreground push notifications while the app is actively open.
 */
export function listenToForegroundMessages(
  onEmergencyAlert: (payload: any) => void
): () => void {
  let unsubscribe: (() => void) | null = null;

  getFCMInstance().then((messaging) => {
    if (!messaging) return;

    unsubscribe = onMessage(messaging, (payload) => {
      console.log('[GramCare FCM] Received foreground message:', payload);

      const alertId = payload?.data?.alertId || payload?.data?.eventId;
      if (alertId) {
        // Record true device delivery
        markAlertDeliveredBackend(alertId, 'foreground_listener').catch(() => {});
      }

      if (onEmergencyAlert) {
        onEmergencyAlert(payload);
      }
    });
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
