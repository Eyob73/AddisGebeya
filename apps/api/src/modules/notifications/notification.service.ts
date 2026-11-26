import { HTTP_STATUS } from "@addisgebeya/shared";
import type {
  DeleteNotificationResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  NotificationDto,
  NotificationRelatedEntityType,
  PaginatedNotificationsResponse,
  SocketNotificationSyncedPayload,
} from "@addisgebeya/types";
import { notificationListQuerySchema } from "@addisgebeya/validation";
import { Prisma, Role, type Notification } from "@prisma/client";
import { prisma } from "../../config/database.js";
import {
  emitToAdminRoom,
  emitToUserRoom,
  getActiveSocketServer,
  SOCKET_EVENTS,
} from "../../socket/socket.events.js";
import { AppError } from "../../utils/app-error.js";
import { logger } from "../../utils/logger.js";

export type DbClient = Prisma.TransactionClient | typeof prisma;

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: string;
  relatedEntityId?: string | null;
  relatedEntityType?: NotificationRelatedEntityType | string | null;
  metadata?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
}

export interface CreateNotificationResult {
  notification: NotificationDto;
  deduplicated: boolean;
}

const MAX_OUTBOX_ATTEMPTS = 10;

function toJsonInput(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export function mapNotificationToDto(record: Notification): NotificationDto {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    message: record.message,
    type: record.type,
    relatedEntityId: record.relatedEntityId ?? null,
    relatedEntityType: record.relatedEntityType ?? null,
    metadata:
      record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : null,
    isRead: record.isRead,
    readAt: record.readAt ? record.readAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildTypeFilter(rawType: string): Prisma.NotificationWhereInput {
  const normalized = rawType.trim().toLowerCase();
  if (!normalized || normalized === "all") {
    return {};
  }

  switch (normalized) {
    case "order":
      return {
        OR: [
          { type: { startsWith: "order_" } },
          { type: { startsWith: "admin_order_" } },
          { relatedEntityType: "order" },
        ],
      };
    case "payment":
      return {
        OR: [
          { type: { startsWith: "payment_" } },
          { type: { startsWith: "admin_payment_" } },
          { relatedEntityType: "payment" },
        ],
      };
    case "inventory":
      return {
        OR: [
          { type: { startsWith: "admin_inventory_" } },
          { relatedEntityType: "product" },
        ],
      };
    case "customer":
      return {
        OR: [
          { type: { startsWith: "admin_customer_" } },
          { relatedEntityType: "customer" },
        ],
      };
    case "system":
      return {
        type: { in: ["announcement", "info", "success", "warning", "error", "system"] },
      };
    default:
      return { type: rawType.trim() };
  }
}

export class NotificationService {
  private flushInFlight: Promise<{ processed: number; failed: number }> | null = null;

  async createNotification(
    input: CreateNotificationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CreateNotificationResult> {
    const persist = async (db: Prisma.TransactionClient): Promise<CreateNotificationResult> => {
      const normalizedKey = input.idempotencyKey?.trim() || null;
      if (normalizedKey) {
        const existing = await db.notification.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: input.userId,
              idempotencyKey: normalizedKey,
            },
          },
        });
        if (existing) {
          return {
            notification: mapNotificationToDto(existing),
            deduplicated: true,
          };
        }
      }

      const created = await db.notification.create({
        data: {
          userId: input.userId,
          title: input.title,
          message: input.message,
          type: input.type || "info",
          relatedEntityId: input.relatedEntityId ?? null,
          relatedEntityType: input.relatedEntityType ?? null,
          metadata: toJsonInput(input.metadata),
          idempotencyKey: normalizedKey,
        },
      });

      const dto = mapNotificationToDto(created);

      await db.notificationOutbox.create({
        data: {
          notificationId: created.id,
          userId: created.userId,
          eventName: SOCKET_EVENTS.NOTIFICATION_NEW,
          payload: dto as unknown as Prisma.InputJsonValue,
          status: "pending",
          nextRetryAt: new Date(),
        },
      });

      return {
        notification: dto,
        deduplicated: false,
      };
    };

    if (tx) {
      return persist(tx);
    }

    let result: CreateNotificationResult;
    try {
      result = await prisma.$transaction((innerTx) => persist(innerTx));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        input.idempotencyKey?.trim()
      ) {
        const existing = await prisma.notification.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: input.userId,
              idempotencyKey: input.idempotencyKey.trim(),
            },
          },
        });
        if (existing) {
          return {
            notification: mapNotificationToDto(existing),
            deduplicated: true,
          };
        }
      }
      throw error;
    }

    if (!result.deduplicated) {
      await this.flushOutbox().catch((err) => {
        logger.warn("Immediate notification outbox dispatch failed; retry queued", {
          notificationId: result.notification.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    return result;
  }

  async createBulkNotifications(
    inputs: CreateNotificationInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<NotificationDto[]> {
    if (inputs.length === 0) return [];

    // In-memory deduplication for identical (userId, idempotencyKey) within batch
    const deduped: CreateNotificationInput[] = [];
    const seenBatchKeys = new Set<string>();
    for (const item of inputs) {
      const key = item.idempotencyKey?.trim();
      if (key) {
        const composite = `${item.userId}::${key}`;
        if (seenBatchKeys.has(composite)) continue;
        seenBatchKeys.add(composite);
      }
      deduped.push(item);
    }

    const persistBatch = async (db: Prisma.TransactionClient): Promise<NotificationDto[]> => {
      const createdDtos: NotificationDto[] = [];
      for (const item of deduped) {
        const res = await this.createNotification(item, db);
        if (!res.deduplicated) {
          createdDtos.push(res.notification);
        }
      }
      return createdDtos;
    };

    if (tx) {
      return persistBatch(tx);
    }

    const created = await prisma.$transaction((innerTx) => persistBatch(innerTx));

    if (created.length > 0) {
      await this.flushOutbox().catch((err) => {
        logger.warn("Immediate bulk notification outbox dispatch failed; retry queued", {
          count: created.length,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    return created;
  }

  async notifyAdmins(
    payload: Omit<CreateNotificationInput, "userId">,
    tx?: Prisma.TransactionClient,
  ): Promise<NotificationDto[]> {
    const db: DbClient = tx ?? prisma;
    const activeAdmins = await db.user.findMany({
      where: {
        role: Role.ADMIN,
        isActive: true,
      },
      select: { id: true },
    });

    if (activeAdmins.length === 0) {
      return [];
    }

    const inputs: CreateNotificationInput[] = activeAdmins.map((admin) => ({
      ...payload,
      userId: admin.id,
    }));

    return this.createBulkNotifications(inputs, tx);
  }

  async flushOutbox(limit = 50): Promise<{ processed: number; failed: number }> {
    if (!getActiveSocketServer()) {
      return { processed: 0, failed: 0 };
    }

    if (this.flushInFlight) {
      return this.flushInFlight;
    }

    this.flushInFlight = this.executeOutboxFlush(limit).finally(() => {
      this.flushInFlight = null;
    });

    return this.flushInFlight;
  }

  private async executeOutboxFlush(limit: number): Promise<{ processed: number; failed: number }> {
    const io = getActiveSocketServer();
    if (!io) {
      return { processed: 0, failed: 0 };
    }

    const now = new Date();
    const staleProcessingCutoff = new Date(now.getTime() - 60_000);

    const candidates = await prisma.notificationOutbox.findMany({
      where: {
        attempts: { lt: MAX_OUTBOX_ATTEMPTS },
        OR: [
          {
            status: { in: ["pending", "failed"] },
            nextRetryAt: { lte: now },
          },
          {
            status: "processing",
            updatedAt: { lt: staleProcessingCutoff },
          },
        ],
      },
      include: {
        notification: true,
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    if (candidates.length === 0) {
      return { processed: 0, failed: 0 };
    }

    const unreadCache = new Map<string, number>();
    const adminPulseSent = new Set<string>();
    let processed = 0;
    let failed = 0;

    for (const entry of candidates) {
      // Atomic claim to prevent duplicate delivery across concurrent workers/calls
      const claimed = await prisma.notificationOutbox.updateMany({
        where: {
          id: entry.id,
          OR: [
            { status: { in: ["pending", "failed"] } },
            { status: "processing", updatedAt: { lt: staleProcessingCutoff } },
          ],
        },
        data: {
          status: "processing",
        },
      });

      if (claimed.count === 0) {
        continue;
      }

      try {
        const dto = mapNotificationToDto(entry.notification);
        let unreadCount = unreadCache.get(dto.userId);
        if (unreadCount === undefined) {
          unreadCount = await this.getUnreadNotificationCount(dto.userId);
          unreadCache.set(dto.userId, unreadCount);
        }

        const delivered = emitToUserRoom(dto.userId, SOCKET_EVENTS.NOTIFICATION_NEW, {
          notification: dto,
          unreadCount,
        });

        if (!delivered) {
          throw new Error("Socket.IO server unavailable during outbox dispatch");
        }

        if (dto.type.startsWith("admin_") && dto.relatedEntityId) {
          const pulseKey = `${dto.type}:${dto.relatedEntityType ?? "system"}:${dto.relatedEntityId}`;
          if (!adminPulseSent.has(pulseKey)) {
            adminPulseSent.add(pulseKey);
            emitToAdminRoom(SOCKET_EVENTS.ADMIN_ACTIVITY, {
              type: dto.type,
              entityType: dto.relatedEntityType ?? "system",
              entityId: dto.relatedEntityId,
              timestamp: dto.createdAt,
            });
          }
        }

        await prisma.notificationOutbox.update({
          where: { id: entry.id },
          data: {
            status: "dispatched",
            dispatchedAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });
        processed += 1;
      } catch (err) {
        const nextAttempts = entry.attempts + 1;
        const backoffMs = Math.min(60_000, 2_000 * 2 ** Math.min(nextAttempts, 5));
        await prisma.notificationOutbox.update({
          where: { id: entry.id },
          data: {
            status: "failed",
            attempts: { increment: 1 },
            lastError: err instanceof Error ? err.message : String(err),
            nextRetryAt: new Date(Date.now() + backoffMs),
          },
        });
        failed += 1;
      }
    }

    return { processed, failed };
  }

  async getUserNotifications(
    userId: string,
    rawQuery: unknown = {},
  ): Promise<PaginatedNotificationsResponse> {
    const query = notificationListQuerySchema.parse(rawQuery ?? {});
    const andClauses: Prisma.NotificationWhereInput[] = [{ userId }];

    if (query.isRead === "true") {
      andClauses.push({ isRead: true });
    } else if (query.isRead === "false") {
      andClauses.push({ isRead: false });
    }

    if (query.type && query.type !== "all") {
      andClauses.push(buildTypeFilter(query.type));
    }

    if (query.since) {
      const sinceDate = new Date(query.since);
      if (!Number.isNaN(sinceDate.getTime())) {
        andClauses.push({ createdAt: { gt: sinceDate } });
      }
    }

    if (query.search) {
      const term = query.search.trim();
      andClauses.push({
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { message: { contains: term, mode: "insensitive" } },
          { relatedEntityId: { contains: term, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.NotificationWhereInput = { AND: andClauses };
    const skip = (query.page - 1) * query.limit;

    const [total, records, unreadCount] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: query.limit,
      }),
      this.getUnreadNotificationCount(userId),
    ]);

    return {
      items: records.map(mapNotificationToDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
      unreadCount,
    };
  }

  async listUserNotifications(userId: string): Promise<NotificationDto[]> {
    const result = await this.getUserNotifications(userId, { page: 1, limit: 50 });
    return result.items;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async getMissedNotifications(
    userId: string,
    since?: string,
  ): Promise<SocketNotificationSyncedPayload> {
    const where: Prisma.NotificationWhereInput = { userId };
    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        where.createdAt = { gt: sinceDate };
      }
    }

    const [records, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
      }),
      this.getUnreadNotificationCount(userId),
    ]);

    return {
      notifications: records.map(mapNotificationToDto),
      unreadCount,
      serverTime: new Date().toISOString(),
    };
  }

  async markAsRead(userId: string, notificationId: string): Promise<MarkNotificationReadResponse> {
    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!existing) {
      throw new AppError({
        message: "Notification not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "NOTIFICATION_NOT_FOUND",
      });
    }

    if (existing.userId !== userId) {
      throw new AppError({
        message: "You do not have permission to access this notification",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "FORBIDDEN",
      });
    }

    const now = existing.readAt ?? new Date();
    const updated = existing.isRead
      ? existing
      : await prisma.notification.update({
          where: { id: notificationId },
          data: {
            isRead: true,
            readAt: now,
          },
        });

    const unreadCount = await this.getUnreadNotificationCount(userId);
    const dto = mapNotificationToDto(updated);

    emitToUserRoom(userId, SOCKET_EVENTS.NOTIFICATION_READ, {
      id: dto.id,
      readAt: dto.readAt ?? now.toISOString(),
      unreadCount,
    });

    return {
      notification: dto,
      unreadCount,
    };
  }

  async markAllAsRead(userId: string): Promise<MarkAllNotificationsReadResponse> {
    const now = new Date();
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: now,
      },
    });

    const readAtIso = now.toISOString();
    emitToUserRoom(userId, SOCKET_EVENTS.NOTIFICATION_READ_ALL, {
      unreadCount: 0,
      readAt: readAtIso,
    });

    return {
      updatedCount: result.count,
      unreadCount: 0,
      readAt: readAtIso,
    };
  }

  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<DeleteNotificationResponse> {
    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!existing) {
      throw new AppError({
        message: "Notification not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "NOTIFICATION_NOT_FOUND",
      });
    }

    if (existing.userId !== userId) {
      throw new AppError({
        message: "You do not have permission to delete this notification",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "FORBIDDEN",
      });
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    const unreadCount = await this.getUnreadNotificationCount(userId);

    emitToUserRoom(userId, SOCKET_EVENTS.NOTIFICATION_DELETED, {
      id: notificationId,
      unreadCount,
    });

    return {
      deleted: true,
      id: notificationId,
      unreadCount,
    };
  }

  async sendNotification(data: CreateNotificationInput): Promise<NotificationDto> {
    const res = await this.createNotification(data);
    return res.notification;
  }

  async broadcastToAll(
    title: string,
    message: string,
    type = "announcement",
  ): Promise<{ count: number }> {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    if (users.length === 0) return { count: 0 };

    const created = await this.createBulkNotifications(
      users.map((u) => ({
        userId: u.id,
        title,
        message,
        type,
        relatedEntityType: "system",
      })),
    );

    return { count: created.length };
  }
}

export const notificationService = new NotificationService();
