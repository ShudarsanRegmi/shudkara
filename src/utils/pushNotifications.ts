/**
 * Utility for PWA Web Push Notifications and cross-platform native notifications.
 */

// Helper to convert URL-safe base64 string to Uint8Array for applicationServerKey
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks if the current browser/device supports Web Push and Notifications.
 */
export function isPushNotificationSupported(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

/**
 * Returns current permission state and active PushSubscription if any.
 */
export async function getPushSubscriptionState(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  subscription: PushSubscription | null;
}> {
  if (!isPushNotificationSupported()) {
    return {
      supported: false,
      permission: (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'denied',
      subscribed: false,
      subscription: null
    };
  }

  const permission = Notification.permission;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return {
      supported: true,
      permission,
      subscribed: !!sub,
      subscription: sub
    };
  } catch (err) {
    console.warn('Error checking push subscription state:', err);
    return {
      supported: true,
      permission,
      subscribed: false,
      subscription: null
    };
  }
}

/**
 * Requests notification permission, retrieves VAPID public key from backend,
 * creates PushSubscription and posts it to /api/notifications/subscribe.
 */
export async function subscribeToPushNotifications(authToken: string): Promise<PushSubscription> {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported on this browser or platform.');
  }

  // 1. Request user permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(`Notification permission was ${permission}. Please allow notifications in site settings.`);
  }

  // 2. Fetch VAPID public key from backend
  const keyRes = await fetch('/api/notifications/vapid-public-key');
  if (!keyRes.ok) {
    throw new Error('Failed to fetch VAPID public key from server.');
  }
  const keyData = await keyRes.json();
  const vapidPublicKey = keyData.publicKey;
  if (!vapidPublicKey) {
    throw new Error('VAPID public key is empty on server.');
  }

  // 3. Subscribe with PushManager
  const reg = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

  // Check if existing subscription exists
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as any
    });
  }

  // 4. Send subscription to server
  const subRes = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': authToken
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent
    })
  });

  if (!subRes.ok) {
    const errData = await subRes.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to register subscription on server.');
  }

  return subscription;
}

/**
 * Unsubscribes locally and de-registers from server.
 */
export async function unsubscribeFromPushNotifications(authToken: string): Promise<void> {
  if (!isPushNotificationSupported()) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      // Notify server
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken
        },
        body: JSON.stringify({ endpoint })
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Error unsubscribing from push notifications:', err);
  }
}

/**
 * Sends a server-side push notification to test background delivery.
 */
export async function triggerServerTestPush(
  authToken: string,
  title?: string,
  body?: string
): Promise<{ sent: number; message: string }> {
  const res = await fetch('/api/notifications/test-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': authToken
    },
    body: JSON.stringify({
      title: title || '🌟 Shudkara System Connected',
      body: body || 'Your PWA is successfully receiving system push notifications from the server!'
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server error: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * Cross-platform native notification trigger that works on Android PWA, iOS PWA, and desktop.
 * Uses ServiceWorkerRegistration.showNotification() to avoid the "Illegal constructor" error on mobile.
 */
export async function showLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const defaultOptions: NotificationOptions = {
    icon: '/icon-192.png',
    badge: '/favicon.svg',
    ...options
  };

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, defaultOptions);
        return;
      }
    } catch (swErr) {
      console.warn('ServiceWorker showNotification failed, trying fallback:', swErr);
    }
  }

  // Fallback for standard desktop browsers if service worker registration is not ready
  try {
    new Notification(title, defaultOptions);
  } catch (notifErr) {
    console.warn('Local Notification fallback failed:', notifErr);
  }
}
