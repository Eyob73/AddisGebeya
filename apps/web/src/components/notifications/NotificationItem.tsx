"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Trash2 } from "lucide-react";
import type { NotificationDto } from "@addisgebeya/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatExactDateTime,
  formatRelativeTime,
  getNotificationNavigationHref,
  getNotificationVisualMeta,
} from "./notification-utils";

interface NotificationItemProps {
  notification: NotificationDto;
  userRole?: "customer" | "admin";
  variant?: "compact" | "full";
  onMarkAsRead?: (id: string) => void | Promise<unknown>;
  onDelete?: (id: string) => void | Promise<unknown>;
  onNavigate?: () => void;
  isBusy?: boolean;
}

export function NotificationItem({
  notification,
  userRole,
  variant = "compact",
  onMarkAsRead,
  onDelete,
  onNavigate,
  isBusy = false,
}: NotificationItemProps) {
  const visual = getNotificationVisualMeta(notification.type);
  const Icon = visual.icon;
  const href = getNotificationNavigationHref(notification, userRole);

  const handleOpenLink = () => {
    if (!notification.isRead && onMarkAsRead) {
      void onMarkAsRead(notification.id);
    }
    onNavigate?.();
  };

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "group relative flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 transition-colors sm:gap-3 sm:px-3",
          notification.isRead
            ? "bg-transparent hover:bg-surface-low/80"
            : "bg-primary-light/45 hover:bg-primary-light/70 dark:bg-primary-light/25",
        )}
      >
        <div
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
            visual.iconBgClass,
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {href ? (
              <Link
                href={href}
                onClick={handleOpenLink}
                className={cn(
                  "min-w-0 line-clamp-1 text-xs transition-colors hover:text-primary",
                  notification.isRead
                    ? "font-medium text-foreground/90"
                    : "font-bold text-foreground",
                )}
              >
                {notification.title}
              </Link>
            ) : (
              <p
                className={cn(
                  "min-w-0 line-clamp-1 text-xs",
                  notification.isRead
                    ? "font-medium text-foreground/90"
                    : "font-bold text-foreground",
                )}
              >
                {notification.title}
              </p>
            )}
            <span
              title={formatExactDateTime(notification.createdAt)}
              className="shrink-0 font-label text-[10px] font-medium text-muted-foreground"
            >
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>

          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {notification.message}
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              {!notification.isRead ? (
                <span className="inline-flex shrink-0 items-center gap-1 font-label text-[10px] font-bold text-cta">
                  <span className="size-1.5 rounded-full bg-cta" /> Unread
                </span>
              ) : (
                <span className="shrink-0 font-label text-[10px] text-muted-foreground">Read</span>
              )}
              {notification.relatedEntityId && notification.relatedEntityType !== "customer" ? (
                <span className="max-w-[140px] truncate rounded bg-surface-container px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground/80 sm:max-w-[180px]">
                  {notification.relatedEntityType === "order" || notification.relatedEntityType === "payment"
                    ? `#${notification.relatedEntityId}`
                    : notification.relatedEntityId}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {!notification.isRead && onMarkAsRead ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void onMarkAsRead(notification.id)}
                  aria-label="Mark notification as read"
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-label text-[10px] font-bold text-primary hover:bg-surface sm:py-0.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="size-3" /> Read
                </button>
              ) : null}
              {href ? (
                <Link
                  href={href}
                  onClick={handleOpenLink}
                  className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 font-label text-[10px] font-bold text-muted-foreground hover:bg-surface hover:text-primary sm:py-0.5"
                >
                  Open <ArrowUpRight className="size-3" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-4 rounded-2xl border p-4 shadow-card transition-all sm:flex-row sm:items-start sm:p-5",
        notification.isRead
          ? "border-border bg-surface"
          : "border-primary/30 bg-primary-light/25 dark:bg-primary-light/15",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <div
          className={cn(
            "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
            visual.iconBgClass,
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {!notification.isRead ? (
              <span
                className="size-2 shrink-0 rounded-full bg-cta"
                aria-label="Unread notification"
              />
            ) : null}
            <h3
              className={cn(
                "font-display text-sm sm:text-base",
                notification.isRead ? "font-semibold text-foreground" : "font-extrabold text-foreground",
              )}
            >
              {notification.title}
            </h3>
            <Badge variant={visual.badgeVariant} className="text-[10px]">
              {visual.badgeLabel}
            </Badge>
            {!notification.isRead ? (
              <Badge variant="cta" className="text-[10px]">
                New
              </Badge>
            ) : null}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {notification.message}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
            <span title={formatExactDateTime(notification.createdAt)} className="font-medium">
              {formatRelativeTime(notification.createdAt)} • {formatExactDateTime(notification.createdAt)}
            </span>
            {notification.relatedEntityId ? (
              <span className="rounded-md bg-surface-low px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                {notification.relatedEntityType}: {notification.relatedEntityId}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
        {href ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={href} onClick={handleOpenLink}>
              View Details <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        ) : null}

        {!notification.isRead && onMarkAsRead ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => void onMarkAsRead(notification.id)}
          >
            <Check className="size-3.5" /> Mark Read
          </Button>
        ) : null}

        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            aria-label={`Delete notification: ${notification.title}`}
            onClick={() => void onDelete(notification.id)}
            className="text-muted-foreground hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/40"
          >
            <Trash2 className="size-3.5" />
            <span className="sm:hidden">Delete</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

