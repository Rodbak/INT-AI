// Client-side web-push: turn the daily briefing on/off for this device. All
// functions fail soft (return a status) so the UI can stay simple.
import { getPushKey, savePushSubscription, removePushSubscription, sendTestPush } from './api';

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
  } catch {
    return null;
  }
}

/** Is push already turned on for this device? */
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await registration();
  if (!reg) return false;
  return Boolean(await reg.pushManager.getSubscription());
}

/** Whether the server has push configured at all (VAPID keys present). */
export async function isPushAvailable(): Promise<boolean> {
  try {
    const { enabled, publicKey } = await getPushKey();
    return Boolean(enabled && publicKey);
  } catch {
    return false;
  }
}

/** Ask permission, subscribe, register with the backend, and send a test. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'This phone or browser does not support notifications.' };
  const { publicKey } = await getPushKey();
  if (!publicKey) return { ok: false, reason: 'Notifications are not set up on the server yet.' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'You did not allow notifications.' };

  const reg = await registration();
  if (!reg) return { ok: false, reason: 'Could not start the background service.' };

  try {
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    await savePushSubscription(sub.toJSON() as PushSubscriptionJSON);
    await sendTestPush().catch(() => {});
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Could not turn on notifications. Please try again.' };
  }
}

/** Unsubscribe this device and tell the backend to forget it. */
export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) {
    await removePushSubscription(sub.endpoint).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
