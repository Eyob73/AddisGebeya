import {
  buildSafeWebPushPayload,
  HTTP_STATUS,
} from "@addisgebeya/shared";
import type {
  NotificationDto,
  PushSubscribeResponse,
  PushSubscriptionStatusResponse,
  PushSubscriptionSummaryDto,
  PushUnsubscribeResponse,
} from "@addisgebeya/types";
import type {
  SubscribePushNotificationInput,
  UnsubscribePushNotificationInput,
} from "@addisgebeya/validation";
import type { PushSubscription, Role } from "@prisma/client";
import { sendNotification, setVapidDetails, type RequestOptions } from "web-push";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { logger } from "../../utils/logger.js";

const GONE_OR_INVALID_STATUS_CODES = new Set([400, 403, 404, 410]);

export type WebPushSendFn = (
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  payload: string,
  options?: RequestOptions,
) => Promise<unknown>;

function mapSubscriptionToSummary(record: PushSubscription): PushSubscriptionSummaryDto {
  return {
    id: record.id,
    endpoint: record.endpoint,
    userAgent: record.userAgent ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function isHighUrgencyNotification(type: string): boolean {
  const norm = type.toLowerCase();
  return (
    norm.includes("payment_") ||
    norm.includes("order_placed") ||
    norm.includes("order_confirmed") ||
    norm.includes("out_for_delivery") ||
    norm.includes("delivered") ||
    norm.includes("cancelled")
  );
}

export class PushNotificationService {
  private vapidConfigured = false;
  private vapidConfigAttempted = false;
  private configuredKeyFingerprint = "";
  private activePublicKey = "";
  private sendFn: WebPushSendFn = (subscription, payload, options) =>
    sendNotification(subscription, payload, options);

  private ensureVapidConfigured(): boolean {
    const publicKey = (process.env.VAPID_PUBLIC_KEY ?? env.vapidPublicKey).trim();
    const privateKey = (process.env.VAPID_PRIVATE_KEY ?? env.vapidPrivateKey).trim();
    const subject = (
      process.env.VAPID_SUBJECT ??
      env.vapidSubject ??
      "mailto:support@addisgebeyashoes.et"
    ).trim();

    if (!publicKey || !privateKey) {
      if (!this.vapidConfigAttempted) {
        this.vapidConfigAttempted = true;
        logger.warn(
          "Web Push VAPID keys are not configured; device push notifications are disabled.",
        );
      }
      this.vapidConfigured = false;
      this.activePublicKey = "";
      return false;
    }

    const fingerprint = `${subject}:${publicKey}:${privateKey}`;
    if (this.vapidConfigAttempted && this.configuredKeyFingerprint === fingerprint) {
      return this.vapidConfigured;
    }

    this.vapidConfigAttempted = true;
    this.configuredKeyFingerprint = fingerprint;

    try {
      setVapidDetails(subject, publicKey, privateKey);
      this.vapidConfigured = true;
      this.activePublicKey = publicKey;
    } catch (error) {
      this.vapidConfigured = false;
      this.activePublicKey = "";
      logger.error("Invalid Web Push VAPID configuration; push delivery disabled", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return this.vapidConfigured;
  }

  isConfigured(): boolean {
    return this.ensureVapidConfigured();
  }

  getPublicKey(): string | null {
    return this.ensureVapidConfigured() ? this.activePublicKey : null;
  }

  setSendImplementationForTesting(customSend?: WebPushSendFn): void {
    this.sendFn = customSend
      ? customSend
      : (subscription, payload, options) =>
          sendNotification(subscription, payload, options);
  }

  async getStatus(userId: string, endpointFilter?: string): Promise<PushSubscriptionStatusResponse> {
    const configured = this.isConfigured();
    const [user, subscriptions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { pushNotificationsEnabled: true },
      }),
      prisma.pushSubscription.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const devices = subscriptions.map(mapSubscriptionToSummary);
    const subscribed = endpointFilter
      ? devices.some((device) => device.endpoint === endpointFilter)
      : devices.length > 0;

    return {
      configured,
      vapidPublicKey: configured ? this.activePublicKey : null,
      pushEnabled: user?.pushNotificationsEnabled ?? true,
      subscribed,
      deviceCount: devices.length,
      devices,
    };
  }

  async subscribe(
    userId: string,
    input: SubscribePushNotificationInput,
    headerUserAgent?: string,
  ): Promise<PushSubscribeResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AppError({
        message: "Active account required to register device push notifications",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "FORBIDDEN",
      });
    }

    const userAgent =
      (input.userAgent || headerUserAgent || "").trim().slice(0, 512) || null;

    const record = await prisma.$transaction(async (tx) => {
      // Re-bind endpoint to the current authenticated user so shared browsers never leak notifications
      const upserted = await tx.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: {
          userId,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent,
        },
        update: {
          userId,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { pushNotificationsEnabled: true },
      });

      return upserted;
    });

    const status = await this.getStatus(userId, record.endpoint);
    return {
      subscription: mapSubscriptionToSummary(record),
      status,
    };
  }

  async unsubscribe(
    userId: string,
    input: UnsubscribePushNotificationInput,
  ): Promise<PushUnsubscribeResponse> {
    if (!input.endpoint && !input.all) {
      throw new AppError({
        message: "Provide a subscription endpoint or set all=true to unsubscribe.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_UNSUBSCRIBE_PAYLOAD",
      });
    }

    const result = await prisma.pushSubscription.deleteMany({
      where: input.endpoint
        ? { userId, endpoint: input.endpoint }
        : { userId },
    });

    const status = await this.getStatus(userId);
    return {
      unsubscribed: true,
      removedCount: result.count,
      status,
    };
  }

  async updatePreferences(
    userId: string,
    pushEnabled: boolean,
  ): Promise<PushSubscriptionStatusResponse> {
    await prisma.user.update({
      where: { id: userId },
      data: { pushNotificationsEnabled: pushEnabled },
    });

    return this.getStatus(userId);
  }

  async sendNotificationToUser(
    notification: NotificationDto,
    userRole: Role | string,
    unreadCount?: number,
  ): Promise<{ sent: number; failed: number; removed: number }> {
    if (!this.isConfigured()) {
      return { sent: 0, failed: 0, removed: 0 };
    }

    try {
      const [user, subscriptions] = await Promise.all([
        prisma.user.findUnique({
          where: { id: notification.userId },
          select: {
            id: true,
            role: true,
            isActive: true,
            pushNotificationsEnabled: true,
          },
        }),
        prisma.pushSubscription.findMany({
          where: { userId: notification.userId },
        }),
      ]);

      if (
        !user ||
        !user.isActive ||
        !user.pushNotificationsEnabled ||
        subscriptions.length === 0
      ) {
        return { sent: 0, failed: 0, removed: 0 };
      }

      const payload = JSON.stringify(
        buildSafeWebPushPayload(notification, user.role || userRole, unreadCount),
      );
      const urgency = isHighUrgencyNotification(notification.type) ? "high" : "normal";

      let sent = 0;
      let failed = 0;
      const expiredIds: string[] = [];

      await Promise.all(
        subscriptions.map(async (sub) => {
          try {
            await this.sendFn(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              payload,
              {
                TTL: 86_400,
                urgency,
              },
            );
            sent += 1;
          } catch (error) {
            failed += 1;
            const statusCode =
              typeof error === "object" &&
              error !== null &&
              "statusCode" in error &&
              typeof (error as { statusCode?: unknown }).statusCode === "number"
                ? (error as { statusCode: number }).statusCode
                : null;

            if (statusCode !== null && GONE_OR_INVALID_STATUS_CODES.has(statusCode)) {
              expiredIds.push(sub.id);
              logger.info("Removing expired or invalid Web Push subscription", {
                subscriptionId: sub.id,
                userId: notification.userId,
                statusCode,
              });
            } else {
              logger.warn("Web Push delivery failed for subscription", {
                subscriptionId: sub.id,
                userId: notification.userId,
                statusCode,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }),
      );

      let removed = 0;
      if (expiredIds.length > 0) {
        const deleted = await prisma.pushSubscription.deleteMany({
          where: {
            id: { in: expiredIds },
            userId: notification.userId,
          },
        });
        removed = deleted.count;
      }

      return { sent, failed, removed };
    } catch (error) {
      logger.warn("Web Push dispatch encountered unexpected error", {
        notificationId: notification.id,
        userId: notification.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { sent: 0, failed: 1, removed: 0 };
    }
  }
}

export const pushNotificationService = new PushNotificationService();

