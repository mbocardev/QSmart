// src/lib/utils/push.ts
// Gestion des notifications Web Push côté client

const PUBLIC_VAPID_KEY = import.meta.env.PUBLIC_VAPID_KEY;

/**
 * Convertit une clé VAPID base64url en Uint8Array.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Demande la permission et enregistre un Service Worker pour les push.
 * Retourne la PushSubscription sérialisée, ou null si refusé.
 */
export async function abonnerPushNotifications(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Web Push non supporté sur ce navigateur.');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });

    return JSON.stringify(subscription.toJSON());
  } catch (err) {
    console.error('Erreur abonnement push:', err);
    return null;
  }
}

/**
 * Sauvegarde la PushSubscription en base via l'API.
 */
export async function sauvegarderPushSub(
  ticketId: string,
  pushSubJson: string
): Promise<void> {
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketId, pushSub: pushSubJson })
  });
}
