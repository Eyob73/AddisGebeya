"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, Loader2, X } from "lucide-react";
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
  style?: React.CSSProperties;
  onMarkAsRead: (id: string) => void | Promise<unknown>;
  onMarkAllAsRead: () => void | Promise<unknown>;
  onClose: () => void;
}

export const NotificationDropdown = React.forwardRef<HTMLDivElement, NotificationDropdownProps>(
  function NotificationDropdown(
    {
      notifications,
      unreadCount,
      connectionStatus,
      userRole,
      viewAllHref,
      isLoading = false,
      isMarkingAll = false,
      style,
      onMarkAsRead,
      onMarkAllAsRead,
      onClose,
    },
    ref,
  ) {
    const latestItems = notifications.slice(0, 6);
    const isLive = connectionStatus === "connected";

    return (
      <div
        ref={ref}
        role="dialog"
        aria-label="Notifications dropdown"
        style={style}
        className="fixed inset-x-3 top-16 z-[60] flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 sm:inset-x-auto sm:right-4 sm:w-[390px]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface-low/60 px-3.5 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <h3 className="font-display text-sm font-extrabold text-foreground">Notifications</h3>
            {unreadCount > 0 ? (
              <span className="whitespace-nowrap rounded-full bg-cta px-2 py-0.5 font-label text-[10px] font-extrabold text-cta-foreground">
                {unreadCount} unread
              </span>
            ) : null}
            <span
              title={isLive ? "Real-time updates active" : `Socket status: ${connectionStatus}`}
              aria-label={isLive ? "Real-time updates active" : `Socket status: ${connectionStatus}`}
              className={cn(
                "inline-flex size-2 shrink-0 rounded-full",
                isLive ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {unreadCount > 0 ? (
              <button
                type="button"
                disabled={isMarkingAll}
                onClick={() => void onMarkAllAsRead()}
                className="inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 font-label text-[11px] font-bold text-primary hover:bg-primary-light transition-colors cursor-pointer disabled:opacity-50"
              >
                {isMarkingAll ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <CheckCheck className="size-3.5" />
                )}
                Mark all read
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground sm:hidden cursor-pointer"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 sm:max-h-[380px]">
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
        <div className="shrink-0 border-t border-border bg-surface-low/50 px-3 py-2 text-center sm:px-4 sm:py-2.5">
          <Link
            href={viewAllHref}
            onClick={onClose}
            className="inline-flex min-h-9 w-full items-center justify-center rounded-xl py-1.5 font-label text-xs font-bold text-primary hover:bg-primary-light transition-colors"
          >
            View All Notifications
          </Link>
        </div>
      </div>
    );
  },
);

