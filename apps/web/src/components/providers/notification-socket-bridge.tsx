"use client";

import { useNotificationSocket } from "@/hooks/useNotificationSocket";
import { usePushBridge } from "@/hooks/usePushNotifications";

export function NotificationSocketBridge() {
  useNotificationSocket();
  usePushBridge();
  return null;
}

