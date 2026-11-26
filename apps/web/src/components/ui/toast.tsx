"use client";

import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useCartStore } from "@/stores/cart.store";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";

export function ToastViewport() {
  const isMounted = useIsMounted();
  const pathname = usePathname();
  const hasCartItems = useCartStore((s) => s.items.length > 0);
  const { toasts, removeToast } = useUiStore();

  const shiftAboveOpenCart =
    isMounted &&
    hasCartItems &&
    pathname !== "/cart" &&
    pathname !== "/checkout" &&
    !pathname.startsWith("/admin");

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed right-4 z-[60] flex w-full max-w-sm flex-col gap-2.5 px-2 sm:right-6 sm:px-0",
        shiftAboveOpenCart ? "bottom-22 sm:bottom-24" : "bottom-4 sm:bottom-6",
      )}
    >
      {toasts.map((toast) => {
        const Icon =
          toast.variant === "success"
            ? CheckCircle2
            : toast.variant === "error"
              ? XCircle
              : toast.variant === "warning"
                ? AlertTriangle
                : Info;

        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface p-3.5 shadow-xl animate-in slide-in-from-bottom-4 duration-200",
              toast.variant === "success" && "border-emerald-200 dark:border-emerald-800",
              toast.variant === "error" && "border-red-200 dark:border-red-800",
              toast.variant === "warning" && "border-amber-200 dark:border-amber-800",
              (!toast.variant || toast.variant === "default") && "border-border",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-5 shrink-0",
                toast.variant === "success" && "text-emerald-600",
                toast.variant === "error" && "text-destructive",
                toast.variant === "warning" && "text-amber-600",
                (!toast.variant || toast.variant === "default") && "text-primary",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-full p-1 text-muted-foreground hover:bg-surface-low hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

