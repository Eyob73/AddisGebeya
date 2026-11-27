import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import {
  adminDispatchNotificationSchema,
  notificationIdParamSchema,
  notificationListQuerySchema,
  pushStatusQuerySchema,
  subscribePushNotificationSchema,
  unsubscribePushNotificationSchema,
  updatePushPreferencesSchema,
} from "./notification.validation.js";
import { AppError } from "../../utils/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { notificationService } from "./notification.service.js";
import { pushNotificationService } from "./push.service.js";

function requireAuthenticatedUserId(req: Request): string {
  if (!req.user?.id) {
    throw new AppError({
      message: "Authentication required",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: "UNAUTHORIZED",
    });
  }
  return req.user.id;
}

export const notificationController = {
  listNotifications: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req);
    const query = notificationListQuerySchema.parse(req.query);
    const result = await notificationService.getUserNotifications(userId, query);
    sendSuccess(res, result, "Notifications retrieved successfully");
  }),

  getUnreadCount: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req);
    const unreadCount = await notificationService.getUnreadNotificationCount(userId);
    sendSuccess(res, { unreadCount }, "Unread notification count retrieved successfully");
  }),

  markAsRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req);
    const { id } = notificationIdParamSchema.parse(req.params);
    const result = await notificationService.markAsRead(userId, id);
    sendSuccess(res, result, "Notification marked as read");
  }),

  markAllAsRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req);
    const result = await notificationService.markAllAsRead(userId);
    sendSuccess(res, result, "All notifications marked as read");
  }),

  deleteNotification: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req);
    const { id } = notificationIdParamSchema.parse(req.params);
    const result = await notificationService.deleteNotification(userId, id);
    sendSuccess(res, result, "Notification deleted successfully");
  }),

  dispatchNotification: asyncHandler(async (req: Request, res: Response) => {
    const payload = adminDispatchNotificationSchema.parse(req.body);

    if (payload.broadcast) {
      const result = await notificationService.broadcastToAll(
        payload.title,
        payload.message,
        payload.type,
      );
      sendSuccess(res, result, "Notification broadcast sent successfully", HTTP_STATUS.CREATED);
      return;
    }

    const created = await notificationService.sendNotification({
      userId: payload.userId!,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      relatedEntityId: payload.relatedEntityId ?? null,
      relatedEntityType: payload.relatedEntityType ?? "system",
    });
    sendSuccess(res, created, "Notification dispatched successfully", HTTP_STATUS.CREATED);
  }),

  getPushStatus: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req);
    const { endpoint } = pushStatusQuerySchema.parse(req.query);
    const result = await pushNotificationService.getStatus(userId, endpoint);
    sendSuccess(res, result, "Push notification status retrieved successfully");
  }),

  subscribePush: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req);
    const payload = subscribePushNotificationSchema.parse(req.body);
    const result = await pushNotificationService.subscribe(
      userId,
      payload,
      req.get("user-agent"),
    );
    sendSuccess(res, result, "Device push notifications enabled", HTTP_STATUS.CREATED);
  }),

  unsubscribePush: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req);
    const payload = unsubscribePushNotificationSchema.parse(req.body ?? {});
    const result = await pushNotificationService.unsubscribe(userId, payload);
    sendSuccess(res, result, "Device push subscription removed");
  }),

  updatePushPreferences: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req);
    const { pushEnabled } = updatePushPreferencesSchema.parse(req.body);
    const result = await pushNotificationService.updatePreferences(userId, pushEnabled);
    sendSuccess(res, result, "Push notification preferences updated");
  }),

  sendTestPush: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req);
    const result = await notificationService.sendTestPushNotification(userId);
    sendSuccess(res, result, "Test push notification processed", HTTP_STATUS.CREATED);
  }),
};
