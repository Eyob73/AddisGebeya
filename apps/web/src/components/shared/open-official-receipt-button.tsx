"use client";

import * as React from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { resolveOfficialReceiptLink, validateOfficialReceiptUrl } from "@addisgebeya/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OpenOfficialReceiptButtonProps {
  provider?: string | null;
  officialReceiptUrl?: string | null;
  cbeReceiptToken?: string | null;
  transactionReference?: string | null;
  verifiedReference?: string | null;
  extractedReference?: string | null;
  sourceUrl?: string | null;
  qrData?: string | null;
  reason?: string | null;
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost" | "cta" | "destructive";
  className?: string;
}

export function OpenOfficialReceiptButton({
  provider,
  officialReceiptUrl,
  cbeReceiptToken,
  transactionReference,
  verifiedReference,
  extractedReference,
  sourceUrl,
  qrData,
  reason,
  label = "Open Official Receipt",
  size = "sm",
  variant = "cta",
  className,
}: OpenOfficialReceiptButtonProps) {
  const resolution = resolveOfficialReceiptLink({
    provider,
    officialReceiptUrl,
    cbeReceiptToken,
    transactionReference,
    verifiedReference,
    extractedReference,
    sourceUrl,
    qrData,
  });

  const validatedSafeUrl = resolution.officialReceiptUrl
    ? validateOfficialReceiptUrl(provider, resolution.officialReceiptUrl)
    : null;
  const fallbackReason =
    reason ||
    resolution.reason ||
    "Official provider receipt URL is unavailable for this transaction.";

  if (!validatedSafeUrl) {
    return (
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled
        title={fallbackReason}
        className={cn("gap-1.5 opacity-60", className)}
      >
        <ShieldCheck className="size-3.5" />
        <span>{label}</span>
        <ExternalLink className="size-3 opacity-70" />
      </Button>
    );
  }

  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
    >
      <a
        href={validatedSafeUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`Open official ${provider?.toUpperCase() || "provider"} receipt page in a new tab`}
      >
        <ShieldCheck className="size-3.5" />
        <span>{label}</span>
        <ExternalLink className="size-3 opacity-80" />
      </a>
    </Button>
  );
}

