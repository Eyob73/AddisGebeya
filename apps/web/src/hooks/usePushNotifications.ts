"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { usePushStore } from "@/stores/push.store";

export function usePushBridge() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const ensureDefaultPushEnabled = usePushStore((s) => s.ensureDefaultPushEnabled);
  const syncRotatedSubscription = usePushStore((s) => s.syncRotatedSubscription);
  const reset = usePushStore((s) => s.reset);

  React.useEffect(() => {
    if (!isAuthenticated || !userId) {
      reset();
      return;
    }

    void ensureDefaultPushEnabled(userId);
  }, [isAuthenticated, userId, ensureDefaultPushEnabled, reset]);

  React.useEffect(() => {
    if (
      !isAuthenticated ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; subscription?: PushSubscriptionJSON }
        | undefined;
      if (!data?.type) return;

      if (data.type === "ADDISGEBEYA_PUSH_RECEIVED") {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      } else if (
        data.type === "ADDISGEBEYA_PUSH_SUBSCRIPTION_CHANGED" &&
        data.subscription
      ) {
        void syncRotatedSubscription(data.subscription);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, [isAuthenticated, queryClient, syncRotatedSubscription]);
}

export function usePushNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const state = usePushStore();

  const serverConfigured = Boolean(state.status?.configured);
  const pushEnabled = state.status?.pushEnabled ?? true;
  const deviceCount = state.status?.deviceCount ?? 0;
  const devices = state.status?.devices ?? [];
  const canPrompt =
    isAuthenticated &&
    Boolean(user) &&
    state.isSupported &&
    serverConfigured &&
    state.permission === "default" &&
    !state.isSubscribedOnThisDevice &&
    !state.promptDismissed;

  return {
    ...state,
    isAuthenticated,
    userRole: user?.role ?? "customer",
    serverConfigured,
    pushEnabled,
    deviceCount,
    devices,
    canPrompt,
  };
}

