/* AddisGebeya Web Push Service Worker */

const DEFAULT_ICON = "/images/addisgebeya-logo.png";
const DEFAULT_BADGE = "/images/addisgebeya-logo.png";
const DEFAULT_TARGET_URL = "/notifications";

function resolveSafeTargetUrl(rawUrl) {
  try {
    if (typeof rawUrl === "string" && rawUrl.startsWith("/")) {
      return new URL(rawUrl, self.location.origin).href;
    }
    if (typeof rawUrl === "string") {
      const parsed = new URL(rawUrl, self.location.origin);
      if (parsed.origin === self.location.origin) {
        return parsed.href;
      }
    }
  } catch {
    // Fallback to notifications center
  }
  return new URL(DEFAULT_TARGET_URL, self.location.origin).href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json() || {};
    } catch {
      try {
        payload = { body: event.data.text() };
      } catch {
        payload = {};
      }
    }
  }

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : "AddisGebeya Update";
  const body =
    typeof payload.body === "string" && payload.body.trim()
      ? payload.body.trim()
      : "You have a new update on AddisGebeya.";
  const targetUrl = resolveSafeTargetUrl(payload.url);
  const tag =
    typeof payload.tag === "string" && payload.tag.trim()
      ? payload.tag.trim()
      : payload.notificationId
        ? `ag-${payload.notificationId}`
        : "addisgebeya-notification";

  const notificationOptions = {
    body,
    icon: typeof payload.icon === "string" && payload.icon ? payload.icon : DEFAULT_ICON,
    badge: typeof payload.badge === "string" && payload.badge ? payload.badge : DEFAULT_BADGE,
    tag,
    timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
    renotify: false,
    data: {
      url: targetUrl,
      notificationId: payload.notificationId || null,
      type: payload.type || "info",
    },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, notificationOptions);

      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windowClients) {
        try {
          client.postMessage({
            type: "ADDISGEBEYA_PUSH_RECEIVED",
            notificationId: payload.notificationId || null,
            notificationType: payload.type || null,
          });
        } catch {
          // Ignore messaging errors on closing tabs
        }
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = resolveSafeTargetUrl(event.notification?.data?.url);

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        try {
          if (client.url && new URL(client.url).origin === self.location.origin) {
            if ("focus" in client) {
              await client.focus();
            }
            if ("navigate" in client && typeof client.navigate === "function") {
              await client.navigate(targetUrl).catch(() => {});
            }
            return;
          }
        } catch {
          // Try opening a fresh window below
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  const applicationServerKey =
    event.oldSubscription &&
    event.oldSubscription.options &&
    event.oldSubscription.options.applicationServerKey
      ? event.oldSubscription.options.applicationServerKey
      : null;

  if (!applicationServerKey || !self.registration.pushManager) {
    return;
  }

  event.waitUntil(
    (async () => {
      try {
        const refreshed = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        const subJson = refreshed.toJSON();
        const windowClients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of windowClients) {
          client.postMessage({
            type: "ADDISGEBEYA_PUSH_SUBSCRIPTION_CHANGED",
            subscription: subJson,
          });
        }
      } catch {
        // Frontend session sync will re-establish subscription when app opens
      }
    })(),
  );
});

