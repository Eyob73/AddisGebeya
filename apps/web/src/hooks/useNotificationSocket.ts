"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import type {
  ApiSuccessResponse,
  NotificationDto,
  SocketAdminActivityPayload,
  SocketConnectionReadyPayload,
  SocketNotificationDeletedPayload,
  SocketNotificationNewPayload,
  SocketNotificationReadAllPayload,
  SocketNotificationReadPayload,
  SocketNotificationSyncedPayload,
} from "@addisgebeya/types";
import { getStoredAccessToken, setStoredTokens } from "@/lib/api-client";
import { clientEnv } from "@/lib/env";
import { useAuthStore } from "@/stores/auth.store";
import { useNotificationStore } from "@/stores/notification.store";
import { useUiStore } from "@/stores/ui.store";

function getToastVariantForNotification(
  type: string,
): "default" | "success" | "warning" | "error" {
  const norm = type.toLowerCase();
  if (
    norm.includes("verified") ||
    norm.includes("approved") ||
    norm.includes("delivered") ||
    norm.includes("confirmed") ||
    norm.includes("refund_completed") ||
    norm === "success"
  ) {
    return "success";
  }
  if (norm.includes("rejected") || norm.includes("out_of_stock") || norm === "error") {
    return "error";
  }
  if (
    norm.includes("manual_review") ||
    norm.includes("low_stock") ||
    norm.includes("cancelled") ||
    norm === "warning"
  ) {
    return "warning";
  }
  return "default";
}

async function refreshAccessTokenForSocket(): Promise<string | null> {
  try {
    const normalizedBase = clientEnv.apiUrl.replace(/\/+$/, "");
    const res = await fetch(`${normalizedBase}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as
      | ApiSuccessResponse<{ accessToken: string }>
      | null;
    if (payload?.success && payload.data?.accessToken) {
      setStoredTokens(payload.data.accessToken);
      return payload.data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

export function useNotificationSocket() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const socketRef = React.useRef<Socket | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated || !userId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      useNotificationStore.getState().reset();
      return;
    }

    const token = getStoredAccessToken();
    if (!token) {
      return;
    }

    const store = useNotificationStore.getState();
    store.setConnectionStatus("connecting");

    const socket = io(clientEnv.socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      timeout: 15000,
    });

    socketRef.current = socket;
    let refreshingToken = false;

    const invalidateNotificationQueries = () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    };

    const invalidateDomainQueries = (notification: NotificationDto) => {
      const entityType = notification.relatedEntityType;
      const type = notification.type;

      if (entityType === "order" || type.includes("order")) {
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      }
      if (entityType === "payment" || type.includes("payment")) {
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        void queryClient.invalidateQueries({ queryKey: ["payment-status"] });
        void queryClient.invalidateQueries({ queryKey: ["payment-receipts"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      }
      if (entityType === "product" || type.includes("inventory")) {
        void queryClient.invalidateQueries({ queryKey: ["products"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      }
      if (entityType === "customer" || type.includes("customer")) {
        void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      }
    };

    socket.on("connect", () => {
      const state = useNotificationStore.getState();
      state.setConnectionStatus("connected");
      socket.emit("notification:sync", {
        since: state.lastSyncedAt ?? undefined,
      });
      invalidateNotificationQueries();
    });

    socket.on("disconnect", () => {
      const active = socket.active;
      useNotificationStore
        .getState()
        .setConnectionStatus(active ? "reconnecting" : "disconnected");
    });

    socket.io.on("reconnect_attempt", () => {
      const latestToken = getStoredAccessToken();
      if (latestToken) {
        socket.auth = { token: latestToken };
      }
      useNotificationStore.getState().setConnectionStatus("reconnecting");
    });

    socket.on("connect_error", async (err) => {
      const errData = (err as Error & { data?: { code?: string } }).data;
      const isAuthFailure =
        errData?.code === "INVALID_TOKEN" || errData?.code === "UNAUTHORIZED";

      if (isAuthFailure && !refreshingToken) {
        refreshingToken = true;
        try {
          const freshToken = await refreshAccessTokenForSocket();
          if (freshToken && socketRef.current === socket) {
            socket.auth = { token: freshToken };
            socket.connect();
            return;
          }
        } finally {
          refreshingToken = false;
        }
      }

      useNotificationStore.getState().setConnectionStatus("error");
    });

    socket.on("connection:ready", (payload: SocketConnectionReadyPayload) => {
      useNotificationStore.getState().setUnreadCount(payload.unreadCount);
    });

    socket.on("notification:new", (payload: SocketNotificationNewPayload) => {
      const isNewlySeen = useNotificationStore
        .getState()
        .receiveRealtimeNotification(payload.notification, payload.unreadCount);

      if (isNewlySeen) {
        useUiStore.getState().addToast({
          title: payload.notification.title,
          description: payload.notification.message,
          variant: getToastVariantForNotification(payload.notification.type),
        });
      }

      invalidateNotificationQueries();
      invalidateDomainQueries(payload.notification);
    });

    socket.on("notification:read", (payload: SocketNotificationReadPayload) => {
      useNotificationStore
        .getState()
        .markReadLocal(payload.id, payload.readAt, payload.unreadCount);
      invalidateNotificationQueries();
    });

    socket.on("notification:read_all", (payload: SocketNotificationReadAllPayload) => {
      useNotificationStore.getState().markAllReadLocal(payload.readAt);
      invalidateNotificationQueries();
    });

    socket.on("notification:deleted", (payload: SocketNotificationDeletedPayload) => {
      useNotificationStore.getState().removeLocal(payload.id, payload.unreadCount);
      invalidateNotificationQueries();
    });

    socket.on("notification:synced", (payload: SocketNotificationSyncedPayload) => {
      useNotificationStore
        .getState()
        .mergeSyncedNotifications(
          payload.notifications,
          payload.unreadCount,
          payload.serverTime,
        );
      invalidateNotificationQueries();
    });

    socket.on("admin:activity", (payload: SocketAdminActivityPayload) => {
      if (payload.entityType === "order" || payload.entityType === "payment") {
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      } else if (payload.entityType === "product") {
        void queryClient.invalidateQueries({ queryKey: ["products"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      } else if (payload.entityType === "customer") {
        void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.io.off("reconnect_attempt");
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, userId, queryClient]);
}

