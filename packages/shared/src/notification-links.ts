export interface NotificationNavigationSource {
  type: string;
  relatedEntityId?: string | null;
  relatedEntityType?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SafeWebPushSource extends NotificationNavigationSource {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface SafeWebPushPayloadResult {
  notificationId: string;
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  timestamp: number;
  type: string;
  url: string;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  unreadCount?: number;
}

/**
 * Resolves the target route for an in-app notification when clicked, or null if non-navigable.
 */
export function getNotificationNavigationHref(
  notification: NotificationNavigationSource,
  userRole?: string | null,
): string | null {
  const entityType = notification.relatedEntityType;
  const entityId = notification.relatedEntityId;
  const isAdmin = (userRole || "").toLowerCase() === "admin";
  const type = (notification.type || "").toLowerCase();

  if (entityType === "order" && entityId) {
    return isAdmin
      ? `/admin/orders?search=${encodeURIComponent(entityId)}`
      : `/account/tracking?order=${encodeURIComponent(entityId)}`;
  }

  if (entityType === "payment" && entityId) {
    if (isAdmin) {
      return `/admin/payments?search=${encodeURIComponent(entityId)}`;
    }
    if (
      type.includes("rejected") ||
      type.includes("manual_review") ||
      type.includes("receipt_submitted")
    ) {
      return `/checkout?order=${encodeURIComponent(entityId)}`;
    }
    return `/account/tracking?order=${encodeURIComponent(entityId)}`;
  }

  if (entityType === "product" && entityId) {
    if (isAdmin) {
      const searchHint =
        typeof notification.metadata?.sku === "string" && notification.metadata.sku.trim()
          ? notification.metadata.sku
          : entityId;
      return `/admin/inventory?search=${encodeURIComponent(searchHint)}`;
    }
    return `/products/${encodeURIComponent(entityId)}`;
  }

  if (entityType === "customer") {
    return isAdmin ? "/admin/customers" : "/account";
  }

  return null;
}

/**
 * Resolves a guaranteed safe internal URL for device push notification clicks.
 */
export function resolvePushNavigationUrl(
  notification: NotificationNavigationSource,
  userRole?: string | null,
): string {
  const specific = getNotificationNavigationHref(notification, userRole);
  if (specific && specific.startsWith("/")) {
    return specific;
  }
  return (userRole || "").toLowerCase() === "admin"
    ? "/admin/notifications"
    : "/account/notifications";
}

/**
 * Scrubs sensitive transaction references, URLs, phones, and emails for lock-screen privacy.
 */
export function sanitizePushNotificationText(raw: string, maxLength = 160): string {
  let cleaned = (raw || "")
    .replace(/\(\s*Ref:\s*[^)]*\)/gi, "")
    .replace(/\bRef(?:erence)?\s*[:#]\s*[A-Za-z0-9:/._-]+/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/(?:\+?251|0)?[79]\d{8}\b/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .trim();

  if (!cleaned) {
    cleaned = "Open AddisGebeya to view your latest update.";
  }

  if (cleaned.length > maxLength) {
    return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
  }

  return cleaned;
}

/**
 * Builds a lock-screen-safe Web Push payload from a persistent notification record.
 */
export function buildSafeWebPushPayload(
  notification: SafeWebPushSource,
  userRole?: string | null,
  unreadCount?: number,
): SafeWebPushPayloadResult {
  const parsedTs = Date.parse(notification.createdAt);
  const timestamp = Number.isNaN(parsedTs) ? Date.now() : parsedTs;

  return {
    notificationId: notification.id,
    title: sanitizePushNotificationText(notification.title, 80),
    body: sanitizePushNotificationText(notification.message, 160),
    icon: "/images/addisgebeya-logo.png",
    badge: "/images/addisgebeya-logo.png",
    tag: `ag-${notification.id}`,
    timestamp,
    type: notification.type,
    url: resolvePushNavigationUrl(notification, userRole),
    relatedEntityId: notification.relatedEntityId ?? null,
    relatedEntityType: notification.relatedEntityType ?? null,
    ...(typeof unreadCount === "number" ? { unreadCount } : {}),
  };
}

