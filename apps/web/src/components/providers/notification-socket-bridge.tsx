"use client";

import { useNotificationSocket } from "@/hooks/useNotificationSocket";

export function NotificationSocketBridge() {
  useNotificationSocket();
  return null;
}

