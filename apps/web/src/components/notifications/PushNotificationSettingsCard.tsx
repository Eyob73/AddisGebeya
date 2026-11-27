"use client";

import * as React from "react";
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Info,
  Laptop,
  Loader2,
  ShieldAlert,
  Smartphone,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useUiStore } from "@/stores/ui.store";
import { formatRelativeTime } from "./notification-utils";

function formatDeviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Registered Web Browser";
  const ua = userAgent.toLowerCase();

  let browser = "Web Browser";
  if (ua.includes("edg/")) browser = "Microsoft Edge";
  else if (ua.includes("opr/") || ua.includes("opera")) browser = "Opera";
  else if (ua.includes("chrome/") && !ua.includes("edg/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari";

  let os = "Device";
  if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";

  return `${browser} on ${os}`;
}

export function PushNotificationSettingsCard() {
  const isMounted = useIsMounted();
  const addToast = useUiStore((s) => s.addToast);
  const {
    isSupported,
    unsupportedReason,
    permission,
    currentEndpoint,
    isSubscribedOnThisDevice,
    serverConfigured,
    pushEnabled,
    deviceCount,
    devices,
    isLoadingStatus,
    isMutating,
    error,
    enablePush,
    disablePush,
    disableAllDevices,
    setPushPreference,
  } = usePushNotifications();

  const handleEnable = async () => {
    const ok = await enablePush();
    if (ok) {
      addToast({
        title: "Device Notifications Enabled",
        description: "This browser is now registered for real-time AddisGebeya push alerts.",
        variant: "success",
      });
    }
  };

  const handleDisable = async () => {
    const ok = await disablePush();
    if (ok) {
      addToast({
        title: "Device Notifications Disabled",
        description: "Push alerts have been turned off for this browser.",
        variant: "default",
      });
    }
  };

  const handleToggleAccountDelivery = async () => {
    const next = !pushEnabled;
    const ok = await setPushPreference(next);
    if (ok) {
      addToast({
        title: next ? "Push Delivery Resumed" : "Push Delivery Paused",
        description: next
          ? "Registered devices will receive push notifications for new events."
          : "All registered devices are paused until you re-enable delivery.",
        variant: next ? "success" : "default",
      });
    }
  };

  const handleRemoveAllDevices = async () => {
    const ok = await disableAllDevices();
    if (ok) {
      addToast({
        title: "All Devices Removed",
        description: "Removed all registered browser push subscriptions from your account.",
        variant: "default",
      });
    }
  };

  if (!isMounted) {
    return null;
  }

  const permissionBadge =
    permission === "granted"
      ? { label: "Allowed", variant: "success" as const }
      : permission === "denied"
        ? { label: "Blocked", variant: "destructive" as const }
        : permission === "default"
          ? { label: "Not Requested", variant: "soft" as const }
          : { label: "Unsupported", variant: "outline" as const };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-8">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            <BellRing className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              Device Push Notifications
            </h2>
            <p className="text-xs text-muted-foreground">
              Receive instant order, payment verification, and delivery alerts directly on your
              device — even when AddisGebeya is in the background or closed.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isSupported && serverConfigured && permission !== "denied" ? (
            isSubscribedOnThisDevice ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isMutating}
                onClick={() => void handleDisable()}
              >
                {isMutating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <BellOff className="size-3.5" />
                )}
                Disable Notifications
              </Button>
            ) : (
              <Button
                type="button"
                variant="cta"
                size="sm"
                disabled={isMutating || isLoadingStatus}
                onClick={() => void handleEnable()}
              >
                {isMutating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Bell className="size-3.5" />
                )}
                Enable Notifications
              </Button>
            )
          ) : null}
        </div>
      </div>

      {/* Status Summary Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-surface-low p-3.5">
          <span className="font-label text-[11px] font-bold uppercase text-muted-foreground">
            Browser Permission
          </span>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant={permissionBadge.variant} className="text-[11px]">
              {permissionBadge.label}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface-low p-3.5">
          <span className="font-label text-[11px] font-bold uppercase text-muted-foreground">
            This Device
          </span>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge
              variant={isSubscribedOnThisDevice ? "success" : "soft"}
              className="text-[11px]"
            >
              {isSubscribedOnThisDevice ? (
                <>
                  <CheckCircle2 className="mr-1 size-3" /> Subscribed
                </>
              ) : (
                "Not Subscribed"
              )}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface-low p-3.5">
          <span className="font-label text-[11px] font-bold uppercase text-muted-foreground">
            Account Push Delivery
          </span>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Badge variant={pushEnabled ? "success" : "warning"} className="text-[11px]">
              {pushEnabled ? "Active" : "Paused"}
            </Badge>
            {deviceCount > 0 ? (
              <button
                type="button"
                disabled={isMutating}
                onClick={() => void handleToggleAccountDelivery()}
                className="font-label text-[11px] font-bold text-primary hover:underline cursor-pointer disabled:opacity-50"
              >
                {pushEnabled ? "Pause all" : "Resume all"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface-low p-3.5">
          <span className="font-label text-[11px] font-bold uppercase text-muted-foreground">
            Registered Devices
          </span>
          <p className="mt-1 font-display text-base font-extrabold text-foreground">
            {deviceCount} {deviceCount === 1 ? "device" : "devices"}
          </p>
        </div>
      </div>

      {/* Unsupported Browser / Permission Denied / Server Configuration Notices */}
      {!isSupported && unsupportedReason ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-300/70 bg-amber-50/70 p-3.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-bold">Device Push Not Available Here</p>
            <p className="leading-relaxed">{unsupportedReason}</p>
          </div>
        </div>
      ) : null}

      {isSupported && permission === "denied" ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-300/70 bg-rose-50/70 p-3.5 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-bold">Notifications Are Blocked by Your Browser</p>
            <p className="leading-relaxed">
              You previously declined or blocked notifications for AddisGebeya. To re-enable them,
              click the lock or site settings icon beside the address bar, set{" "}
              <strong>Notifications</strong> to <strong>Allow</strong>, reload this page, and
              click <strong>Enable Notifications</strong>.
            </p>
          </div>
        </div>
      ) : null}

      {isSupported && !isLoadingStatus && !serverConfigured ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface-low p-3.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            Push notifications are awaiting server VAPID configuration. In-app real-time
            notifications continue to work normally.
          </p>
        </div>
      ) : null}

      {error && permission !== "denied" ? (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-red-50/70 p-3 text-xs text-destructive dark:bg-red-950/30">
          {error}
        </div>
      ) : null}

      {/* Registered Devices List */}
      {devices.length > 0 ? (
        <div className="mt-5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-label text-xs font-bold uppercase text-muted-foreground">
              Active Push Subscriptions
            </p>
            {devices.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isMutating}
                onClick={() => void handleRemoveAllDevices()}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" /> Remove All Devices
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            {devices.map((device) => {
              const isCurrent = Boolean(currentEndpoint && device.endpoint === currentEndpoint);
              const isMobileUa = /android|iphone|ipad|mobile/i.test(device.userAgent || "");

              return (
                <div
                  key={device.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface-low px-3.5 py-2.5 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-primary border border-border/70">
                      {isMobileUa ? (
                        <Smartphone className="size-4" aria-hidden="true" />
                      ) : (
                        <Laptop className="size-4" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-foreground">
                          {formatDeviceLabel(device.userAgent)}
                        </span>
                        {isCurrent ? (
                          <Badge variant="soft" className="text-[10px]">
                            This Browser
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        Synced {formatRelativeTime(device.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Browser Support Info */}
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Supported on modern desktop and Android browsers (Chrome, Edge, Firefox, Opera) over HTTPS,
        and on iOS/iPadOS 16.4+ when added to your Home Screen. Sensitive bank transaction references
        are never displayed on device lock screens.
      </p>
    </section>
  );
}

