"use client";

import type { ReactNode } from "react";
import { ToastViewport } from "@/components/ui/toast";
import { QueryProvider } from "./query-provider";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      {children}
      <ToastViewport />
    </QueryProvider>
  );
}
