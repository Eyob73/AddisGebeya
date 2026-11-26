import { create } from "zustand";
import type { NotificationDto } from "@addisgebeya/types";

export type NotificationSocketStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

const MAX_IN_MEMORY_ITEMS = 60;

function mergeSortedNotifications(
  existing: NotificationDto[],
  incoming: NotificationDto[],
): NotificationDto[] {
  const map = new Map<string, NotificationDto>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return Array.from(map.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_IN_MEMORY_ITEMS);
}

interface NotificationState {
  items: NotificationDto[];
  unreadCount: number;
  connectionStatus: NotificationSocketStatus;
  lastSyncedAt: string | null;
  seenRealtimeIds: Record<string, true>;

  setConnectionStatus: (status: NotificationSocketStatus) => void;
  hydrateFromServer: (items: NotificationDto[], unreadCount: number) => void;
  setUnreadCount: (unreadCount: number) => void;
  receiveRealtimeNotification: (notification: NotificationDto, unreadCount?: number) => boolean;
  mergeSyncedNotifications: (
    notifications: NotificationDto[],
    unreadCount: number,
    serverTime?: string,
  ) => void;
  markReadLocal: (id: string, readAt?: string, unreadCount?: number) => void;
  markAllReadLocal: (readAt?: string) => void;
  removeLocal: (id: string, unreadCount?: number) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  items: [],
  unreadCount: 0,
  connectionStatus: "disconnected",
  lastSyncedAt: null,
  seenRealtimeIds: {},

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  hydrateFromServer: (items, unreadCount) =>
    set((state) => ({
      items: mergeSortedNotifications(items, []),
      unreadCount: Math.max(0, unreadCount),
      lastSyncedAt: state.lastSyncedAt ?? new Date().toISOString(),
    })),

  setUnreadCount: (unreadCount) => set({ unreadCount: Math.max(0, unreadCount) }),

  receiveRealtimeNotification: (notification, unreadCount) => {
    const state = get();
    const alreadySeenToast = Boolean(state.seenRealtimeIds[notification.id]);
    const alreadyInItems = state.items.some((item) => item.id === notification.id);

    const nextItems = mergeSortedNotifications(state.items, [notification]);
    const computedUnread =
      typeof unreadCount === "number"
        ? Math.max(0, unreadCount)
        : !alreadyInItems && !notification.isRead
          ? state.unreadCount + 1
          : state.unreadCount;

    set({
      items: nextItems,
      unreadCount: computedUnread,
      lastSyncedAt: notification.createdAt,
      seenRealtimeIds: alreadySeenToast
        ? state.seenRealtimeIds
        : { ...state.seenRealtimeIds, [notification.id]: true },
    });

    return !alreadySeenToast;
  },

  mergeSyncedNotifications: (notifications, unreadCount, serverTime) =>
    set((state) => ({
      items: mergeSortedNotifications(state.items, notifications),
      unreadCount: Math.max(0, unreadCount),
      lastSyncedAt: serverTime ?? new Date().toISOString(),
    })),

  markReadLocal: (id, readAt, unreadCount) =>
    set((state) => {
      const target = state.items.find((n) => n.id === id);
      const wasUnread = Boolean(target && !target.isRead);
      const nextReadAt = readAt ?? new Date().toISOString();

      return {
        items: state.items.map((item) =>
          item.id === id ? { ...item, isRead: true, readAt: item.readAt ?? nextReadAt } : item,
        ),
        unreadCount:
          typeof unreadCount === "number"
            ? Math.max(0, unreadCount)
            : wasUnread
              ? Math.max(0, state.unreadCount - 1)
              : state.unreadCount,
      };
    }),

  markAllReadLocal: (readAt) =>
    set((state) => {
      const nextReadAt = readAt ?? new Date().toISOString();
      return {
        items: state.items.map((item) =>
          item.isRead ? item : { ...item, isRead: true, readAt: item.readAt ?? nextReadAt },
        ),
        unreadCount: 0,
      };
    }),

  removeLocal: (id, unreadCount) =>
    set((state) => {
      const target = state.items.find((n) => n.id === id);
      const wasUnread = Boolean(target && !target.isRead);
      return {
        items: state.items.filter((item) => item.id !== id),
        unreadCount:
          typeof unreadCount === "number"
            ? Math.max(0, unreadCount)
            : wasUnread
              ? Math.max(0, state.unreadCount - 1)
              : state.unreadCount,
      };
    }),

  reset: () =>
    set({
      items: [],
      unreadCount: 0,
      connectionStatus: "disconnected",
      lastSyncedAt: null,
      seenRealtimeIds: {},
    }),
}));

