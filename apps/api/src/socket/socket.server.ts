import type { Server as HttpServer } from "node:http";
import { notificationIdParamSchema } from "@addisgebeya/validation";
import { Server as SocketIOServer } from "socket.io";
import { isOriginAllowed } from "../config/cors.js";
import { notificationService } from "../modules/notifications/notification.service.js";
import { logger } from "../utils/logger.js";
import { authenticateSocket } from "./socket.auth.js";
import {
  ADMIN_ROOM,
  getActiveSocketServer,
  getUserRoom,
  setActiveSocketServer,
  SOCKET_EVENTS,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
  type TypedSocketIOServer,
} from "./socket.events.js";

const ALLOWED_CLIENT_EVENTS = new Set<string>([
  SOCKET_EVENTS.NOTIFICATION_SYNC,
  SOCKET_EVENTS.NOTIFICATION_MARK_READ,
  SOCKET_EVENTS.NOTIFICATION_MARK_ALL_READ,
]);

const ROOM_JOIN_ATTEMPT_EVENTS = new Set<string>([
  "join",
  "join_room",
  "joinRoom",
  "subscribe",
  "room:join",
]);

let outboxWorkerTimer: NodeJS.Timeout | null = null;

export function initSocketServer(httpServer: HttpServer): TypedSocketIOServer {
  const existing = getActiveSocketServer();
  if (existing) {
    return existing;
  }

  const io: TypedSocketIOServer = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }
        logger.warn("Socket.IO connection rejected by CORS policy", { origin });
        callback(new Error(`Socket origin ${origin} is not allowed by CORS policy`));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  setActiveSocketServer(io);

  // Authenticate every Socket.IO handshake using verified JWT + active PostgreSQL user
  io.use((socket, next) => {
    void authenticateSocket(socket, next);
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    const userRoom = getUserRoom(user.id);
    await socket.join(userRoom);
    const rooms = [userRoom];

    if (user.role === "ADMIN") {
      await socket.join(ADMIN_ROOM);
      rooms.push(ADMIN_ROOM);
    }

    logger.info("Socket client authenticated and joined verified rooms", {
      socketId: socket.id,
      userId: user.id,
      role: user.role,
      rooms,
    });

    // Reject unauthorized room join attempts and non-whitelisted internal events
    socket.use((packet, next) => {
      const eventName = packet[0];
      if (ROOM_JOIN_ATTEMPT_EVENTS.has(eventName)) {
        logger.warn("Blocked client attempt to join Socket.IO room directly", {
          socketId: socket.id,
          userId: user.id,
          eventName,
        });
        const maybeAck = packet[packet.length - 1];
        if (typeof maybeAck === "function") {
          maybeAck({
            success: false,
            code: "FORBIDDEN",
            message: "Direct room subscription is prohibited. Rooms are server-assigned.",
          });
        }
        socket.emit("error", {
          code: "FORBIDDEN",
          message: "Direct room subscription is prohibited.",
        });
        return;
      }

      if (!ALLOWED_CLIENT_EVENTS.has(eventName)) {
        logger.warn("Blocked unauthorized or unknown client Socket.IO event", {
          socketId: socket.id,
          userId: user.id,
          eventName,
        });
        next(new Error("FORBIDDEN_EVENT"));
        return;
      }

      next();
    });

    try {
      const unreadCount = await notificationService.getUnreadNotificationCount(user.id);
      socket.emit(SOCKET_EVENTS.CONNECTION_READY, {
        userId: user.id,
        role: user.role,
        rooms,
        unreadCount,
        serverTime: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Failed to send connection:ready unread count", {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    socket.on(SOCKET_EVENTS.NOTIFICATION_SYNC, async (payload, ack) => {
      try {
        const since =
          payload && typeof payload.since === "string" && payload.since.trim()
            ? payload.since.trim()
            : undefined;
        const synced = await notificationService.getMissedNotifications(user.id, since);
        socket.emit(SOCKET_EVENTS.NOTIFICATION_SYNCED, synced);
        ack?.({ success: true, data: synced });
      } catch (err) {
        ack?.({
          success: false,
          code: "SYNC_FAILED",
          message: err instanceof Error ? err.message : "Could not sync notifications",
        });
      }
    });

    socket.on(SOCKET_EVENTS.NOTIFICATION_MARK_READ, async (payload, ack) => {
      try {
        const parsed = notificationIdParamSchema.safeParse(payload);
        if (!parsed.success) {
          ack?.({
            success: false,
            code: "VALIDATION_ERROR",
            message: "Valid notification ID is required",
          });
          return;
        }
        const res = await notificationService.markAsRead(user.id, parsed.data.id);
        ack?.({
          success: true,
          data: { id: res.notification.id, unreadCount: res.unreadCount },
        });
      } catch (err) {
        ack?.({
          success: false,
          code: "MARK_READ_FAILED",
          message: err instanceof Error ? err.message : "Could not mark notification as read",
        });
      }
    });

    socket.on(SOCKET_EVENTS.NOTIFICATION_MARK_ALL_READ, async (ack) => {
      try {
        const res = await notificationService.markAllAsRead(user.id);
        ack?.({
          success: true,
          data: { unreadCount: res.unreadCount, readAt: res.readAt },
        });
      } catch (err) {
        ack?.({
          success: false,
          code: "MARK_ALL_READ_FAILED",
          message: err instanceof Error ? err.message : "Could not mark all notifications as read",
        });
      }
    });

    socket.on("disconnect", (reason) => {
      logger.info("Socket client disconnected", {
        socketId: socket.id,
        userId: user.id,
        reason,
      });
    });

    socket.on("error", (err) => {
      logger.warn("Socket client error", {
        socketId: socket.id,
        userId: user.id,
        error: err.message,
      });
    });
  });

  // Periodic transactional outbox retry worker for transient delivery failures
  if (!outboxWorkerTimer) {
    outboxWorkerTimer = setInterval(() => {
      void notificationService.flushOutbox().catch((err) => {
        logger.warn("Background notification outbox flush failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, 10_000);
    outboxWorkerTimer.unref();
  }

  // Flush any pending outbox items persisted while socket server was offline
  void notificationService.flushOutbox().catch((err) => {
    logger.warn("Initial notification outbox flush failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return io;
}

export async function closeSocketServer(): Promise<void> {
  if (outboxWorkerTimer) {
    clearInterval(outboxWorkerTimer);
    outboxWorkerTimer = null;
  }

  const io = getActiveSocketServer();
  if (io) {
    setActiveSocketServer(null);
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
  }
}

