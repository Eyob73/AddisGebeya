import type {
  SocketAdminActivityPayload,
  SocketConnectionReadyPayload,
  SocketNotificationDeletedPayload,
  SocketNotificationNewPayload,
  SocketNotificationReadAllPayload,
  SocketNotificationReadPayload,
  SocketNotificationSyncedPayload,
} from "@addisgebeya/types";
import type { Server as SocketIOServer } from "socket.io";

export const SOCKET_EVENTS = {
  CONNECTION_READY: "connection:ready",
  NOTIFICATION_NEW: "notification:new",
  NOTIFICATION_READ: "notification:read",
  NOTIFICATION_READ_ALL: "notification:read_all",
  NOTIFICATION_DELETED: "notification:deleted",
  NOTIFICATION_SYNCED: "notification:synced",
  NOTIFICATION_SYNC: "notification:sync",
  NOTIFICATION_MARK_READ: "notification:mark_read",
  NOTIFICATION_MARK_ALL_READ: "notification:mark_all_read",
  ADMIN_ACTIVITY: "admin:activity",
} as const;

export const ADMIN_ROOM = "role:ADMIN" as const;

export function getUserRoom(userId: string): string {
  return `user:${userId}`;
}

export interface SocketUserData {
  id: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
  fullName: string;
}

export interface SocketAckResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

export interface ServerToClientEvents {
  [SOCKET_EVENTS.CONNECTION_READY]: (payload: SocketConnectionReadyPayload) => void;
  [SOCKET_EVENTS.NOTIFICATION_NEW]: (payload: SocketNotificationNewPayload) => void;
  [SOCKET_EVENTS.NOTIFICATION_READ]: (payload: SocketNotificationReadPayload) => void;
  [SOCKET_EVENTS.NOTIFICATION_READ_ALL]: (payload: SocketNotificationReadAllPayload) => void;
  [SOCKET_EVENTS.NOTIFICATION_DELETED]: (payload: SocketNotificationDeletedPayload) => void;
  [SOCKET_EVENTS.NOTIFICATION_SYNCED]: (payload: SocketNotificationSyncedPayload) => void;
  [SOCKET_EVENTS.ADMIN_ACTIVITY]: (payload: SocketAdminActivityPayload) => void;
  error: (payload: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  [SOCKET_EVENTS.NOTIFICATION_SYNC]: (
    payload?: { since?: string },
    ack?: (res: SocketAckResponse<SocketNotificationSyncedPayload>) => void,
  ) => void;
  [SOCKET_EVENTS.NOTIFICATION_MARK_READ]: (
    payload: { id: string },
    ack?: (res: SocketAckResponse<{ id: string; unreadCount: number }>) => void,
  ) => void;
  [SOCKET_EVENTS.NOTIFICATION_MARK_ALL_READ]: (
    ack?: (res: SocketAckResponse<{ unreadCount: number; readAt: string }>) => void,
  ) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: SocketUserData;
}

export type TypedSocketIOServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let activeIoServer: TypedSocketIOServer | null = null;

export function setActiveSocketServer(io: TypedSocketIOServer | null): void {
  activeIoServer = io;
}

export function getActiveSocketServer(): TypedSocketIOServer | null {
  return activeIoServer;
}

export function emitToUserRoom<E extends keyof ServerToClientEvents>(
  userId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
): boolean {
  if (!activeIoServer) return false;
  activeIoServer.to(getUserRoom(userId)).emit(event, ...args);
  return true;
}

export function emitToAdminRoom<E extends keyof ServerToClientEvents>(
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
): boolean {
  if (!activeIoServer) return false;
  activeIoServer.to(ADMIN_ROOM).emit(event, ...args);
  return true;
}

