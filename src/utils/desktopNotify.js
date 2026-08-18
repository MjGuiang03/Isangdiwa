/**
 * Desktop Notification Utility
 * Uses the Web Notifications API to show native browser notifications.
 */

import puacLogo from '../assets/optimized/puaclogo.webp';

const PERMISSION_KEY = 'faithly_notif_permission';
const DISMISSED_KEY  = 'faithly_notif_dismissed';

/**
 * Check if the user has permanently dismissed the notification prompt.
 */
export function isPromptDismissed() {
  return localStorage.getItem(DISMISSED_KEY) === 'true';
}

/**
 * Mark the prompt as permanently dismissed ("Don't show again").
 */
export function dismissPromptForever() {
  localStorage.setItem(DISMISSED_KEY, 'true');
}

/**
 * Request browser notification permission.
 * Returns the permission state: 'granted', 'denied', or 'default'.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied';

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    localStorage.setItem(PERMISSION_KEY, Notification.permission);
    return Notification.permission;
  }

  try {
    const result = await Notification.requestPermission();
    localStorage.setItem(PERMISSION_KEY, result);
    return result;
  } catch {
    return 'denied';
  }
}

/**
 * Get the current permission state without prompting.
 */
export function getPermissionState() {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Whether we should show the custom in-app prompt banner.
 * True only if: permission is 'default' (never asked), AND user hasn't clicked "Don't show again".
 */
export function shouldShowPromptBanner() {
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'default') return false;
  if (isPromptDismissed()) return false;
  return true;
}

/**
 * Send a desktop notification.
 * @param {string} title - Notification title
 * @param {string} body  - Notification body text
 * @param {Function} [onClick] - Callback when user clicks the notification
 */
export function sendDesktopNotification(title, body, onClick) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Don't fire if tab is focused and visible
  if (document.visibilityState === 'visible') return;

  try {
    const notification = new Notification(title, {
      body,
      icon: puacLogo,
      badge: puacLogo,
      tag: `faithly-${Date.now()}`,
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (onClick) onClick();
    };

    // Auto-close after 6 seconds
    setTimeout(() => notification.close(), 6000);
  } catch {
    // Silent fail — some browsers restrict Notification in certain contexts
  }
}

/**
 * Given a previous set of notification IDs and a new set,
 * fire desktop notifications for the truly new ones.
 * Returns the updated set of all known IDs.
 *
 * @param {Set} prevIds - Previously known notification IDs
 * @param {Array} allNotifications - Array of { id, title, message } objects
 * @param {string} notifPagePath - Path to the notification page (to suppress popups if user is there)
 * @param {Function} navigateFn - Function to navigate to the notification page
 * @returns {Set} Updated set of all known IDs
 */
export function processNewNotifications(prevIds, allNotifications, notifPagePath, navigateFn) {
  const currentIds = new Set(allNotifications.map(n => n.id));

  // Skip on first load (prevIds is empty — don't spam existing notifications)
  if (prevIds.size === 0) return currentIds;

  // Skip if user is currently viewing the notification page
  if (window.location.pathname === notifPagePath) return currentIds;

  // Find truly new notification IDs
  const newItems = allNotifications.filter(n => !prevIds.has(n.id));

  if (newItems.length === 0) return currentIds;

  if (newItems.length <= 5) {
    newItems.forEach(n => {
      sendDesktopNotification(
        `IsangDiwa — ${n.title || 'New Notification'}`,
        n.message || '',
        () => navigateFn && navigateFn(notifPagePath)
      );
    });
  } else {
    // Summarize if too many at once
    sendDesktopNotification(
      'IsangDiwa — New Notifications',
      `You have ${newItems.length} new notifications`,
      () => navigateFn && navigateFn(notifPagePath)
    );
  }

  return currentIds;
}

/**
 * Convert VAPID key to Uint8Array for push subscription
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
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
 * Register Service Worker and subscribe to PushManager
 */
export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) return existingSubscription;

    const publicVapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
    if (!publicVapidKey) {
      console.warn('VAPID public key not found');
      return null;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });

    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.error('Error unsubscribing:', error);
  }
}
