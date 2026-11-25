"use client";

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Landmark,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ProtectedReceiptImage } from "@/components/shared/protected-receipt-image";
import { usePaymentStatusQuery } from "@/hooks/use-store-queries";
import { ApiClientError } from "@/lib/api-client";
import { storeService } from "@/services/store.service";
import { useUiStore } from "@/stores/ui.store";
import type {
  PaymentProviderInfo,
  PaymentVerificationResponse,
} from "@/types/store.types";
import { formatETB } from "@/utils/format";
import { cn } from "@/lib/utils";
import { PaymentReceiptSubmission } from "./payment-receipt-submission";

interface PaymentVerificationPanelProps {
  orderNumber: string;
  initialProvider?: string;
  initialStatus?: string;
  initialReference?: string;
  totalETB: number;
  providers: PaymentProviderInfo[];
  onVerified?: (result: PaymentVerificationResponse) => void;
}

export function isPaymentSettledStatus(status?: string | null): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return normalized === "paid" || normalized === "verified" || normalized === "approved";
}

export function getPaymentBadgeVariant(
  status?: string | null,
): "success" | "warning" | "destructive" | "soft" {
  const norm = (status || "").toLowerCase();
  if (norm === "paid" || norm === "verified" || norm === "approved") return "success";
  if (norm === "reviewrequired" || norm === "verificationpending" || norm === "cod_due") {
    return "warning";
  }
  if (norm === "failed" || norm === "rejected") return "destructive";
  return "soft";
}

export function PaymentVerificationPanel({
  orderNumber,
  initialProvider = "cbe",
  initialStatus = "Pending",
  initialReference = "",
  totalETB,
  providers,
  onVerified,
}: PaymentVerificationPanelProps) {
  const queryClient = useQueryClient();
  const addToast = useUiStore((s) => s.addToast);
  const {
    data: liveStatus,
    isFetching: isStatusFetching,
    refetch: refetchStatus,
  } = usePaymentStatusQuery(orderNumber);

  const effectiveStatus = liveStatus?.paymentStatus ?? initialStatus;
  const effectiveOrderStatus = liveStatus?.orderStatus ?? "PendingPayment";
  const effectiveProviderCode =
    (liveStatus?.provider && liveStatus.provider !== "cod"
      ? liveStatus.provider
      : initialProvider) || providers[0]?.id || "cbe";

  const [overrideProviderId, setOverrideProviderId] = React.useState<string | null>(null);
  const selectedProviderId = overrideProviderId ?? effectiveProviderCode;

  const [referenceInput, setReferenceInput] = React.useState<string | null>(null);
  const hydratedReference =
    liveStatus?.transactionReference && !liveStatus.transactionReference.startsWith("REF-")
      ? liveStatus.transactionReference
      : initialReference && !initialReference.startsWith("REF-")
        ? initialReference
        : "";
  const reference = referenceInput ?? hydratedReference;
  const [accountNumber, setAccountNumber] = React.useState<string>("");
  const [phoneNumber, setPhoneNumber] = React.useState<string>("");
  const [verificationMode, setVerificationMode] = React.useState<"receipt" | "reference">("receipt");
  const [useQrMode, setUseQrMode] = React.useState<boolean>(false);
  const [qrData, setQrData] = React.useState<string>("");
  const [isVerifying, setIsVerifying] = React.useState<boolean>(false);
  const inFlightRef = React.useRef<boolean>(false);
  const [copiedAccount, setCopiedAccount] = React.useState<boolean>(false);

  const [feedback, setFeedback] = React.useState<{
    tone: "success" | "warning" | "error";
    title: string;
    message: string;
  } | null>(null);

  const activeProvider =
    providers.find((p) => p.id === selectedProviderId) ?? providers[0];

  const isLegacyCbeRef =
    activeProvider?.id === "cbe" && /^ft/i.test(reference.trim());
  const needsAccountField = Boolean(activeProvider?.requiresAccount || isLegacyCbeRef);

  const isPaid = isPaymentSettledStatus(effectiveStatus);

  const handleCopyAccount = async () => {
    const account = activeProvider?.receivingAccountNumber || liveStatus?.receivingAccountNumber;
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current || isVerifying || !activeProvider) return;

    const trimmedRef = reference.trim();
    const trimmedQr = qrData.trim();

    if (!trimmedRef && !trimmedQr) {
      setFeedback({
        tone: "error",
        title: "Reference Required",
        message: "Enter your transaction reference, receipt link, or QR receipt data before verifying.",
      });
      return;
    }

    inFlightRef.current = true;
    setIsVerifying(true);
    setFeedback(null);

    try {
      const result = await storeService.verifyPayment({
        orderId: orderNumber,
        provider: activeProvider.id,
        reference: trimmedRef || undefined,
        accountNumber: accountNumber.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        qrData: trimmedQr || undefined,
      });

      setFeedback({
        tone: "success",
        title: "Payment Verified & Confirmed",
        message: result.message,
      });

      addToast({
        title: "Payment Verified",
        description: result.message,
        variant: "success",
      });

      await Promise.all([
        refetchStatus(),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-status", orderNumber] }),
      ]);

      onVerified?.(result);
    } catch (err: unknown) {
      await refetchStatus();

      if (err instanceof ApiClientError) {
        const isUnavailable =
          err.status === 503 || err.code === "VERIFICATION_UNAVAILABLE";
        const isReview =
          err.code === "AMOUNT_MISMATCH" ||
          err.code === "RECEIVING_ACCOUNT_MISMATCH" ||
          err.code === "PROVIDER_MISMATCH" ||
          err.code === "CURRENCY_MISMATCH" ||
          err.code === "TRANSACTION_EXPIRED";

        setFeedback({
          tone: isUnavailable || isReview ? "warning" : "error",
          title: isUnavailable
            ? "Verification Temporarily Unavailable"
            : isReview
              ? "Flagged for Manual Review"
              : "Verification Unsuccessful",
          message: err.message,
        });

        addToast({
          title: isUnavailable
            ? "Verification Pending"
            : isReview
              ? "Flagged for Review"
              : "Verification Failed",
          description: err.message,
          variant: isUnavailable || isReview ? "warning" : "error",
        });
      } else {
        const message =
          err instanceof Error
            ? err.message
            : "We could not verify your transaction. Please check your transaction reference and try again.";
        setFeedback({
          tone: "error",
          title: "Verification Failed",
          message,
        });
      }
    } finally {
      inFlightRef.current = false;
      setIsVerifying(false);
    }
  };

  if (isPaid) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-50/70 p-5 text-sm dark:bg-emerald-950/25">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-extrabold text-emerald-900 dark:text-emerald-200">
                {liveStatus?.verificationSource === "admin_manual"
                  ? "Payment Manually Approved (Audited)"
                  : "Payment Verified by Provider"}
              </h3>
              <Badge variant="success">Paid</Badge>
              <Badge variant="outline" className="text-[10px]">
                {liveStatus?.verificationSource === "admin_manual"
                  ? "Manual Admin Review"
                  : "Provider API Confirmed"}
              </Badge>
              <Badge variant="soft">Order {effectiveOrderStatus}</Badge>
            </div>
            <p className="mt-1 text-xs text-emerald-900/85 dark:text-emerald-100/90">
              {liveStatus?.verificationSource === "admin_manual"
                ? "Your payment receipt was manually verified and approved by an AddisGebeya administrator."
                : "Payment successfully verified against provider records! Your AddisGebeya order has been confirmed."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-xl bg-surface p-4 text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Order Number</span>
            <p className="font-mono font-bold text-primary">#{orderNumber}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Verified Provider</span>
            <p className="font-bold uppercase text-foreground">
              {activeProvider?.name ?? effectiveProviderCode}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Transaction Reference</span>
            <p className="truncate font-mono font-bold text-foreground">
              {liveStatus?.transactionReference || reference || "Verified"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Verified Amount</span>
            <p className="font-display font-extrabold text-primary">
              {formatETB(liveStatus?.amountETB ?? totalETB)}
            </p>
          </div>
        </div>

        {liveStatus?.latestReceipt ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-surface p-3 text-xs">
            <div className="size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-media">
              <ProtectedReceiptImage
                receiptId={liveStatus.latestReceipt.id}
                fileUrl={liveStatus.latestReceipt.fileUrl}
                fallbackImageUrl={liveStatus.latestReceipt.imageUrl}
                alt={`Approved receipt for #${orderNumber}`}
                className="size-full object-cover"
              />
            </div>
            <div>
              <p className="font-bold text-foreground">Payment Receipt Approved</p>
              <p className="text-muted-foreground">
                Verified receipt on file ({liveStatus.latestReceipt.captureMethod === "camera" ? "Camera capture" : "Uploaded image"}).
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const effectiveLatestReceipt = liveStatus?.latestReceipt ?? null;
  const effectiveReceipts = liveStatus?.receipts ?? [];
  const hasSubmittedReceipt = Boolean(effectiveLatestReceipt);

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-primary" />
            <h3 className="font-display text-base font-bold text-foreground">
              Verify Your Bank / Mobile Payment
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Transfer <strong className="text-cta">{formatETB(totalETB)}</strong> for Order{" "}
            <strong className="font-mono text-primary">#{orderNumber}</strong>, then upload/capture
            your receipt or verify instantly with your transaction reference.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getPaymentBadgeVariant(effectiveLatestReceipt?.status ?? effectiveStatus)}>
            {effectiveLatestReceipt ? `Receipt: ${effectiveLatestReceipt.status}` : effectiveStatus}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isStatusFetching}
            onClick={() => refetchStatus()}
            title="Refresh payment status"
            aria-label="Refresh payment status"
            className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
          >
            <RefreshCw className={cn("size-3.5 shrink-0", isStatusFetching && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Live Status / Feedback Alert */}
      {feedback ? (
        <div
          role="alert"
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3.5 text-xs",
            feedback.tone === "success"
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              : feedback.tone === "warning"
                ? "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                : "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {feedback.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : feedback.tone === "warning" ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0" />
          )}
          <div>
            <p className="font-label font-bold">{feedback.title}</p>
            <p className="mt-0.5 leading-relaxed">{feedback.message}</p>
          </div>
        </div>
      ) : effectiveStatus === "ReviewRequired" && !hasSubmittedReceipt ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-50 p-3.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Clock className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-label font-bold">Flagged for Administrator Review</p>
            <p className="mt-0.5">
              This transaction requires manual verification by our Bole HQ team before dispatch. You
              can also upload or capture your receipt photo below to speed up review.
            </p>
          </div>
        </div>
      ) : null}

      {/* Bank / Provider Selection */}
      {providers.length > 0 ? (
        <div className="space-y-2">
          <label className="block font-label text-xs font-bold text-foreground">
            Payment Provider
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {providers.map((provider) => {
              const selected = activeProvider?.id === provider.id;
              return (
                <button
                  key={provider.id}
                  type="button"
                  disabled={isVerifying}
                  onClick={() => {
                    setOverrideProviderId(provider.id);
                    setFeedback(null);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-all cursor-pointer",
                    selected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-surface-low text-foreground hover:border-primary/50",
                  )}
                >
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg font-mono text-[10px] font-extrabold text-white"
                    style={{ backgroundColor: provider.color }}
                  >
                    {provider.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-label font-bold">{provider.name}</span>
                    <span
                      className={cn(
                        "block text-[10px]",
                        selected ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {provider.healthStatus === "reachable"
                        ? "Instant verify"
                        : provider.healthStatus === "geo-blocked"
                          ? "Limited region"
                          : provider.type}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* AddisGebeya Receiving Account Box */}
      {activeProvider ? (
        <div className="rounded-xl border border-border/80 bg-surface-low p-4 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-label font-bold text-primary uppercase">
              AddisGebeya Receiving Account ({activeProvider.name})
            </span>
            <Badge variant="soft">Currency: ETB</Badge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface p-3 border border-border/60">
            <div>
              <p className="text-[11px] text-muted-foreground">Account Holder</p>
              <p className="font-bold text-foreground">{activeProvider.receivingAccountName}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Account / Wallet Number</p>
              <p className="font-mono text-sm font-extrabold text-primary">
                {activeProvider.receivingAccountNumber}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyAccount}
              className="shrink-0"
            >
              {copiedAccount ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              <span>{copiedAccount ? "Copied" : "Copy Account"}</span>
            </Button>
          </div>
          {activeProvider.instructions ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {activeProvider.instructions}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Verification Method Switcher: Upload/Capture Receipt vs Instant Bank Reference */}
      <div className="grid grid-cols-1 gap-2 rounded-xl bg-surface-low p-1.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setVerificationMode("receipt")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-label text-xs font-bold transition-all cursor-pointer",
            verificationMode === "receipt"
              ? "bg-surface text-primary shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Upload className="size-3.5" />
          <Camera className="size-3.5" />
          <span>Upload / Capture Receipt</span>
        </button>
        <button
          type="button"
          onClick={() => setVerificationMode("reference")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-label text-xs font-bold transition-all cursor-pointer",
            verificationMode === "reference"
              ? "bg-surface text-primary shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ShieldCheck className="size-3.5" />
          <span>Instant Verify (Reference / QR)</span>
        </button>
      </div>

      {verificationMode === "receipt" ? (
        <PaymentReceiptSubmission
          orderNumber={orderNumber}
          providerId={activeProvider?.id ?? effectiveProviderCode}
          providerName={activeProvider?.name}
          requiresPhone={activeProvider?.requiresPhone}
          initialReference={reference}
          latestReceipt={effectiveLatestReceipt}
          receipts={effectiveReceipts}
          onSubmitted={() => {
            refetchStatus();
          }}
        />
      ) : (
        /* Transaction Verification Form */
        <form onSubmit={handleVerifySubmit} className="space-y-4">
        {activeProvider?.supportsQr ? (
          <div className="flex items-center justify-between rounded-lg bg-surface-low/80 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <QrCode className="size-3.5 text-primary" /> Input mode:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setUseQrMode(false)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-label text-[11px] font-bold cursor-pointer",
                  !useQrMode ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                Reference / Receipt Link
              </button>
              <button
                type="button"
                onClick={() => setUseQrMode(true)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-label text-[11px] font-bold cursor-pointer",
                  useQrMode ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                QR Payload
              </button>
            </div>
          </div>
        ) : null}

        {!useQrMode ? (
          <div>
            <label htmlFor="tx-reference" className="mb-1.5 block font-label text-xs font-bold">
              Transaction Reference or Receipt Link *
            </label>
            <Input
              id="tx-reference"
              value={reference}
              disabled={isVerifying}
              onChange={(e) => setReferenceInput(e.target.value)}
              placeholder={
                activeProvider?.formats[0]?.label ||
                "Enter FT reference, transaction number, or official receipt link"
              }
              className="font-mono"
            />
            {activeProvider?.formats.length ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Accepted: {activeProvider.formats.map((f) => f.label).join(" • ")}
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <label htmlFor="tx-qr" className="mb-1.5 block font-label text-xs font-bold">
              Receipt QR Payload Data *
            </label>
            <Textarea
              id="tx-qr"
              rows={3}
              value={qrData}
              disabled={isVerifying}
              onChange={(e) => setQrData(e.target.value)}
              placeholder="Paste raw receipt QR code string..."
              className="font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Decoded-only QR payloads are never approved on their own; AddisGebeya verifies every
              QR transaction directly against bank records.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {needsAccountField ? (
            <div>
              <label htmlFor="tx-account" className="mb-1.5 block font-label text-xs font-bold">
                Receiving Account Suffix (Last {activeProvider?.accountDigits ?? 8} digits)
              </label>
              <Input
                id="tx-account"
                value={accountNumber}
                disabled={isVerifying}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={`Optional — defaults to AddisGebeya (${activeProvider?.receivingAccountNumber.slice(-(activeProvider?.accountDigits ?? 5))})`}
                className="font-mono"
              />
            </div>
          ) : null}

          {activeProvider?.requiresPhone && !useQrMode ? (
            <div>
              <label htmlFor="tx-phone" className="mb-1.5 block font-label text-xs font-bold">
                Payer Phone Number *
              </label>
              <Input
                id="tx-phone"
                value={phoneNumber}
                disabled={isVerifying}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="09XXXXXXXX or 251XXXXXXXXX"
                className="font-mono"
              />
            </div>
          ) : null}
        </div>

        <Button
          type="submit"
          variant="cta"
          size="lg"
          disabled={isVerifying || (!reference.trim() && !qrData.trim())}
          className="w-full"
        >
          {isVerifying ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Verifying Payment with Bank...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="size-4" />
              <span>Verify Payment ({formatETB(totalETB)})</span>
            </>
          )}
        </Button>
      </form>
      )}
    </div>
  );
}

