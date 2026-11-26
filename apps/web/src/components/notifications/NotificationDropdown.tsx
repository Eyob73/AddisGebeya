"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, Loader2, Wifi, WifiOff } from "lucide-react";
import type { NotificationDto } from "@addisgebeya/types";
import type { NotificationSocketStatus } from "@/stores/notification.store";
import { cn } from "@/lib/utils";
import { NotificationItem } from "./NotificationItem";

interface NotificationDropdownProps {
  notifications: NotificationDto[];
  unreadCount: number;
  connectionStatus: NotificationSocketStatus;
  userRole?: "customer" | "admin";
  viewAllHref: string;
  isLoading?: boolean;
  isMarkingAll?: boolean;
  onMarkAsRead: (id: string) => void | Promise<unknown>;
  onMarkAllAsRead: () => void | Promise<unknown>;
  onClose: () => void;
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  connectionStatus,
  userRole,
  viewAllHref,
  isLoading = false,
  isMarkingAll = false,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationDropdownProps) {
  const latestItems = notifications.slice(0, 6);
  const isLive = connectionStatus === "connected";

  return (
    <div
      role="dialog"
      aria-label="Notifications dropdown"
      className="absolute right-0 mt-2 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-low/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-extrabold text-foreground">Notifications</h3>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-cta px-2 py-0.5 font-label text-[10px] font-extrabold text-cta-foreground">
              {unreadCount} unread
            </span>
          ) : null}
          <span
            title={isLive ? "Real-time updates active" : `Socket status: ${connectionStatus}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-label text-[10px] font-semibold",
              isLive
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-surface-container text-muted-foreground",
            )}
          >
            {isLive ? <Wifi className="size-2.5" /> : <WifiOff className="size-2.5" />}
            <span>{isLive ? "Live" : "Sync"}</span>
          </span>
        </div>

        {unreadCount > 0 ? (
          <button
            type="button"
            disabled={isMarkingAll}
            onClick={() => void onMarkAllAsRead()}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-label text-[11px] font-bold text-primary hover:bg-primary-light transition-colors cursor-pointer disabled:opacity-50"
          >
            {isMarkingAll ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <CheckCheck className="size-3.5" />
            )}
            Mark all read
          </button>
        ) : null}
      </div>

      {/* Body */}
      <div className="max-h-[380px] overflow-y-auto p-1.5">
        {isLoading && latestItems.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin text-primary" />
            Loading notifications...
          </div>
        ) : latestItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <Bell className="size-5" aria-hidden="true" />
            </div>
            <p className="font-display text-sm font-bold text-foreground">
              You&apos;re all caught up
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Real-time order, payment, and inventory updates will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {latestItems.map((item) => (
              <NotificationItem
                key={item.id}
                notification={item}
                userRole={userRole}
                variant="compact"
                onMarkAsRead={onMarkAsRead}
                onNavigate={onClose}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-surface-low/50 px-4 py-2.5 text-center">
        <Link
          href={viewAllHref}
          onClick={onClose}
          className="inline-flex w-full items-center justify-center rounded-xl py-1.5 font-label text-xs font-bold text-primary hover:bg-primary-light transition-colors"
        >
          View All Notifications
        </Link>
      </div>
    </div>
  );
}

