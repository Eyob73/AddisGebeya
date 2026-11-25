"use client";

import * as React from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import { clientEnv } from "@/lib/env";
import { storeService } from "@/services/store.service";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";

interface OpenReceiptButtonProps {
  receiptId: string;
  label?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost" | "cta" | "destructive";
  className?: string;
  onError?: (message: string) => void;
}

function resolveAbsoluteReceiptUrl(relativeOrAbsoluteUrl: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsoluteUrl)) {
    return relativeOrAbsoluteUrl;
  }
  const base = clientEnv.apiUrl.replace(/\/+$/, "");
  const path = relativeOrAbsoluteUrl.startsWith("/")
    ? relativeOrAbsoluteUrl
    : `/${relativeOrAbsoluteUrl}`;
  return `${base}${path}`;
}

export function OpenReceiptButton({
  receiptId,
  label = "Open Receipt",
  size = "sm",
  variant = "outline",
  className,
  onError,
}: OpenReceiptButtonProps) {
  const addToast = useUiStore((s) => s.addToast);
  const [isOpening, setIsOpening] = React.useState(false);

  const handleOpen = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!receiptId || isOpening) return;

    setIsOpening(true);
    let popup: Window | null = null;
    try {
      popup = window.open("", "_blank");
      if (popup) {
        popup.opener = null;
        popup.document.title = "Loading Payment Receipt...";
        popup.document.body.innerHTML =
          '<div style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;font-size:14px;">Preparing secure original receipt...</div>';
      }
    } catch {
      popup = null;
    }

    try {
      const access = await storeService.getReceiptAccessUrl(receiptId);
      const targetUrl = resolveAbsoluteReceiptUrl(access.accessUrl);

      if (popup && !popup.closed) {
        popup.location.replace(targetUrl);
      } else {
        const opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
        if (!opened) {
          throw new Error(
            "Popup blocked by your browser. Allow popups for this site or use the Zoom modal instead.",
          );
        }
      }
    } catch (err: unknown) {
      try {
        if (popup && !popup.closed) popup.close();
      } catch {
        // ignore close error
      }
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Receipt file is currently unavailable or cannot be accessed.";
      onError?.(message);
      addToast({
        title: "Unable to Open Receipt",
        description: message,
        variant: "error",
      });
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={isOpening || !receiptId}
      onClick={handleOpen}
      title="Open original receipt in a new browser tab"
      className={cn("gap-1.5", className)}
    >
      {isOpening ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <FileText className="size-3.5" />
      )}
      {size !== "icon" ? <span>{label}</span> : null}
      {size !== "icon" && !isOpening ? (
        <ExternalLink className="size-3 opacity-75" />
      ) : null}
    </Button>
  );
}

