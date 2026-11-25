import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { AppError } from "../../utils/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { notificationService } from "./notification.service.js";

const strParam = (p: unknown): string => (Array.isArray(p) ? String(p[0] ?? "") : String(p ?? ""));

export const notificationController = {
  listNotifications: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const notifications = await notificationService.listUserNotifications(req.user.id);
    sendSuccess(res, notifications, "Notifications retrieved successfully");
  }),

  markAsRead: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const id = strParam(req.params.id);
    const updated = await notificationService.markAsRead(req.user.id, id);
    sendSuccess(res, updated, "Notification marked as read");
  }),

  markAllAsRead: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const result = await notificationService.markAllAsRead(req.user.id);
    sendSuccess(res, result, "All notifications marked as read");
  }),

  dispatchNotification: asyncHandler(async (req: Request, res: Response) => {
    const { userId, title, message, type, broadcast } = req.body;

    if (broadcast) {
      const result = await notificationService.broadcastToAll(title, message, type);
      sendSuccess(res, result, "Notification broadcast sent successfully", 201);
      return;
    }

    if (!userId || !title || !message) {
      throw new AppError({
        message: "userId, title, and message are required",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_NOTIFICATION_PAYLOAD",
      });
    }

    const created = await notificationService.sendNotification({ userId, title, message, type });
    sendSuccess(res, created, "Notification dispatched successfully", 201);
  }),
};

