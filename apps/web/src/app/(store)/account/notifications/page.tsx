"use client";

import { AccountShell } from "@/components/layout/account-shell";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

export default function AccountNotificationsPage() {
  return (
    <AccountShell
      title="Notifications"
      subtitle="Stay updated in real time on order confirmations, payment verifications, and courier dispatches."
    >
      <NotificationCenter />
    </AccountShell>
  );
}

