"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  notificationService,
  type NotificationListParams,
} from "@/services/notification.service";
import { useAuthStore } from "@/stores/auth.store";
import { useNotificationStore } from "@/stores/notification.store";

export function useNotificationsListQuery(params: NotificationListParams = {}) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrateFromServer = useNotificationStore((s) => s.hydrateFromServer);

  const isDefaultDropdownQuery =
    (params.page ?? 1) === 1 &&
    (!params.isRead || params.isRead === "all") &&
    (!params.type || params.type === "all") &&
    !params.search;

  const query = useQuery({
    queryKey: ["notifications", userId, params],
    queryFn: () => notificationService.getNotifications(params),
    enabled: Boolean(isAuthenticated && userId),
    staleTime: 15 * 1000,
  });

  React.useEffect(() => {
    if (query.data && isDefaultDropdownQuery) {
      hydrateFromServer(query.data.items, query.data.unreadCount);
    }
  }, [query.data, isDefaultDropdownQuery, hydrateFromServer]);

  return query;
}

export function useUnreadNotificationCountQuery() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  const query = useQuery({
    queryKey: ["notifications-unread-count", userId],
    queryFn: () => notificationService.getUnreadCount(),
    enabled: Boolean(isAuthenticated && userId),
    staleTime: 15 * 1000,
  });

  React.useEffect(() => {
    if (query.data) {
      setUnreadCount(query.data.unreadCount);
    }
  }, [query.data, setUnreadCount]);

  return query;
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  }, [queryClient]);

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: (res) => {
      useNotificationStore
        .getState()
        .markReadLocal(res.notification.id, res.notification.readAt ?? undefined, res.unreadCount);
      invalidate();
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: (res) => {
      useNotificationStore.getState().markAllReadLocal(res.readAt);
      invalidate();
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => notificationService.deleteNotification(id),
    onSuccess: (res) => {
      useNotificationStore.getState().removeLocal(res.id, res.unreadCount);
      invalidate();
    },
  });

  return {
    markAsRead: markAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    deleteNotification: deleteNotificationMutation.mutateAsync,
    isDeletingNotification: deleteNotificationMutation.isPending,
  };
}

export function useNotifications(params: NotificationListParams = {}) {
  const listQuery = useNotificationsListQuery(params);
  const countQuery = useUnreadNotificationCountQuery();
  const actions = useNotificationActions();

  const storeItems = useNotificationStore((s) => s.items);
  const storeUnreadCount = useNotificationStore((s) => s.unreadCount);
  const lastSyncedAt = useNotificationStore((s) => s.lastSyncedAt);
  const connectionStatus = useNotificationStore((s) => s.connectionStatus);

  const isFiltered =
    Boolean(params.isRead && params.isRead !== "all") ||
    Boolean(params.type && params.type !== "all") ||
    Boolean(params.search) ||
    (params.page ?? 1) > 1;

  const notifications = isFiltered
    ? (listQuery.data?.items ?? [])
    : storeItems.length > 0
      ? storeItems
      : (listQuery.data?.items ?? []);

  const unreadCount = Math.max(
    0,
    lastSyncedAt !== null
      ? storeUnreadCount
      : (countQuery.data?.unreadCount ?? listQuery.data?.unreadCount ?? storeUnreadCount),
  );

  return {
    notifications,
    meta: listQuery.data?.meta ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      total: notifications.length,
      totalPages: 1,
    },
    unreadCount,
    connectionStatus,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    refetch: listQuery.refetch,
    ...actions,
  };
}
