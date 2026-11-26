"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";
import { NotificationDropdown } from "./NotificationDropdown";

interface NotificationBellProps {
  viewAllHref?: string;
  className?: string;
}

export function NotificationBell({ viewAllHref, className }: NotificationBellProps) {
  const pathname = usePathname();
  const [openForPath, setOpenForPath] = React.useState<string | null>(null);
  const open = openForPath === pathname;
  const setOpen = React.useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setOpenForPath((current) => {
        const isCurrentlyOpen = current === pathname;
        const resolved = typeof next === "function" ? next(isCurrentlyOpen) : next;
        return resolved ? pathname : null;
      });
    },
    [pathname],
  );
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties | null>(null);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const resolvedViewAllHref =
    viewAllHref ??
    (user?.role === "admin" && pathname.startsWith("/admin")
      ? "/admin/notifications"
      : "/account/notifications");

  const {
    notifications,
    unreadCount,
    connectionStatus,
    isLoading,
    isMarkingAllAsRead,
    markAsRead,
    markAllAsRead,
  } = useNotifications({ page: 1, limit: 10 });

  const updateDropdownPosition = React.useCallback(() => {
    if (typeof window === "undefined" || !containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    const horizontalGutter = viewportWidth < 640 ? 12 : 16;
    const width = Math.max(240, Math.min(390, viewportWidth - horizontalGutter * 2));
    const idealLeft = rect.right - width;
    const left = Math.max(
      horizontalGutter,
      Math.min(idealLeft, viewportWidth - horizontalGutter - width),
    );
    const top = Math.max(12, Math.min(rect.bottom + 8, viewportHeight - 240));
    const maxHeight = Math.max(220, viewportHeight - top - 16);

    setDropdownStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight,
    });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, { capture: true, passive: true });

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, { capture: true });
    };
  }, [open, updateDropdownPosition]);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      const insideTrigger = target ? (containerRef.current?.contains(target) ?? false) : false;
      const insideDropdown = target ? (dropdownRef.current?.contains(target) ?? false) : false;
      if (!insideTrigger && !insideDropdown) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen]);

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notifications (${unreadCount} unread)`}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-full border border-border/70 bg-surface text-muted-foreground transition-colors hover:border-primary hover:bg-primary-light hover:text-primary cursor-pointer",
          open && "border-primary bg-primary-light text-primary",
        )}
      >
        <Bell className="size-4.5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <>
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 size-2.5 animate-ping rounded-full bg-cta/60"
            />
            <span
              data-testid="notification-unread-badge"
              className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-cta px-1 font-label text-[10px] font-extrabold leading-none text-cta-foreground shadow-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </>
        ) : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                aria-hidden="true"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px] sm:hidden"
              />
              <NotificationDropdown
                ref={dropdownRef}
                style={dropdownStyle ?? undefined}
                notifications={notifications}
                unreadCount={unreadCount}
                connectionStatus={connectionStatus}
                userRole={user.role}
                viewAllHref={resolvedViewAllHref}
                isLoading={isLoading}
                isMarkingAll={isMarkingAllAsRead}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onClose={() => setOpen(false)}
              />
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

