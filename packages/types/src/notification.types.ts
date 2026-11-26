import type { PaginationMeta } from "./api.types.js";

export type NotificationRelatedEntityType =
  | "order"
  | "payment"
  | "product"
  | "customer"
  | "system";

export type CustomerOrderNotificationType =
  | "order_placed"
  | "order_confirmed"
  | "order_processing"
  | "order_shipped"
  | "order_out_for_delivery"
  | "order_delivered"
  | "order_cancelled";

export type CustomerPaymentNotificationType =
  | "payment_receipt_submitted"
  | "payment_verified"
  | "payment_approved"
  | "payment_rejected"
  | "payment_manual_review"
  | "payment_refund_initiated"
  | "payment_refund_completed";

export type AdminNotificationType =
  | "admin_customer_registered"
  | "admin_order_placed"
  | "admin_payment_receipt_submitted"
  | "admin_payment_manual_review"
  | "admin_payment_rejected"
  | "admin_payment_verified"
  | "admin_order_cancelled"
  | "admin_inventory_low_stock"
  | "admin_inventory_out_of_stock";

export type GeneralNotificationType =
  | "announcement"
  | "info"
  | "success"
  | "warning"
  | "error";

export type NotificationType =
  | CustomerOrderNotificationType
  | CustomerPaymentNotificationType
  | AdminNotificationType
  | GeneralNotificationType;

export type NotificationCategoryFilter =
  | "all"
  | "order"
  | "payment"
  | "inventory"
  | "customer"
  | "system";

export interface NotificationDto {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType | string;
  relatedEntityId: string | null;
  relatedEntityType: NotificationRelatedEntityType | string | null;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedNotificationsResponse {
  items: NotificationDto[];
  meta: PaginationMeta;
  unreadCount: number;
}

export interface UnreadNotificationCountResponse {
  unreadCount: number;
}

export interface MarkNotificationReadResponse {
  notification: NotificationDto;
  unreadCount: number;
}

export interface MarkAllNotificationsReadResponse {
  updatedCount: number;
  unreadCount: number;
  readAt: string;
}

export interface DeleteNotificationResponse {
  deleted: boolean;
  id: string;
  unreadCount: number;
}

export interface SocketConnectionReadyPayload {
  userId: string;
  role: "CUSTOMER" | "ADMIN";
  rooms: string[];
  unreadCount: number;
  serverTime: string;
}

export interface SocketNotificationNewPayload {
  notification: NotificationDto;
  unreadCount: number;
}

export interface SocketNotificationReadPayload {
  id: string;
  readAt: string;
  unreadCount: number;
}

export interface SocketNotificationReadAllPayload {
  unreadCount: number;
  readAt: string;
}

export interface SocketNotificationDeletedPayload {
  id: string;
  unreadCount: number;
}

export interface SocketNotificationSyncedPayload {
  notifications: NotificationDto[];
  unreadCount: number;
  serverTime: string;
}

export interface SocketAdminActivityPayload {
  type: string;
  entityType: NotificationRelatedEntityType | string;
  entityId: string;
  timestamp: string;
}

