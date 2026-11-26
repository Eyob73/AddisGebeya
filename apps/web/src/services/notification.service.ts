import type {
  DeleteNotificationResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  NotificationDto,
  PaginatedNotificationsResponse,
  UnreadNotificationCountResponse,
} from "@addisgebeya/types";
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
} from "@addisgebeya/validation";
import { apiClient } from "@/lib/api-client";

export interface NotificationListParams {
  page?: number;
  limit?: number;
  isRead?: "all" | "true" | "false";
  type?: string;
  search?: string;
  since?: string;
}

export const notificationService = {
  async getNotifications(params: NotificationListParams = {}): Promise<PaginatedNotificationsResponse> {
    const validated = notificationListQuerySchema.parse(params);
    return apiClient.get<PaginatedNotificationsResponse>("/notifications", {
      params: {
        page: validated.page,
        limit: validated.limit,
        isRead: validated.isRead,
        type: validated.type,
        search: validated.search,
        since: validated.since,
      },
    });
  },

  async getUnreadCount(): Promise<UnreadNotificationCountResponse> {
    return apiClient.get<UnreadNotificationCountResponse>("/notifications/unread-count");
  },

  async markAsRead(id: string): Promise<MarkNotificationReadResponse> {
    const validated = notificationIdParamSchema.parse({ id });
    return apiClient.patch<MarkNotificationReadResponse>(
      `/notifications/${encodeURIComponent(validated.id)}/read`,
      {},
    );
  },

  async markAllAsRead(): Promise<MarkAllNotificationsReadResponse> {
    return apiClient.patch<MarkAllNotificationsReadResponse>("/notifications/read-all", {});
  },

  async deleteNotification(id: string): Promise<DeleteNotificationResponse> {
    const validated = notificationIdParamSchema.parse({ id });
    return apiClient.delete<DeleteNotificationResponse>(
      `/notifications/${encodeURIComponent(validated.id)}`,
    );
  },

  async dispatchAdminNotification(payload: {
    userId?: string;
    title: string;
    message: string;
    type?: string;
    broadcast?: boolean;
  }): Promise<NotificationDto | { count: number }> {
    return apiClient.post("/notifications", payload);
  },
};

