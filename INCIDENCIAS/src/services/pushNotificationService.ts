/**
 * pushNotificationService.ts
 * Maneja las notificaciones del sistema / PWA en móviles y navegadores
 * según la configuración de "Al Instante" del usuario.
 */

import { UserNotificationPreferences, NotificationCategory } from '../components/NotificationSettingsModal';

const NOTIFIED_CACHE_KEY = 'nora_sent_notifications_cache';

// Obtiene los IDs de notificaciones que ya fueron mostradas para no repetir
function getSentNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_CACHE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (_) {
    return new Set();
  }
}

function markNotificationAsSent(id: string) {
  try {
    const set = getSentNotificationIds();
    set.add(id);
    // Limitar el set a 500 elementos recientes
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(NOTIFIED_CACHE_KEY, JSON.stringify(arr));
  } catch (_) {}
}

/**
 * Solicita permisos de notificación al usuario si aún no los ha concedido
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('[pushNotificationService] Error solicitando permiso:', e);
      return 'denied';
    }
  }

  return Notification.permission;
}

/**
 * Verifica si las notificaciones están permitidas
 */
export function areNotificationsGranted(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Dispara una notificación instantánea en el dispositivo móvil / PWA
 */
export async function sendInstantSystemNotification(options: {
  id: string;
  category: NotificationCategory;
  role: 'author' | 'responsible' | 'reviewer';
  title: string;
  body: string;
  issueId?: string;
  preferences?: UserNotificationPreferences;
}) {
  const { id, category, role, title, body, issueId, preferences } = options;

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  // 1. Verificar si la categoría está configurada como 'INSTANT' para el rol
  if (preferences) {
    const rolePrefs = preferences[role];
    const categoryFreq = rolePrefs ? rolePrefs[category] : 'INSTANT';
    if (categoryFreq !== 'INSTANT') {
      // Si está en 'WEEKLY' o 'MUTED', no enviar notificación instantánea
      return;
    }
  }

  // 2. Comprobar si ya fue enviada previamente para evitar duplicados
  const sentSet = getSentNotificationIds();
  if (sentSet.has(id)) {
    return;
  }

  // 3. Solicitar permiso si no está concedido
  if (Notification.permission !== 'granted') {
    return;
  }

  markNotificationAsSent(id);

  const notifTitle = `Nora BIM: ${title}`;
  const notifOptions: NotificationOptions = {
    body,
    icon: 'https://i.postimg.cc/W3trgjZX/FAVICON-NORA-NEGRO.png',
    badge: 'https://i.postimg.cc/W3trgjZX/FAVICON-NORA-NEGRO.png',
    tag: `nora-${id}`,
    data: {
      url: window.location.href,
      issueId,
      notificationId: id
    },
    // vibrate: [200, 100, 200]
  };

  try {
    // Si tenemos Service Worker activo, usar showNotification (funciona en móvil aún en segundo plano)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(notifTitle, notifOptions);
        return;
      }
    }

    // Fallback estándar en navegador
    new Notification(notifTitle, notifOptions);
  } catch (err) {
    console.warn('[pushNotificationService] Error enviando notificación:', err);
  }
}
