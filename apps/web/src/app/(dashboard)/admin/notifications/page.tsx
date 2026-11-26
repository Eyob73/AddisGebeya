"use client";

import { NotificationCenter } from "@/components/notifications/NotificationCenter";

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Store Owner Notifications
        </h1>
        <p className="text-xs text-muted-foreground">
          Real-time alerts for new customer registrations, incoming orders, payment receipts, cancellations, and low-stock thresholds.
        </p>
      </div>

      <NotificationCenter />
    </div>
  );
}

