"use client";

import * as React from "react";
import { FileText, ImageOff, Loader2, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ProtectedReceiptImageProps {
  receiptId: string;
  fileUrl?: string;
  fallbackImageUrl?: string;
  mimeType?: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Fetches a payment receipt asset securely through the authenticated backend endpoint
 * so private Cloudinary assets are never exposed without session authorization.
 */
export function ProtectedReceiptImage({
  receiptId,
  fileUrl,
  fallbackImageUrl,
  mimeType,
  alt,
  className,
  onClick,
}: ProtectedReceiptImageProps) {
  const isPdf =
    mimeType?.toLowerCase() === "application/pdf" ||
    fallbackImageUrl?.toLowerCase().endsWith(".pdf");
  const [src, setSrc] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(!isPdf);
  const [hasError, setHasError] = React.useState(false);
  const [retryCounter, setRetryCounter] = React.useState(0);

  React.useEffect(() => {
    if (isPdf) {
      return;
    }
    let cancelled = false;
    let createdObjectUrl: string | null = null;

    async function load() {
      setIsLoading(true);
      setHasError(false);

      const endpoint = fileUrl || `/payment/receipts/${encodeURIComponent(receiptId)}/file`;

      try {
        const blob = await apiClient.fetchBlob(endpoint);
        if (cancelled) return;
        createdObjectUrl = URL.createObjectURL(blob);
        setSrc(createdObjectUrl);
      } catch {
        if (cancelled) return;
        if (fallbackImageUrl) {
          setSrc(fallbackImageUrl);
        } else {
          setHasError(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [receiptId, fileUrl, fallbackImageUrl, isPdf, retryCounter]);

  if (isPdf) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 bg-surface-low p-3 text-center text-xs text-primary",
          className,
        )}
      >
        <FileText className="size-7 text-primary" />
        <span className="font-mono text-[10px] font-bold uppercase">PDF Receipt</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-surface-low text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  if (hasError || !src) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-surface-low p-4 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-6 text-destructive/70" />
        <span>Unable to load receipt image</span>
        <button
          type="button"
          onClick={() => setRetryCounter((c) => c + 1)}
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline cursor-pointer"
        >
          <RefreshCw className="size-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      onClick={onClick}
      onError={() => {
        if (fallbackImageUrl && src !== fallbackImageUrl) {
          setSrc(fallbackImageUrl);
        } else {
          setHasError(true);
        }
      }}
      className={className}
    />
  );
}

