"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { ToastViewport } from "@/components/ui/toast";
import { useAuthStore } from "@/stores/auth.store";
import { useCatalogStore } from "@/stores/catalog.store";
import { NotificationSocketBridge } from "./notification-socket-bridge";
import { QueryProvider } from "./query-provider";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  React.useEffect(() => {
    // Initial sync with real backend database and restore auth session
    useCatalogStore.getState().syncFromBackend().catch(() => {});
    useAuthStore.getState().initialize().catch(() => {});
  }, []);

  return (
    <QueryProvider>
      <NotificationSocketBridge />
      {children}
      <ToastViewport />
    </QueryProvider>
  );
}
