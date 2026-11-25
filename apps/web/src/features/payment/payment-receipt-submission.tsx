"use client";

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  Loader2,
  QrCode,
  RefreshCw,
  ScanText,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
  ZoomIn,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OpenReceiptButton } from "@/components/shared/open-receipt-button";
import { ProtectedReceiptImage } from "@/components/shared/protected-receipt-image";
import { ReceiptLightboxModal } from "@/components/shared/receipt-lightbox-modal";
import { ApiClientError } from "@/lib/api-client";
import { storeService } from "@/services/store.service";
import { useUiStore } from "@/stores/ui.store";
import type {
  PaymentReceiptDto,
  ReceiptCaptureMethod,
  ReceiptOcrExtractionDto,
  SubmitPaymentReceiptResponse,
} from "@/types/store.types";
import { formatDateShort, formatETB } from "@/utils/format";
import {
  formatFileSize,
  prepareReceiptImageFile,
  type PreparedReceiptImage,
} from "@/utils/image-processing";
import { cn } from "@/lib/utils";
import { ReceiptCameraModal } from "./receipt-camera-modal";

interface PaymentReceiptSubmissionProps {
  orderNumber: string;
  providerId: string;
  providerName?: string;
  requiresPhone?: boolean;
  initialReference?: string;
  latestReceipt?: PaymentReceiptDto | null;
  receipts?: PaymentReceiptDto[];
  onSubmitted?: (result: SubmitPaymentReceiptResponse) => void;
}

export function getReceiptBadgeVariant(
  status?: string | null,
): "success" | "warning" | "destructive" | "soft" {
  if (status === "Verified" || status === "Approved") return "success";
  if (status === "Pending" || status === "Processing" || status === "Manual Review") {
    return "warning";
  }
  if (status === "Rejected") return "destructive";
  return "soft";
}

export function getVerificationSourceLabel(source?: string | null): string {
  if (source === "provider_api") return "Provider API Verified";
  if (source === "admin_manual") return "Manual Admin Review (Audited)";
  return "Awaiting Verification";
}

export function PaymentReceiptSubmission({
  orderNumber,
  providerId,
  providerName,
  requiresPhone = false,
  initialReference = "",
  latestReceipt,
  receipts = [],
  onSubmitted,
}: PaymentReceiptSubmissionProps) {
  const queryClient = useQueryClient();
  const addToast = useUiStore((s) => s.addToast);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const inFlightRef = React.useRef(false);

  const [isDragging, setIsDragging] = React.useState(false);
  const [isProcessingImage, setIsProcessingImage] = React.useState(false);
  const [isRunningOcr, setIsRunningOcr] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isRetryingVerify, setIsRetryingVerify] = React.useState(false);
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);
  const [prepared, setPrepared] = React.useState<PreparedReceiptImage | null>(null);
  const [ocrResult, setOcrResult] = React.useState<ReceiptOcrExtractionDto | null>(null);
  const [ocrError, setOcrError] = React.useState<string | null>(null);
  const [captureMethod, setCaptureMethod] = React.useState<ReceiptCaptureMethod>("upload");
  const [txReference, setTxReference] = React.useState(
    initialReference &&
      !initialReference.startsWith("REF-") &&
      !initialReference.startsWith("PENDING-")
      ? initialReference
      : "",
  );
  const [payerPhone, setPayerPhone] = React.useState("");
  const [retryRefInput, setRetryRefInput] = React.useState("");
  const [retryPhoneInput, setRetryPhoneInput] = React.useState("");

  const [feedback, setFeedback] = React.useState<{
    tone: "success" | "warning" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [lightboxTarget, setLightboxTarget] = React.useState<{
    title: string;
    subtitle?: string;
    receiptId?: string;
    fileUrl?: string;
    fallbackImageUrl?: string;
    localPreviewUrl?: string;
    mimeType?: string;
  } | null>(null);

  const clearStagedImage = React.useCallback(() => {
    setPrepared((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setOcrResult(null);
    setOcrError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (prepared?.previewUrl) {
        URL.revokeObjectURL(prepared.previewUrl);
      }
    };
  }, [prepared?.previewUrl]);

  const handleSelectedFile = React.useCallback(
    async (file: File, method: ReceiptCaptureMethod) => {
      setFeedback(null);
      setOcrResult(null);
      setOcrError(null);
      setIsProcessingImage(true);
      try {
        const result = await prepareReceiptImageFile(file);
        setPrepared((prev) => {
          if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
          return result;
        });
        setCaptureMethod(method);
        setIsProcessingImage(false);

        setIsRunningOcr(true);
        try {
          const ocrFd = new FormData();
          ocrFd.append("receipt", result.file, result.file.name);
          ocrFd.append("orderId", orderNumber);
          ocrFd.append("provider", providerId);
          const extracted = await storeService.extractReceiptOcr(ocrFd);
          setOcrResult(extracted);
          if (extracted.extractedReference) {
            setTxReference(extracted.extractedReference);
          }
        } catch (ocrErr: unknown) {
          const msg =
            ocrErr instanceof Error
              ? ocrErr.message
              : "Could not scan receipt automatically. You can enter your transaction reference manually.";
          setOcrError(msg);
        } finally {
          setIsRunningOcr(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not load selected image.";
        setFeedback({
          tone: "error",
          title: "Invalid Receipt Image",
          message: msg,
        });
        addToast({
          title: "Invalid Receipt Image",
          description: msg,
          variant: "error",
        });
        setIsProcessingImage(false);
      }
    },
    [addToast, orderNumber, providerId],
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleSelectedFile(file, "upload");
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void handleSelectedFile(file, "upload");
  };

  const handleSubmitReceipt = async () => {
    if (!prepared || inFlightRef.current) {
      if (!prepared) {
        setFeedback({
          tone: "error",
          title: "Receipt Image Required",
          message: "Please upload an image or capture a receipt photo before submitting.",
        });
      }
      return;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("receipt", prepared.file, prepared.file.name);
      formData.append("orderId", orderNumber);
      formData.append("provider", ocrResult?.detectedProvider || providerId);
      formData.append("captureMethod", captureMethod);
      formData.append("autoVerify", "true");
      if (txReference.trim()) {
        formData.append("transactionReference", txReference.trim());
      }
      if (ocrResult?.extractedQrData) {
        formData.append("qrData", ocrResult.extractedQrData);
      }
      if (payerPhone.trim()) {
        formData.append("phoneNumber", payerPhone.trim());
      }

      const result = await storeService.submitPaymentReceipt(formData);
      clearStagedImage();

      const tone =
        result.verificationStatus === "Verified"
          ? "success"
          : result.verificationStatus === "Rejected"
            ? "error"
            : "warning";

      setFeedback({
        tone,
        title:
          result.verificationStatus === "Verified"
            ? "Payment Verified Automatically!"
            : result.verificationStatus === "Manual Review"
              ? "Sent for Manual Review"
              : result.verificationStatus === "Rejected"
                ? "Receipt Verification Unsuccessful"
                : "Receipt Submitted",
        message: result.message,
      });

      addToast({
        title:
          result.verificationStatus === "Verified"
            ? "Payment Verified"
            : result.verificationStatus === "Manual Review"
              ? "Manual Review Required"
              : "Verification Update",
        description: result.message,
        variant: tone,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-status", orderNumber] }),
        queryClient.invalidateQueries({ queryKey: ["order-receipts", orderNumber] }),
      ]);

      onSubmitted?.(result);
    } catch (err: unknown) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not submit payment receipt.";
      setFeedback({
        tone: "error",
        title:
          err instanceof ApiClientError && err.code === "DUPLICATE_TRANSACTION_REFERENCE"
            ? "Duplicate Transaction Reference"
            : "Upload Failed",
        message,
      });
      addToast({
        title: "Receipt Verification Error",
        description: message,
        variant: "error",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payment-status", orderNumber] }),
        queryClient.invalidateQueries({ queryKey: ["order-receipts", orderNumber] }),
      ]);
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleRetryExistingReceiptVerify = async (receiptId: string) => {
    setIsRetryingVerify(true);
    setFeedback(null);
    try {
      const result = await storeService.verifyPaymentReceipt(receiptId, {
        provider: providerId,
        transactionReference: retryRefInput.trim() || undefined,
        phoneNumber: retryPhoneInput.trim() || undefined,
      });

      const tone =
        result.verificationStatus === "Verified"
          ? "success"
          : result.verificationStatus === "Rejected"
            ? "error"
            : "warning";
      setFeedback({
        tone,
        title:
          result.verificationStatus === "Verified"
            ? "Payment Verified!"
            : result.verificationStatus === "Rejected"
              ? "Verification Rejected"
              : "Manual Review Required",
        message: result.message,
      });
      addToast({
        title: "Verification Checked",
        description: result.message,
        variant: tone,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-status", orderNumber] }),
        queryClient.invalidateQueries({ queryKey: ["order-receipts", orderNumber] }),
      ]);
      onSubmitted?.(result);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : "Could not verify receipt right now.";
      setFeedback({
        tone: "error",
        title: "Verification Failed",
        message: msg,
      });
    } finally {
      setIsRetryingVerify(false);
    }
  };

  const activeReceiptStatus = latestReceipt?.status;
  const isVerifiedReceipt =
    activeReceiptStatus === "Verified" || activeReceiptStatus === "Approved";
  const isPendingOrProcessing =
    activeReceiptStatus === "Pending" || activeReceiptStatus === "Processing";
  const isManualReviewReceipt = activeReceiptStatus === "Manual Review";
  const isRejectedReceipt = activeReceiptStatus === "Rejected";
  const canUploadNewReceipt =
    !isVerifiedReceipt && !isPendingOrProcessing;

  return (
    <div className="space-y-4">
      {feedback ? (
        <div
          role="alert"
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3.5 text-xs",
            feedback.tone === "success"
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-200"
              : feedback.tone === "warning"
                ? "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/35 dark:text-amber-200"
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
      ) : null}

      {/* Latest Submitted Receipt Status Banner */}
      {latestReceipt ? (
        <div
          className={cn(
            "space-y-3 rounded-2xl border p-4 text-xs",
            isVerifiedReceipt
              ? "border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/25"
              : isRejectedReceipt
                ? "border-destructive/40 bg-destructive/5"
                : "border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/25",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {isVerifiedReceipt ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : isRejectedReceipt ? (
                  <XCircle className="size-5 text-destructive" />
                ) : activeReceiptStatus === "Processing" ? (
                  <Loader2 className="size-5 animate-spin text-amber-600" />
                ) : (
                  <Clock className="size-5 text-amber-600" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-bold text-foreground">
                    {isVerifiedReceipt
                      ? latestReceipt.verificationSource === "admin_manual"
                        ? "Manually Approved Receipt"
                        : "Verified Payment Receipt"
                      : isRejectedReceipt
                        ? latestReceipt.resubmissionRequested
                          ? "New Receipt Requested"
                          : "Receipt Rejected"
                        : isManualReviewReceipt
                          ? "Receipt in Manual Review"
                          : activeReceiptStatus === "Processing"
                            ? "Verifying Transaction..."
                            : "Receipt Pending Verification"}
                  </span>
                  <Badge variant={getReceiptBadgeVariant(latestReceipt.status)}>
                    {latestReceipt.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {getVerificationSourceLabel(latestReceipt.verificationSource)}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  Submitted via{" "}
                  <strong className="text-foreground">
                    {latestReceipt.captureMethod === "camera" ? "Device Camera" : "File Upload"}
                  </strong>{" "}
                  on {formatDateShort(latestReceipt.submittedAt)}
                </p>
                {latestReceipt.extractedReference || latestReceipt.transactionReference ? (
                  <p className="text-muted-foreground">
                    Ref:{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {latestReceipt.transactionReference || latestReceipt.extractedReference}
                    </span>
                    {latestReceipt.extractedAmountETB != null ? (
                      <span className="ml-2">
                        • OCR Amount:{" "}
                        <strong className="text-foreground">
                          {formatETB(latestReceipt.extractedAmountETB)}
                        </strong>
                      </span>
                    ) : null}
                    {latestReceipt.verifiedAmountETB != null ? (
                      <span className="ml-2">
                        • Verified:{" "}
                        <strong className="text-primary">
                          {formatETB(latestReceipt.verifiedAmountETB)}
                        </strong>
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setLightboxTarget({
                    title: `Order #${orderNumber} Receipt`,
                    subtitle: `${latestReceipt.provider.toUpperCase()} • ${latestReceipt.status}`,
                    receiptId: latestReceipt.id,
                    fileUrl: latestReceipt.fileUrl,
                    fallbackImageUrl: latestReceipt.imageUrl,
                    mimeType: latestReceipt.mimeType,
                  })
                }
                className="group relative size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-media shadow-xs cursor-pointer"
                title="Zoom receipt"
              >
                <ProtectedReceiptImage
                  receiptId={latestReceipt.id}
                  fileUrl={latestReceipt.fileUrl}
                  fallbackImageUrl={latestReceipt.imageUrl}
                  mimeType={latestReceipt.mimeType}
                  alt={`Payment receipt for order #${orderNumber}`}
                  className="size-full object-contain"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <ZoomIn className="size-4 text-white" />
                </span>
              </button>
              <OpenReceiptButton
                receiptId={latestReceipt.id}
                label="Open Receipt"
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-[11px]"
              />
            </div>
          </div>

          {latestReceipt.failureReason || latestReceipt.rejectionReason ? (
            <div
              className={cn(
                "rounded-xl border px-3 py-2.5",
                isRejectedReceipt
                  ? "border-destructive/30 bg-surface text-destructive"
                  : "border-amber-500/30 bg-surface text-amber-900 dark:text-amber-200",
              )}
            >
              <span className="font-bold">
                {isRejectedReceipt ? "Reason: " : "Review Notice: "}
              </span>
              <span className="text-foreground">
                {latestReceipt.rejectionReason || latestReceipt.failureReason}
              </span>
            </div>
          ) : null}

          {isManualReviewReceipt || latestReceipt.status === "Pending" ? (
            <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
              <p className="font-label text-[11px] font-bold text-foreground">
                Enter or correct your Transaction Reference to retry instant verification:
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={retryRefInput}
                  onChange={(e) => setRetryRefInput(e.target.value)}
                  placeholder={
                    latestReceipt.transactionReference ||
                    latestReceipt.extractedReference ||
                    "e.g. FT2611... or Telebirr ID"
                  }
                  className="h-9 flex-1 font-mono text-xs"
                />
                {requiresPhone ? (
                  <Input
                    value={retryPhoneInput}
                    onChange={(e) => setRetryPhoneInput(e.target.value)}
                    placeholder="Payer phone (09...)"
                    className="h-9 sm:w-40 font-mono text-xs"
                  />
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="cta"
                  disabled={isRetryingVerify}
                  onClick={() => handleRetryExistingReceiptVerify(latestReceipt.id)}
                >
                  {isRetryingVerify ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  <span>Verify via API</span>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Upload / Camera Capture Interface */}
      {canUploadNewReceipt ? (
        <div className="space-y-4 rounded-2xl border border-border bg-surface-low/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-display text-sm font-bold text-foreground">
                {isRejectedReceipt || isManualReviewReceipt
                  ? "Upload Replacement Receipt Image"
                  : "Submit Payment Receipt (Auto OCR & Verification)"}
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Upload a clear screenshot or snap a photo. We extract the transaction number for you
                to confirm, then verify directly with {providerName ?? providerId.toUpperCase()}.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              JPG, PNG, WebP, PDF • Max 5 MB
            </Badge>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleFileInputChange}
            className="hidden"
            aria-label="Select payment receipt image or PDF file"
          />

          {!prepared ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border bg-surface hover:border-primary/60",
              )}
            >
              {isProcessingImage ? (
                <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-7 animate-spin text-primary" />
                  <span>Validating and optimizing receipt file...</span>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Upload className="size-5" />
                    </div>
                    <div className="flex size-11 items-center justify-center rounded-xl bg-cta/15 text-cta">
                      <Camera className="size-5" />
                    </div>
                  </div>
                  <p className="font-display text-sm font-bold text-foreground">
                    Drag &amp; drop your payment receipt here
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Supports CBE, Telebirr, BOA, Dashen, Awash, CBE Birr, M-Pesa, bank QR slips, and PDF receipts.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="size-4" /> Upload Receipt
                    </Button>
                    <Button
                      type="button"
                      variant="cta"
                      size="sm"
                      onClick={() => setIsCameraOpen(true)}
                    >
                      <Camera className="size-4" /> Capture with Camera
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <button
                  type="button"
                  onClick={() =>
                    setLightboxTarget({
                      title: "Receipt Preview",
                      subtitle: prepared.isPdf
                        ? `${prepared.file.name} • ${formatFileSize(prepared.finalSizeBytes)}`
                        : `${prepared.width}×${prepared.height}px • ${formatFileSize(prepared.finalSizeBytes)}`,
                      localPreviewUrl: prepared.previewUrl,
                      mimeType: prepared.file.type || (prepared.isPdf ? "application/pdf" : undefined),
                    })
                  }
                  className="group relative h-44 w-full shrink-0 overflow-hidden rounded-xl border border-border bg-surface-media sm:w-44 cursor-pointer"
                >
                  {prepared.isPdf ? (
                    <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-primary">
                      <FileText className="size-10 text-primary" />
                      <span className="line-clamp-2 font-mono font-bold text-foreground">
                        {prepared.file.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        PDF Document • {formatFileSize(prepared.finalSizeBytes)}
                      </span>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={prepared.previewUrl}
                      alt="Selected payment receipt preview"
                      className="size-full object-contain"
                    />
                  )}
                  <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                    <ZoomIn className="size-3" /> {prepared.isPdf ? "Preview PDF" : "Zoom"}
                  </span>
                </button>

                <div className="min-w-0 flex-1 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">
                      <FileCheck2 className="size-3" /> Ready for OCR &amp; Submission
                    </Badge>
                    <Badge variant="soft">
                      {captureMethod === "camera" ? "Camera Photo" : "Uploaded File"}
                    </Badge>
                    {prepared.wasCompressed ? (
                      <Badge variant="outline" className="text-[10px]">
                        Optimized to {formatFileSize(prepared.finalSizeBytes)}
                      </Badge>
                    ) : null}
                  </div>

                  {/* OCR Scanning Status & Extracted Summary */}
                  {isRunningOcr ? (
                    <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-primary">
                      <Loader2 className="size-4 animate-spin shrink-0" />
                      <div>
                        <p className="font-bold">Scanning receipt with OCR &amp; QR reader...</p>
                        <p className="text-[11px] opacity-80">
                          Detecting transaction ID, amount, sender, and date.
                        </p>
                      </div>
                    </div>
                  ) : ocrResult ? (
                    <div
                      className={cn(
                        "space-y-2 rounded-xl border p-3",
                        ocrResult.extractionSucceeded
                          ? "border-emerald-500/35 bg-emerald-50/70 dark:bg-emerald-950/20"
                          : "border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/20",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-label font-bold text-foreground">
                          <ScanText className="size-4 text-primary" />
                          {ocrResult.extractionSucceeded
                            ? "OCR Extracted Receipt Details"
                            : "OCR Could Not Detect Reference"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {ocrResult.extractedQrData ? (
                            <Badge variant="cta" className="text-[10px]">
                              <QrCode className="size-2.5" /> QR Detected
                            </Badge>
                          ) : null}
                          <Badge variant="soft" className="text-[10px]">
                            <Sparkles className="size-2.5" /> {ocrResult.confidence}% confidence
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:grid-cols-3">
                        <div>
                          <span className="text-muted-foreground">Detected Provider</span>
                          <p className="font-bold uppercase text-foreground">
                            {ocrResult.detectedProvider || providerId}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Extracted Amount</span>
                          <p className="font-bold text-foreground">
                            {ocrResult.extractedAmountETB != null
                              ? formatETB(ocrResult.extractedAmountETB)
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Date / Time</span>
                          <p className="truncate font-medium text-foreground">
                            {ocrResult.extractedDate || "—"}
                          </p>
                        </div>
                        {ocrResult.extractedSenderName || ocrResult.extractedSenderAccount ? (
                          <div>
                            <span className="text-muted-foreground">Sender</span>
                            <p className="truncate font-medium text-foreground">
                              {ocrResult.extractedSenderName || ocrResult.extractedSenderAccount}
                            </p>
                          </div>
                        ) : null}
                        {ocrResult.extractedReceiverName || ocrResult.extractedReceiverAccount ? (
                          <div>
                            <span className="text-muted-foreground">Receiver</span>
                            <p className="truncate font-medium text-foreground">
                              {ocrResult.extractedReceiverName || ocrResult.extractedReceiverAccount}
                            </p>
                          </div>
                        ) : null}
                        {ocrResult.extractedStatus ? (
                          <div>
                            <span className="text-muted-foreground">Receipt Status</span>
                            <p className="font-semibold text-foreground">
                              {ocrResult.extractedStatus}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {!ocrResult.extractionSucceeded ? (
                        <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                          {ocrResult.message} Enter the transaction ID below so we can verify it
                          automatically, or submit directly for manual administrator review.
                        </p>
                      ) : null}
                    </div>
                  ) : ocrError ? (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-50/70 p-2.5 text-[11px] text-amber-900 dark:bg-amber-950/25 dark:text-amber-200">
                      {ocrError}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="receipt-tx-ref"
                        className="mb-1 block font-label text-[11px] font-bold text-foreground"
                      >
                        Confirm / Correct Transaction Reference
                      </label>
                      <Input
                        id="receipt-tx-ref"
                        value={txReference}
                        disabled={isSubmitting || isRunningOcr}
                        onChange={(e) => setTxReference(e.target.value)}
                        placeholder="e.g. FT2611... or Telebirr ID"
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                    {requiresPhone ? (
                      <div>
                        <label
                          htmlFor="receipt-payer-phone"
                          className="mb-1 block font-label text-[11px] font-bold text-foreground"
                        >
                          Payer Phone Number (if no QR detected)
                        </label>
                        <Input
                          id="receipt-payer-phone"
                          value={payerPhone}
                          disabled={isSubmitting || isRunningOcr}
                          onChange={(e) => setPayerPhone(e.target.value)}
                          placeholder="09XXXXXXXX"
                          className="h-9 font-mono text-xs"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Replace Image
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => setIsCameraOpen(true)}
                    >
                      <Camera className="size-3.5" /> Retake with Camera
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={clearStagedImage}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="cta"
                size="lg"
                disabled={isSubmitting || isRunningOcr}
                onClick={handleSubmitReceipt}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Uploading &amp; Verifying with Payment Provider...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
                    <span>Confirm &amp; Verify Payment Receipt</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {receipts.length > 1 ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface-low/50 p-3 text-xs">
          <p className="font-label text-[11px] font-bold uppercase text-muted-foreground">
            Submission History ({receipts.length})
          </p>
          <div className="space-y-2">
            {receipts.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={getReceiptBadgeVariant(item.status)} className="text-[10px]">
                      {item.status}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {getVerificationSourceLabel(item.verificationSource)} •{" "}
                      {formatDateShort(item.submittedAt)}
                    </span>
                  </div>
                  {item.rejectionReason || item.failureReason ? (
                    <p className="mt-1 truncate text-[11px] text-destructive">
                      {item.rejectionReason || item.failureReason}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <OpenReceiptButton
                    receiptId={item.id}
                    label="Open Receipt"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setLightboxTarget({
                        title: `Receipt (${item.status})`,
                        subtitle: formatDateShort(item.submittedAt),
                        receiptId: item.id,
                        fileUrl: item.fileUrl,
                        fallbackImageUrl: item.imageUrl,
                        mimeType: item.mimeType,
                      })
                    }
                  >
                    <ZoomIn className="size-3.5" /> View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <ReceiptCameraModal
        open={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCaptureAccepted={(file: File) => {
          setIsCameraOpen(false);
          void handleSelectedFile(file, "camera");
        }}
        onFallbackUpload={() => {
          setIsCameraOpen(false);
          fileInputRef.current?.click();
        }}
      />

      <ReceiptLightboxModal
        open={Boolean(lightboxTarget)}
        onClose={() => setLightboxTarget(null)}
        title={lightboxTarget?.title ?? "Payment Receipt"}
        subtitle={lightboxTarget?.subtitle}
        receiptId={lightboxTarget?.receiptId}
        fileUrl={lightboxTarget?.fileUrl}
        fallbackImageUrl={lightboxTarget?.fallbackImageUrl}
        localPreviewUrl={lightboxTarget?.localPreviewUrl}
        mimeType={lightboxTarget?.mimeType}
      />
    </div>
  );
}
