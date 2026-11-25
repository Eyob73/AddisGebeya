import { HTTP_STATUS } from "@addisgebeya/shared";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";

export class NotificationService {
  async listUserNotifications(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new AppError({
        message: "Notification not found or unauthorized",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "NOTIFICATION_NOT_FOUND",
      });
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async sendNotification(data: { userId: string; title: string; message: string; type?: string }) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type || "info",
      },
    });
  }

  async broadcastToAll(title: string, message: string, type = "announcement") {
    const users = await prisma.user.findMany({ select: { id: true } });
    if (users.length === 0) return { count: 0 };

    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title,
        message,
        type,
      })),
    });

    return { count: users.length };
  }
}

export const notificationService = new NotificationService();

