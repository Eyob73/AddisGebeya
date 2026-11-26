"use client";

import * as React from "react";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SkeletonBase } from "@/components/ui/skeleton";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";
import { NotificationItem } from "./NotificationItem";

const READ_FILTER_TABS: Array<{ id: "all" | "false" | "true"; label: string }> = [
  { id: "all", label: "All Notifications" },
  { id: "false", label: "Unread" },
  { id: "true", label: "Read" },
];

const CUSTOMER_TYPE_FILTERS = [
  { value: "all", label: "All Types" },
  { value: "order", label: "Orders" },
  { value: "payment", label: "Payments" },
  { value: "system", label: "Announcements & System" },
];

const ADMIN_TYPE_FILTERS = [
  { value: "all", label: "All Types" },
  { value: "order", label: "Orders" },
  { value: "payment", label: "Payments" },
  { value: "inventory", label: "Inventory Alerts" },
  { value: "customer", label: "Customers" },
  { value: "system", label: "System" },
];

export function NotificationCenter() {
  const isMounted = useIsMounted();
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);

  const [readFilter, setReadFilter] = React.useState<"all" | "false" | "true">("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [searchInput, setSearchInput] = React.useState("");
  const [page, setPage] = React.useState(1);
  const limit = 10;

  const {
    notifications,
    meta,
    unreadCount,
    connectionStatus,
    isLoading,
    isFetching,
    isMarkingAsRead,
    isMarkingAllAsRead,
    isDeletingNotification,
    refetch,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications({
    page,
    limit,
    isRead: readFilter,
    type: typeFilter === "all" ? undefined : typeFilter,
    search: searchInput.trim() || undefined,
  });

  const typeOptions = user?.role === "admin" ? ADMIN_TYPE_FILTERS : CUSTOMER_TYPE_FILTERS;

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
    } catch (err) {
      addToast({
        title: "Could not mark notification read",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      addToast({
        title: "All notifications marked as read",
        variant: "success",
      });
    } catch (err) {
      addToast({
        title: "Could not mark all notifications read",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      addToast({
        title: "Notification removed",
        variant: "default",
      });
    } catch (err) {
      addToast({
        title: "Could not delete notification",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    }
  };

  if (!isMounted || isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonBase className="h-16 w-full rounded-2xl" />
        <SkeletonBase className="h-14 w-full rounded-2xl" />
        <SkeletonBase className="h-28 w-full rounded-2xl" />
        <SkeletonBase className="h-28 w-full rounded-2xl" />
        <SkeletonBase className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action & Status Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            <Bell className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-extrabold text-foreground">
                Notification Center
              </h2>
              <Badge variant={unreadCount > 0 ? "cta" : "soft"}>
                {unreadCount} Unread
              </Badge>
              <Badge
                variant={connectionStatus === "connected" ? "success" : "outline"}
                className="text-[10px]"
              >
                {connectionStatus === "connected" ? (
                  <>
                    <Wifi className="size-3" /> Connected
                  </>
                ) : (
                  <>
                    <WifiOff className="size-3" /> {connectionStatus}
                  </>
                )}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {meta.total} total notification{meta.total === 1 ? "" : "s"} saved in your account.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={unreadCount === 0 || isMarkingAllAsRead}
            onClick={() => void handleMarkAllAsRead()}
          >
            {isMarkingAllAsRead ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCheck className="size-3.5" />
            )}
            Mark All Read
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          {/* Read/Unread Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {READ_FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setReadFilter(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full px-4 py-2 font-label text-xs font-bold transition-colors cursor-pointer",
                  readFilter === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-surface-low text-foreground hover:bg-primary-light hover:text-primary",
                )}
              >
                {tab.label}
                {tab.id === "false" && unreadCount > 0 ? ` (${unreadCount})` : ""}
              </button>
            ))}
          </div>

          {/* Search & Type Filter */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-auto sm:min-w-[220px]">
              <Search className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Search title, message, order #..."
                className="h-10 pl-10 text-xs"
              />
            </div>

            <select
              aria-label="Filter notifications by type"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-border bg-surface-low px-3 font-label text-xs font-bold text-foreground focus:border-primary focus:outline-none cursor-pointer"
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={
            readFilter === "false"
              ? "No Unread Notifications"
              : readFilter === "true"
                ? "No Read Notifications"
                : "No Notifications Yet"
          }
          description={
            searchInput || typeFilter !== "all"
              ? "Try clearing your search or type filter to see more notifications."
              : "Order updates, payment verifications, and account alerts will appear here in real time."
          }
          action={
            searchInput || typeFilter !== "all" || readFilter !== "all" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReadFilter("all");
                  setTypeFilter("all");
                  setSearchInput("");
                  setPage(1);
                }}
              >
                Reset Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              userRole={user?.role}
              variant="full"
              isBusy={isMarkingAsRead || isDeletingNotification}
              onMarkAsRead={handleMarkAsRead}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Page <strong className="text-foreground">{meta.page}</strong> of{" "}
            <strong className="text-foreground">{meta.totalPages}</strong> ({meta.total} total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages || isFetching}
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

