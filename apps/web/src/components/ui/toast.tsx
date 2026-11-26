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
        "pointer-events-none fixed inset-x-3 z-[80] flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:w-full sm:max-w-sm sm:gap-2.5",
        shiftAboveOpenCart
          ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-24"
          : "bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6",
      )}
    >
      {toasts.map((toast, idx) => {
        const Icon =
          toast.variant === "success"
            ? CheckCircle2
            : toast.variant === "error"
              ? XCircle
              : toast.variant === "warning"
                ? AlertTriangle
                : Info;
        const hiddenOnMobile = idx < toasts.length - 2;

        return (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border bg-surface p-3 shadow-xl animate-in slide-in-from-bottom-4 duration-200 sm:gap-3 sm:p-3.5",
              hiddenOnMobile && "hidden sm:flex",
              toast.variant === "success" && "border-emerald-200 dark:border-emerald-800",
              toast.variant === "error" && "border-red-200 dark:border-red-800",
              toast.variant === "warning" && "border-amber-200 dark:border-amber-800",
              (!toast.variant || toast.variant === "default") && "border-border",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0 sm:size-5",
                toast.variant === "success" && "text-emerald-600",
                toast.variant === "error" && "text-destructive",
                toast.variant === "warning" && "text-amber-600",
                (!toast.variant || toast.variant === "default") && "text-primary",
              )}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="break-words text-xs font-semibold leading-snug text-foreground sm:text-sm">
                {toast.title}
              </p>
              {toast.description ? (
                <p className="mt-0.5 line-clamp-3 break-words text-[11px] leading-relaxed text-muted-foreground sm:line-clamp-none sm:text-xs">
                  {toast.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="-mt-0.5 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-low hover:text-foreground sm:size-6 cursor-pointer"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

