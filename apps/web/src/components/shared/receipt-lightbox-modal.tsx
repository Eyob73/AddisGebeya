"use client";

import * as React from "react";
import { RotateCw, X, ZoomIn, ZoomOut, Maximize2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OpenReceiptButton } from "@/components/shared/open-receipt-button";
import { ProtectedReceiptImage } from "@/components/shared/protected-receipt-image";
import { apiClient } from "@/lib/api-client";

interface ReceiptLightboxModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  receiptId?: string;
  fileUrl?: string;
  fallbackImageUrl?: string;
  localPreviewUrl?: string;
  mimeType?: string;
}

function PdfReceiptFrame({
  receiptId,
  fileUrl,
  localPreviewUrl,
  title,
}: {
  receiptId?: string;
  fileUrl?: string;
  localPreviewUrl?: string;
  title: string;
}) {
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(localPreviewUrl ?? null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (localPreviewUrl || !receiptId) return;
    let cancelled = false;
    let objUrl: string | null = null;
    const endpoint = fileUrl || `/payment/receipts/${encodeURIComponent(receiptId)}/file`;

    apiClient
      .fetchBlob(endpoint)
      .then((blob) => {
        if (cancelled) return;
        objUrl = URL.createObjectURL(blob);
        setPdfUrl(objUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load PDF receipt.");
      });

    return () => {
      cancelled = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [receiptId, fileUrl, localPreviewUrl]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-white/20 bg-slate-900 p-8 text-center text-sm text-white">
        <FileText className="size-10 text-amber-400" />
        <p>{error}</p>
        {receiptId ? (
          <OpenReceiptButton
            receiptId={receiptId}
            label="View Uploaded Receipt in New Tab"
            variant="cta"
          />
        ) : null}
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex h-[75vh] w-[85vw] max-w-4xl items-center justify-center rounded-xl border border-white/20 bg-slate-900 text-sm text-white/80">
        Loading PDF receipt document...
      </div>
    );
  }

  return (
    <iframe
      src={pdfUrl}
      title={title}
      className="h-[78vh] w-[90vw] max-w-5xl rounded-xl border border-white/20 bg-white shadow-2xl"
    />
  );
}

function ReceiptLightboxContent({
  onClose,
  title = "Payment Receipt Preview",
  subtitle,
  receiptId,
  fileUrl,
  fallbackImageUrl,
  localPreviewUrl,
  mimeType,
}: Omit<ReceiptLightboxModalProps, "open">) {
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const isPdf = mimeType?.toLowerCase() === "application/pdf";

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))));
      if (e.key === "-") setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/85 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 bg-black/60 px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-bold sm:text-base">{title}</h3>
          {subtitle ? <p className="truncate text-xs text-white/70">{subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {receiptId ? (
            <OpenReceiptButton
              receiptId={receiptId}
              label="View Uploaded Receipt in New Tab"
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-white/25 bg-white/10 px-3 text-white hover:bg-white/20 hover:text-white"
            />
          ) : null}
          {!isPdf ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                disabled={zoom <= 0.5}
                title="Zoom Out (-)"
                className="h-8 rounded-full bg-white/10 px-2.5 text-white hover:bg-white/20 hover:text-white"
              >
                <ZoomOut className="size-4" />
              </Button>
              <span className="min-w-12 text-center font-mono text-xs font-bold">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))))}
                disabled={zoom >= 3.5}
                title="Zoom In (+)"
                className="h-8 rounded-full bg-white/10 px-2.5 text-white hover:bg-white/20 hover:text-white"
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                }}
                title="Reset View"
                className="h-8 rounded-full bg-white/10 px-2.5 text-xs text-white hover:bg-white/20 hover:text-white"
              >
                <Maximize2 className="size-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Rotate 90 degrees"
                className="h-8 rounded-full bg-white/10 px-2.5 text-white hover:bg-white/20 hover:text-white"
              >
                <RotateCw className="size-4" />
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close receipt viewer"
            className="ml-1 h-8 rounded-full bg-white/15 px-2.5 text-white hover:bg-white/25 hover:text-white"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable Zoom / Document Canvas */}
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-4 sm:p-8"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {isPdf ? (
          <PdfReceiptFrame
            receiptId={receiptId}
            fileUrl={fileUrl}
            localPreviewUrl={localPreviewUrl}
            title={title}
          />
        ) : (
          <div
            className="transition-transform duration-150 ease-out"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: "center center",
            }}
          >
            {localPreviewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={localPreviewUrl}
                alt={title}
                onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
                className="max-h-[78vh] max-w-[90vw] cursor-zoom-in rounded-xl border border-white/20 bg-white object-contain shadow-2xl"
              />
            ) : receiptId ? (
              <ProtectedReceiptImage
                receiptId={receiptId}
                fileUrl={fileUrl}
                fallbackImageUrl={fallbackImageUrl}
                mimeType={mimeType}
                alt={title}
                onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
                className="max-h-[78vh] max-w-[90vw] cursor-zoom-in rounded-xl border border-white/20 bg-white object-contain shadow-2xl"
              />
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-black/60 px-4 py-2 text-center text-[11px] text-white/65">
        {isPdf
          ? "Viewing original PDF payment receipt. Click Open Receipt above to open in your browser's native PDF tab."
          : "Click image to toggle 200% zoom, or use + / - controls to inspect transaction reference numbers and amounts."}
      </div>
    </div>
  );
}

export function ReceiptLightboxModal(props: ReceiptLightboxModalProps) {
  if (!props.open) return null;
  const contentKey = props.receiptId || props.localPreviewUrl || "preview";
  return <ReceiptLightboxContent key={contentKey} {...props} />;
}
