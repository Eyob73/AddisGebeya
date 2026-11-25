import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminGuard } from "@/components/guards/admin-guard";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}
