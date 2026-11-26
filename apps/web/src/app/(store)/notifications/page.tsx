"use client";

import { AuthGuard } from "@/components/guards/auth-guard";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <div className="mx-auto max-w-[1100px] px-4 py-8 lg:px-8 lg:py-10">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage real-time alerts for orders, payments, and store updates.
          </p>
        </div>

        <NotificationCenter />
      </div>
    </AuthGuard>
  );
}

