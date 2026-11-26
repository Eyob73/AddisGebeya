import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CreditCard,
  Info,
  Package,
  RefreshCw,
  ShieldAlert,
  Truck,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { NotificationDto } from "@addisgebeya/types";

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;

  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 45) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: diffDays > 300 ? "numeric" : undefined,
  });
}

export function formatExactDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface NotificationVisualMeta {
  icon: LucideIcon;
  badgeLabel: string;
  badgeVariant: "default" | "cta" | "secondary" | "soft" | "success" | "warning" | "destructive" | "outline";
  iconBgClass: string;
}

export function getNotificationVisualMeta(type: string): NotificationVisualMeta {
  const norm = (type || "").toLowerCase();

  if (norm === "admin_customer_registered") {
    return {
      icon: UserPlus,
      badgeLabel: "New Customer",
      badgeVariant: "secondary",
      iconBgClass: "bg-primary-light text-primary",
    };
  }
  if (norm === "admin_inventory_out_of_stock") {
    return {
      icon: XCircle,
      badgeLabel: "Out of Stock",
      badgeVariant: "destructive",
      iconBgClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    };
  }
  if (norm === "admin_inventory_low_stock") {
    return {
      icon: AlertTriangle,
      badgeLabel: "Low Stock",
      badgeVariant: "warning",
      iconBgClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    };
  }
  if (norm.includes("rejected")) {
    return {
      icon: XCircle,
      badgeLabel: "Rejected",
      badgeVariant: "destructive",
      iconBgClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    };
  }
  if (norm.includes("manual_review")) {
    return {
      icon: ShieldAlert,
      badgeLabel: "Manual Review",
      badgeVariant: "warning",
      iconBgClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    };
  }
  if (norm.includes("refund")) {
    return {
      icon: RefreshCw,
      badgeLabel: norm.includes("completed") ? "Refunded" : "Refund",
      badgeVariant: norm.includes("completed") ? "success" : "warning",
      iconBgClass: "bg-primary-light text-primary",
    };
  }
  if (norm.includes("payment_verified") || norm.includes("payment_approved")) {
    return {
      icon: CheckCircle2,
      badgeLabel: "Payment Verified",
      badgeVariant: "success",
      iconBgClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    };
  }
  if (norm.includes("payment")) {
    return {
      icon: CreditCard,
      badgeLabel: "Payment",
      badgeVariant: "soft",
      iconBgClass: "bg-primary-light text-primary",
    };
  }
  if (norm.includes("cancelled")) {
    return {
      icon: XCircle,
      badgeLabel: "Cancelled",
      badgeVariant: "destructive",
      iconBgClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    };
  }
  if (norm.includes("delivered")) {
    return {
      icon: CheckCircle2,
      badgeLabel: "Delivered",
      badgeVariant: "success",
      iconBgClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    };
  }
  if (norm.includes("shipped") || norm.includes("out_for_delivery")) {
    return {
      icon: Truck,
      badgeLabel: norm.includes("out_for_delivery") ? "Out for Delivery" : "Dispatched",
      badgeVariant: "cta",
      iconBgClass: "bg-cta-light text-cta",
    };
  }
  if (norm.includes("order")) {
    return {
      icon: Package,
      badgeLabel: norm.includes("confirmed") ? "Confirmed" : "Order",
      badgeVariant: norm.includes("confirmed") ? "success" : "secondary",
      iconBgClass: "bg-primary-light text-primary",
    };
  }
  if (norm === "success") {
    return {
      icon: CheckCircle2,
      badgeLabel: "Success",
      badgeVariant: "success",
      iconBgClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    };
  }
  if (norm === "warning") {
    return {
      icon: AlertTriangle,
      badgeLabel: "Alert",
      badgeVariant: "warning",
      iconBgClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    };
  }
  if (norm === "error") {
    return {
      icon: XCircle,
      badgeLabel: "Alert",
      badgeVariant: "destructive",
      iconBgClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    };
  }
  if (norm === "announcement") {
    return {
      icon: Bell,
      badgeLabel: "Announcement",
      badgeVariant: "cta",
      iconBgClass: "bg-cta-light text-cta",
    };
  }

  return {
    icon: Info,
    badgeLabel: "Update",
    badgeVariant: "soft",
    iconBgClass: "bg-primary-light text-primary",
  };
}

export function getNotificationNavigationHref(
  notification: NotificationDto,
  userRole?: "customer" | "admin",
): string | null {
  const entityType = notification.relatedEntityType;
  const entityId = notification.relatedEntityId;
  const isAdmin = userRole === "admin";
  const type = notification.type.toLowerCase();

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

