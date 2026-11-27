"use client";

import * as React from "react";
import { BellRing, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { usePushStore } from "@/stores/push.store";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";

interface PushPermissionPromptProps {
  context?: "notifications" | "order" | "tracking" | "admin";
  className?: string;
}

export function PushPermissionPrompt({
  context = "notifications",
  className,
}: PushPermissionPromptProps) {
  const isMounted = useIsMounted();
  const addToast = useUiStore((s) => s.addToast);
  const {
    canPrompt,
    isMutating,
    userRole,
    enablePush,
    dismissPrompt,
  } = usePushNotifications();

  if (!isMounted || !canPrompt) {
    return null;
  }

  const isAdmin = context === "admin" || userRole === "admin";
  const headline = isAdmin
    ? "Get Instant Store & Order Alerts on This Device"
    : context === "order"
      ? "Get Instant Updates for This Order"
      : "Turn On Device Push Notifications";

  const description = isAdmin
    ? "Receive browser alerts immediately when customers place orders, upload payment receipts, or trigger low-stock warnings — even when the dashboard tab is closed."
    : context === "order" || context === "tracking"
      ? "Receive real-time alerts when your payment is verified, your order is packed, and when our Addis Ababa courier is on the way."
      : "Get delivered notifications directly on your phone or computer for payment confirmations and delivery updates, even in the background.";

  const handleEnable = async () => {
    const ok = await enablePush();
    if (ok) {
      addToast({
        title: "Device Notifications Enabled",
        description: "You will now receive real-time AddisGebeya alerts on this device.",
        variant: "success",
      });
    } else {
      const latestError = usePushStore.getState().error;
      if (latestError) {
        addToast({
          title: "Could Not Enable Notifications",
          description: latestError,
          variant: "warning",
        });
      }
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between gap-3 rounded-2xl border border-primary/25 bg-primary-light/35 p-4 shadow-xs sm:flex-row sm:items-center sm:p-5 dark:bg-primary-light/15",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
          <BellRing className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="font-display text-sm font-extrabold text-foreground">
            {headline}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="cta"
          size="sm"
          disabled={isMutating}
          onClick={() => void handleEnable()}
        >
          {isMutating ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Enabling...
            </>
          ) : (
            <>
              <BellRing className="size-3.5" /> Enable Notifications
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isMutating}
          onClick={dismissPrompt}
          className="text-muted-foreground hover:text-foreground"
        >
          Not Now
        </Button>
        <button
          type="button"
          aria-label="Dismiss notification prompt"
          onClick={dismissPrompt}
          className="hidden size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface sm:inline-flex cursor-pointer"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
