import { create } from "zustand";
import type { PushSubscriptionStatusResponse } from "@addisgebeya/types";
import { clientEnv } from "@/lib/env";
import { notificationService } from "@/services/notification.service";

const PROMPT_DISMISSED_STORAGE_KEY = "ag_push_prompt_dismissed_v1";
const MANUAL_OPT_OUT_STORAGE_KEY = "ag_push_manual_opt_out_v1";
const PROMPT_DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function readManualOptOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MANUAL_OPT_OUT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeManualOptOut(optedOut: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (optedOut) {
      window.localStorage.setItem(MANUAL_OPT_OUT_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(MANUAL_OPT_OUT_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export type PushPermissionState = NotificationPermission | "unsupported";

export interface PushCapabilityInfo {
  isSupported: boolean;
  unsupportedReason: string | null;
  permission: PushPermissionState;
}

function readPromptDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(PROMPT_DISMISSED_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { dismissedAt?: number };
    if (typeof parsed.dismissedAt !== "number") return false;
    return Date.now() - parsed.dismissedAt < PROMPT_DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function detectPushCapability(): PushCapabilityInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isSupported: false,
      unsupportedReason: null,
      permission: "unsupported",
    };
  }

  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]";

  if (!window.isSecureContext && !isLocalhost) {
    return {
      isSupported: false,
      unsupportedReason: "Device push notifications require a secure HTTPS connection.",
      permission: "unsupported",
    };
  }

  const hasApis =
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  if (!hasApis) {
    const isIos = /iPad|iPhone|iPod/i.test(navigator.userAgent || "");
    return {
      isSupported: false,
      unsupportedReason: isIos
        ? "On iPhone and iPad (iOS 16.4+), tap Share -> Add to Home Screen and open AddisGebeya from your Home Screen icon to enable push notifications."
        : "Your current browser does not support Web Push and Service Worker notifications.",
      permission: "unsupported",
    };
  }

  return {
    isSupported: true,
    unsupportedReason: null,
    permission: Notification.permission,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function extractSubscriptionKeys(
  subscription: PushSubscription,
): { p256dh: string; auth: string } | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh?.trim();
  const auth = json.keys?.auth?.trim();
  if (p256dh && auth) {
    return { p256dh, auth };
  }

  const p256dhBuf = subscription.getKey?.("p256dh");
  const authBuf = subscription.getKey?.("auth");
  if (!p256dhBuf || !authBuf) {
    return null;
  }

  return {
    p256dh: arrayBufferToBase64Url(p256dhBuf),
    auth: arrayBufferToBase64Url(authBuf),
  };
}

async function getReadyServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  if (registration.active) {
    return registration;
  }

  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_resolve, reject) => {
      window.setTimeout(() => {
        reject(
          new Error(
            "Service worker activation timed out. Reload the page and ensure /sw.js is accessible.",
          ),
        );
      }, 10_000);
    }),
  ]);
  return registration;
}

function formatBrowserPushSubscribeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const name = err instanceof Error ? err.name : "";
  if (name === "AbortError" || /push service error/i.test(msg)) {
    return "Browser push service registration failed. If you use Brave, enable 'Use Google services for push messaging' in Privacy & Security settings, exit Incognito mode, or check network access to your browser's push service.";
  }
  if (name === "NotAllowedError" || /denied/i.test(msg)) {
    return "Notification permission was blocked. Allow notifications in your browser's site settings and try again.";
  }
  return msg || "Could not enable device notifications.";
}

export async function cleanupDevicePushOnLogout(options?: {
  allDevices?: boolean;
  localOnly?: boolean;
}): Promise<void> {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg?.pushManager ? await reg.pushManager.getSubscription() : null;
    if (!options?.localOnly) {
      if (options?.allDevices) {
        await notificationService.unsubscribePush({ all: true }).catch(() => {});
      } else if (sub?.endpoint) {
        await notificationService
          .unsubscribePush({ endpoint: sub.endpoint })
          .catch(() => {});
      }
    }
    if (sub) {
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    // Never block user logout on push cleanup errors
  }
}

interface PushState {
  isSupported: boolean;
  unsupportedReason: string | null;
  permission: PushPermissionState;
  currentEndpoint: string | null;
  isSubscribedOnThisDevice: boolean;
  status: PushSubscriptionStatusResponse | null;
  isLoadingStatus: boolean;
  isMutating: boolean;
  error: string | null;
  promptDismissed: boolean;
  syncedUserId: string | null;
  autoAttemptedUserId: string | null;

  refreshStatus: (options?: { syncExistingForUserId?: string }) => Promise<void>;
  ensureDefaultPushEnabled: (userId: string) => Promise<void>;
  enablePush: (options?: { silentAuto?: boolean }) => Promise<boolean>;
  disablePush: () => Promise<boolean>;
  disableAllDevices: () => Promise<boolean>;
  setPushPreference: (enabled: boolean) => Promise<boolean>;
  sendTestPush: () => Promise<{ sent: number; failed: number; removed: number } | null>;
  syncRotatedSubscription: (subscriptionJson: PushSubscriptionJSON) => Promise<void>;
  dismissPrompt: () => void;
  reset: () => void;
}

export const usePushStore = create<PushState>()((set, get) => ({
  isSupported: false,
  unsupportedReason: null,
  permission: "unsupported",
  currentEndpoint: null,
  isSubscribedOnThisDevice: false,
  status: null,
  isLoadingStatus: false,
  isMutating: false,
  error: null,
  promptDismissed: false,
  syncedUserId: null,
  autoAttemptedUserId: null,

  refreshStatus: async (options) => {
    const cap = detectPushCapability();
    const promptDismissed = readPromptDismissed();

    set({
      isSupported: cap.isSupported,
      unsupportedReason: cap.unsupportedReason,
      permission: cap.permission,
      promptDismissed,
      isLoadingStatus: true,
    });

    let activeBrowserSub: PushSubscription | null = null;
    if (cap.isSupported) {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (reg?.pushManager) {
          activeBrowserSub = await reg.pushManager.getSubscription();
        }
      } catch {
        activeBrowserSub = null;
      }
    }

    const browserEndpoint = activeBrowserSub?.endpoint ?? null;

    try {
      let status = await notificationService.getPushStatus(browserEndpoint ?? undefined);

      // Silently re-sync an already-granted browser subscription to this logged-in user
      if (
        options?.syncExistingForUserId &&
        get().syncedUserId !== options.syncExistingForUserId &&
        cap.isSupported &&
        cap.permission === "granted" &&
        activeBrowserSub &&
        status.configured &&
        !status.subscribed
      ) {
        const keys = extractSubscriptionKeys(activeBrowserSub);
        if (keys) {
          const subscribedRes = await notificationService.subscribePush({
            endpoint: activeBrowserSub.endpoint,
            keys,
            userAgent: navigator.userAgent,
          });
          status = subscribedRes.status;
        }
      }

      set({
        status,
        currentEndpoint: browserEndpoint,
        isSubscribedOnThisDevice: Boolean(browserEndpoint && status.subscribed),
        syncedUserId: options?.syncExistingForUserId ?? get().syncedUserId,
        isLoadingStatus: false,
        error: null,
      });
    } catch (err) {
      set({
        currentEndpoint: browserEndpoint,
        isSubscribedOnThisDevice: false,
        isLoadingStatus: false,
        error: err instanceof Error ? err.message : "Could not load device push status.",
      });
    }
  },

  ensureDefaultPushEnabled: async (userId: string) => {
    const state = get();
    if (!userId || state.autoAttemptedUserId === userId || state.isMutating) {
      return;
    }

    set({ autoAttemptedUserId: userId });

    await get().refreshStatus({ syncExistingForUserId: userId });

    const updated = get();
    if (
      readManualOptOut() ||
      updated.isSubscribedOnThisDevice ||
      !updated.isSupported ||
      !updated.status?.configured ||
      !updated.status?.pushEnabled ||
      updated.permission === "denied"
    ) {
      return;
    }

    await get().enablePush({ silentAuto: true });
  },

  enablePush: async (options) => {
    const silentAuto = Boolean(options?.silentAuto);
    if (!silentAuto) {
      writeManualOptOut(false);
    }

    const cap = detectPushCapability();
    set({
      isSupported: cap.isSupported,
      unsupportedReason: cap.unsupportedReason,
      permission: cap.permission,
      error: null,
    });

    if (!cap.isSupported) {
      if (!silentAuto) {
        set({
          error:
            cap.unsupportedReason || "Push notifications are not supported on this browser.",
        });
      }
      return false;
    }

    set({ isMutating: true });
    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
        set({ permission });
      }

      if (permission === "denied") {
        set({
          isMutating: false,
          error: silentAuto
            ? null
            : "Browser notification permission is blocked. Enable notifications in your browser's site settings and try again.",
        });
        return false;
      }

      if (permission !== "granted") {
        set({
          isMutating: false,
          error: silentAuto ? null : "Notification permission was not granted.",
        });
        return false;
      }

      const cachedStatus = get().status;
      const status =
        cachedStatus?.configured && cachedStatus.vapidPublicKey
          ? cachedStatus
          : await notificationService.getPushStatus().catch(() => cachedStatus);
      const vapidPublicKey = (status?.vapidPublicKey || clientEnv.vapidPublicKey || "").trim();

      if (!vapidPublicKey || (status && !status.configured)) {
        set({
          isMutating: false,
          error:
            "Push notification keys are not configured on the server yet. Please contact the store administrator.",
        });
        return false;
      }

      const registration = await getReadyServiceWorkerRegistration();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const existingKeyBuf = subscription.options?.applicationServerKey;
        if (existingKeyBuf) {
          const existingKeyStr = arrayBufferToBase64Url(existingKeyBuf);
          if (existingKeyStr !== vapidPublicKey) {
            await subscription.unsubscribe().catch(() => {});
            subscription = null;
          }
        }
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const keys = extractSubscriptionKeys(subscription);
      if (!keys) {
        throw new Error("Browser failed to generate push encryption keys.");
      }

      const response = await notificationService.subscribePush({
        endpoint: subscription.endpoint,
        keys,
        userAgent: navigator.userAgent,
      });

      set({
        status: response.status,
        currentEndpoint: subscription.endpoint,
        isSubscribedOnThisDevice: true,
        isMutating: false,
        error: null,
      });
      return true;
    } catch (err) {
      set({
        isMutating: false,
        error: silentAuto ? null : formatBrowserPushSubscribeError(err),
      });
      return false;
    }
  },

  disablePush: async () => {
    writeManualOptOut(true);
    set({ isMutating: true, error: null });
    try {
      let endpoint = get().currentEndpoint;
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = reg?.pushManager ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          endpoint = sub.endpoint;
          await sub.unsubscribe().catch(() => {});
        }
      }

      if (endpoint) {
        const res = await notificationService.unsubscribePush({ endpoint });
        set({
          status: res.status,
          currentEndpoint: null,
          isSubscribedOnThisDevice: false,
          isMutating: false,
        });
      } else {
        const refreshed = await notificationService.getPushStatus();
        set({
          status: refreshed,
          currentEndpoint: null,
          isSubscribedOnThisDevice: false,
          isMutating: false,
        });
      }
      return true;
    } catch (err) {
      set({
        isMutating: false,
        error: err instanceof Error ? err.message : "Could not disable device notifications.",
      });
      return false;
    }
  },

  disableAllDevices: async () => {
    writeManualOptOut(true);
    set({ isMutating: true, error: null });
    try {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = reg?.pushManager ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          await sub.unsubscribe().catch(() => {});
        }
      }

      const res = await notificationService.unsubscribePush({ all: true });
      set({
        status: res.status,
        currentEndpoint: null,
        isSubscribedOnThisDevice: false,
        isMutating: false,
      });
      return true;
    } catch (err) {
      set({
        isMutating: false,
        error: err instanceof Error ? err.message : "Could not remove registered devices.",
      });
      return false;
    }
  },

  setPushPreference: async (enabled: boolean) => {
    set({ isMutating: true, error: null });
    try {
      const nextStatus = await notificationService.updatePushPreferences(enabled);
      set({
        status: nextStatus,
        isMutating: false,
      });
      return true;
    } catch (err) {
      set({
        isMutating: false,
        error: err instanceof Error ? err.message : "Could not update push preferences.",
      });
      return false;
    }
  },

  sendTestPush: async () => {
    set({ isMutating: true, error: null });
    try {
      const res = await notificationService.sendTestPush();
      await get().refreshStatus();
      set({ isMutating: false });
      return res.push;
    } catch (err) {
      set({
        isMutating: false,
        error: err instanceof Error ? err.message : "Could not send test push notification.",
      });
      return null;
    }
  },

  syncRotatedSubscription: async (subscriptionJson) => {
    const endpoint = subscriptionJson.endpoint?.trim();
    const p256dh = subscriptionJson.keys?.p256dh?.trim();
    const auth = subscriptionJson.keys?.auth?.trim();
    if (!endpoint || !p256dh || !auth) return;

    try {
      const res = await notificationService.subscribePush({
        endpoint,
        keys: { p256dh, auth },
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      set({
        status: res.status,
        currentEndpoint: endpoint,
        isSubscribedOnThisDevice: true,
      });
    } catch {
      // Ignore transient rotation sync failure; next refresh will retry
    }
  },

  dismissPrompt: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          PROMPT_DISMISSED_STORAGE_KEY,
          JSON.stringify({ dismissedAt: Date.now() }),
        );
      } catch {
        // Ignore storage quota errors
      }
    }
    set({ promptDismissed: true });
  },

  reset: () => {
    set({
      currentEndpoint: null,
      isSubscribedOnThisDevice: false,
      status: null,
      isLoadingStatus: false,
      isMutating: false,
      error: null,
      syncedUserId: null,
      autoAttemptedUserId: null,
    });
  },
}));

