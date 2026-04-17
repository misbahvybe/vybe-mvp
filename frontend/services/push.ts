'use client';

import api from '@/services/api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function enableWebPushForCurrentUser(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined') return { ok: false, reason: 'no_window' };
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no_sw' };
  if (!('PushManager' in window)) return { ok: false, reason: 'no_push' };
  if (!('Notification' in window)) return { ok: false, reason: 'no_notification' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'permission_denied' };

  const reg = await navigator.serviceWorker.register('/sw.js');

  // Prefer env; fallback to backend endpoint.
  let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
  if (!publicKey) {
    try {
      const r = await api.get<{ publicKey: string | null }>('/push/vapid-public-key');
      publicKey = r.data?.publicKey ?? '';
    } catch {
      // ignore
    }
  }
  if (!publicKey) return { ok: false, reason: 'missing_vapid_public_key' };

  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const json = sub.toJSON() as any;
  await api.post('/push/subscribe', json);
  return { ok: true };
}

export type WebPushUiStatus = {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  deviceSubscribed: boolean;
  backendConfigured: boolean | null;
};

export async function getWebPushUiStatus(tokenPresent: boolean): Promise<WebPushUiStatus> {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const permission: WebPushUiStatus['permission'] = supported ? Notification.permission : 'unsupported';

  let deviceSubscribed = false;
  if (supported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      deviceSubscribed = Boolean(sub);
    } catch {
      deviceSubscribed = false;
    }
  }

  // If no token, we can't call backend.
  if (!tokenPresent) {
    return { supported, permission, deviceSubscribed, backendConfigured: null };
  }

  try {
    const r = await api.get<{ configured: boolean }>('/push/status');
    return { supported, permission, deviceSubscribed, backendConfigured: Boolean(r.data?.configured) };
  } catch {
    return { supported, permission, deviceSubscribed, backendConfigured: null };
  }
}

