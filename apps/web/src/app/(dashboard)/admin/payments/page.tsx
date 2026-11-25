"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileImage,
  Landmark,
  Loader2,
  RefreshCw,
  RotateCcw,
  ScanText,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Upload,
  XCircle,
  ZoomIn,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminTablePageSkeleton } from "@/components/shared/page-skeletons";
import { OpenOfficialReceiptButton } from "@/components/shared/open-official-receipt-button";
import { OpenReceiptButton } from "@/components/shared/open-receipt-button";
import { ProtectedReceiptImage } from "@/components/shared/protected-receipt-image";
import { ReceiptLightboxModal } from "@/components/shared/receipt-lightbox-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ModalDialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import {
  getReceiptBadgeVariant,
  getVerificationSourceLabel,
} from "@/features/payment/payment-receipt-submission";
import {
  getPaymentBadgeVariant,
  isPaymentSettledStatus,
} from "@/features/payment/payment-verification-panel";
import { useIsMounted } from "@/hooks/use-is-mounted";
import {
  useAdminPaymentsQuery,
  usePaymentProviderConfigsQuery,
} from "@/hooks/use-store-queries";
import { storeService } from "@/services/store.service";
import { useUiStore } from "@/stores/ui.store";
import type {
  AdminPaymentRecordDto,
  PaymentProviderConfigDto,
  PaymentReceiptDto,
} from "@/types/store.types";
import { formatDateShort, formatETB } from "@/utils/format";
import { formatFileSize } from "@/utils/image-processing";
import { cn } from "@/lib/utils";

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "All Payment Statuses" },
  { value: "ManualReview", label: "Receipt: Manual Review" },
  { value: "ReceiptPending", label: "Receipt: Pending / Processing" },
  { value: "Verified", label: "Receipt: Verified" },
  { value: "Rejected", label: "Receipt: Rejected" },
  { value: "ReviewRequired", label: "Payment: Review Required" },
  { value: "Paid", label: "Payment: Paid" },
  { value: "Pending", label: "Payment: Pending Transfer" },
  { value: "Failed", label: "Payment: Failed / Rejected" },
  { value: "cod_due", label: "COD Due" },
];

const PROVIDER_FILTER_OPTIONS = [
  { value: "", label: "All Providers" },
  { value: "cbe", label: "CBE" },
  { value: "telebirr", label: "Telebirr" },
  { value: "boa", label: "Bank of Abyssinia (BOA)" },
  { value: "dashen", label: "Dashen Bank" },
  { value: "awash", label: "Awash Bank" },
  { value: "cbebirr", label: "CBE Birr" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "siinqee", label: "Siinqee Bank" },
  { value: "wegagen", label: "Wegagen Bank" },
  { value: "bunna", label: "Bunna Bank" },
  { value: "zamzam", label: "ZamZam Bank" },
  { value: "ebirr", label: "eBirr" },
  { value: "cod", label: "Cash on Delivery" },
];

function AdminPaymentsInner() {
  const isMounted = useIsMounted();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const addToast = useUiStore((s) => s.addToast);

  const [activeTab, setActiveTab] = React.useState<"queue" | "providers">("queue");
  const [search, setSearch] = React.useState(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [providerFilter, setProviderFilter] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [page, setPage] = React.useState(1);
  const limit = 15;

  const [selectedPayment, setSelectedPayment] = React.useState<AdminPaymentRecordDto | null>(
    null,
  );
  const [zoomReceipt, setZoomReceipt] = React.useState<{
    receipt: PaymentReceiptDto;
    orderNumber: string;
  } | null>(null);
  const [reviewReason, setReviewReason] = React.useState("");
  const [reviewReference, setReviewReference] = React.useState("");
  const [reviewCbeToken, setReviewCbeToken] = React.useState("");
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false);
  const [retryingReceiptId, setRetryingReceiptId] = React.useState<string | null>(null);
  const [openReceiptError, setOpenReceiptError] = React.useState<string | null>(null);

  const [editingProvider, setEditingProvider] =
    React.useState<PaymentProviderConfigDto | null>(null);
  const [providerForm, setProviderForm] = React.useState({
    displayName: "",
    receivingAccountName: "",
    receivingAccountNumber: "",
    accountSuffixDigits: "",
    instructions: "",
    maxPaymentAgeDays: "14",
    isEnabled: true,
  });
  const [isSavingProvider, setIsSavingProvider] = React.useState(false);

  const {
    data: paymentsResponse,
    isLoading: isPaymentsLoading,
    isFetching: isPaymentsFetching,
    refetch: refetchPayments,
  } = useAdminPaymentsQuery({
    status: statusFilter || undefined,
    provider: providerFilter || undefined,
    search: search.trim() || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit,
  });

  const {
    data: providerConfigs = [],
    isLoading: isProvidersLoading,
    refetch: refetchProviders,
  } = usePaymentProviderConfigsQuery();

  const items = paymentsResponse?.items ?? [];
  const pagination = paymentsResponse?.pagination ?? {
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
  };
  const summary = paymentsResponse?.summary ?? {
    paidCount: 0,
    pendingCount: 0,
    reviewRequiredCount: 0,
    failedCount: 0,
    pendingReceiptsCount: 0,
    manualReviewCount: 0,
    verifiedReceiptsCount: 0,
  };

  const openInspectionModal = (record: AdminPaymentRecordDto) => {
    setSelectedPayment(record);
    setReviewReason("");
    setOpenReceiptError(null);
    setReviewReference(
      record.verifiedReference ||
        record.latestReceipt?.transactionReference ||
        record.latestReceipt?.extractedReference ||
        record.transactionReference ||
        "",
    );
    setReviewCbeToken(
      record.cbeReceiptToken ||
        record.latestReceipt?.cbeReceiptToken ||
        "",
    );
  };

  const handleRetryReceiptProviderVerify = async (receipt: PaymentReceiptDto) => {
    if (!selectedPayment) return;
    setRetryingReceiptId(receipt.id);
    try {
      const refOverride =
        reviewReference.trim() ||
        receipt.transactionReference?.trim() ||
        receipt.extractedReference?.trim() ||
        undefined;
      const result = await storeService.verifyPaymentReceipt(receipt.id, {
        provider: receipt.provider || selectedPayment.provider,
        transactionReference: refOverride,
        cbeReceiptToken:
          reviewCbeToken.trim() || receipt.cbeReceiptToken?.trim() || undefined,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({
          queryKey: ["payment-status", selectedPayment.orderNumber],
        }),
      ]);
      const refreshed = await storeService.listAdminPayments({
        search: selectedPayment.orderNumber,
        page: 1,
        limit: 5,
      });
      const updatedRecord = refreshed.items.find((i) => i.id === selectedPayment.id);
      if (updatedRecord) {
        setSelectedPayment(updatedRecord);
        setReviewCbeToken(
          updatedRecord.cbeReceiptToken ||
            updatedRecord.latestReceipt?.cbeReceiptToken ||
            "",
        );
      }
      addToast({
        title: result.verified ? "Provider API Verified" : "Provider Verification Update",
        description: result.message,
        variant: result.verified
          ? "success"
          : result.verificationStatus === "Rejected"
            ? "error"
            : "warning",
      });
    } catch (err) {
      addToast({
        title: "Provider API Check Failed",
        description: err instanceof Error ? err.message : "Could not run API verification.",
        variant: "error",
      });
    } finally {
      setRetryingReceiptId(null);
    }
  };

  const openProviderEditor = (cfg: PaymentProviderConfigDto) => {
    setEditingProvider(cfg);
    setProviderForm({
      displayName: cfg.displayName,
      receivingAccountName: cfg.receivingAccountName,
      receivingAccountNumber: cfg.receivingAccountNumber,
      accountSuffixDigits:
        cfg.accountSuffixDigits != null ? String(cfg.accountSuffixDigits) : "",
      instructions: cfg.instructions ?? "",
      maxPaymentAgeDays: String(cfg.maxPaymentAgeDays ?? 14),
      isEnabled: cfg.isEnabled,
    });
  };

  const handleReviewDecision = async (
    decision: "approve" | "reject" | "request_new_receipt",
  ) => {
    if (!selectedPayment) return;
    if (reviewReason.trim().length < 5) {
      addToast({
        title: "Audit Reason Required",
        description: "Please provide a clear written reason (at least 5 characters).",
        variant: "warning",
      });
      return;
    }

    setIsSubmittingReview(true);
    try {
      const trimmedCbeInput = reviewCbeToken.trim();
      const updated = await storeService.reviewAdminPayment(selectedPayment.id, {
        decision,
        reason: reviewReason.trim(),
        reference: reviewReference.trim() || undefined,
        ...(trimmedCbeInput.startsWith("https://")
          ? { officialReceiptUrl: trimmedCbeInput }
          : trimmedCbeInput
            ? { cbeReceiptToken: trimmedCbeInput }
            : {}),
        requestNewReceipt: decision === "request_new_receipt",
      });
      setSelectedPayment(updated);
      setReviewCbeToken(updated.cbeReceiptToken || updated.latestReceipt?.cbeReceiptToken || "");
      setReviewReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({
          queryKey: ["payment-status", selectedPayment.orderNumber],
        }),
        queryClient.invalidateQueries({
          queryKey: ["payment-receipts", selectedPayment.orderNumber],
        }),
      ]);
      addToast({
        title:
          decision === "approve"
            ? "Payment Approved"
            : decision === "request_new_receipt"
              ? "New Receipt Requested"
              : "Payment Rejected",
        description: `Order #${updated.orderNumber} is now ${updated.paymentStatus} (${updated.orderStatus}).`,
        variant: decision === "approve" ? "success" : "warning",
      });
    } catch (err) {
      addToast({
        title: "Review Action Failed",
        description: err instanceof Error ? err.message : "Could not submit review.",
        variant: "error",
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSaveProviderConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;

    if (!providerForm.receivingAccountName.trim() || !providerForm.receivingAccountNumber.trim()) {
      addToast({
        title: "Required Account Fields Missing",
        description: "Receiving account name and number are required.",
        variant: "warning",
      });
      return;
    }

    setIsSavingProvider(true);
    try {
      const suffixDigits = providerForm.accountSuffixDigits.trim()
        ? Number(providerForm.accountSuffixDigits.trim())
        : null;
      const maxAge = Number(providerForm.maxPaymentAgeDays || 14);

      await storeService.updatePaymentProviderConfig(editingProvider.providerCode, {
        displayName: providerForm.displayName.trim() || editingProvider.displayName,
        receivingAccountName: providerForm.receivingAccountName.trim(),
        receivingAccountNumber: providerForm.receivingAccountNumber.trim(),
        accountSuffixDigits:
          suffixDigits !== null && Number.isFinite(suffixDigits) && suffixDigits >= 2
            ? suffixDigits
            : null,
        instructions: providerForm.instructions.trim() || null,
        maxPaymentAgeDays: Number.isFinite(maxAge) && maxAge >= 1 ? maxAge : 14,
        isEnabled: providerForm.isEnabled,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-payment-providers"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-providers"] }),
      ]);
      addToast({
        title: "Provider Config Updated",
        description: `${editingProvider.displayName} receiving details saved.`,
        variant: "success",
      });
      setEditingProvider(null);
      refetchProviders();
    } catch (err) {
      addToast({
        title: "Save Failed",
        description: err instanceof Error ? err.message : "Could not update provider.",
        variant: "error",
      });
    } finally {
      setIsSavingProvider(false);
    }
  };

  const columns: DataTableColumn<AdminPaymentRecordDto>[] = [
    {
      key: "order",
      header: "Order & Customer",
      render: (p) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono font-extrabold text-primary">#{p.orderNumber}</span>
            <Badge variant="outline" className="text-[10px]">
              {p.orderStatus}
            </Badge>
          </div>
          <p className="text-xs font-semibold text-foreground">{p.customerName}</p>
          <p className="text-[11px] text-muted-foreground">{p.customerEmail}</p>
        </div>
      ),
    },
    {
      key: "reference",
      header: "Provider & Reference",
      render: (p) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-label text-xs font-bold uppercase text-foreground">
              {p.provider}
            </span>
            {p.isDuplicateReference && (
              <Badge variant="destructive" className="text-[10px]">
                Duplicate Ref
              </Badge>
            )}
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {p.verifiedReference || p.transactionReference || "Not submitted yet"}
          </p>
          {p.extractedReference &&
          p.extractedReference !== p.transactionReference &&
          !p.verifiedReference ? (
            <p className="font-mono text-[11px] text-primary">
              OCR: {p.extractedReference}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amounts",
      align: "right",
      render: (p) => {
        const displayAmount = p.verifiedAmountETB ?? p.amountETB;
        const hasMismatch =
          Math.round(displayAmount * 100) !== Math.round(p.expectedOrderTotalETB * 100);
        return (
          <div className="space-y-0.5 text-right">
            <span className="block font-display font-extrabold text-primary">
              {formatETB(displayAmount)}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              Order: {formatETB(p.expectedOrderTotalETB)}
            </span>
            {p.extractedAmountETB != null ? (
              <span className="block text-[10px] text-muted-foreground">
                OCR: {formatETB(p.extractedAmountETB)}
              </span>
            ) : null}
            {hasMismatch && (
              <span className="block text-[10px] font-semibold text-destructive">
                Mismatch
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "accounts",
      header: "Payer / Receiver",
      render: (p) => (
        <div className="space-y-0.5 text-xs">
          <p className="text-foreground">
            <span className="text-muted-foreground">From:</span>{" "}
            {p.senderName || p.senderAccount || "—"}
          </p>
          <p className="text-muted-foreground">
            <span>To:</span> {p.receiverAccount || p.receiverName || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status & Receipt",
      render: (p) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={getPaymentBadgeVariant(p.paymentStatus)}>
              {p.paymentStatus}
            </Badge>
            {p.latestReceipt ? (
              <Badge variant={getReceiptBadgeVariant(p.latestReceipt.status)} className="text-[10px]">
                {p.latestReceipt.captureMethod === "camera" ? (
                  <Camera className="size-2.5" />
                ) : (
                  <FileImage className="size-2.5" />
                )}
                Receipt: {p.latestReceipt.status}
              </Badge>
            ) : null}
          </div>
          {p.verificationSource && p.verificationSource !== "pending" ? (
            <Badge
              variant={p.verificationSource === "provider_api" ? "success" : "outline"}
              className="text-[10px]"
            >
              {p.verificationSource === "provider_api"
                ? "Verified by Provider"
                : "Manual Admin Approval"}
            </Badge>
          ) : null}
          <span className="block text-[11px] text-muted-foreground">
            {p.verifiedAt
              ? `Verified ${formatDateShort(p.verifiedAt)}`
              : p.latestReceipt
                ? `Receipt ${formatDateShort(p.latestReceipt.submittedAt)}`
                : formatDateShort(p.updatedAt)}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Receipt & Inspect",
      align: "right",
      render: (p) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <OpenOfficialReceiptButton
            provider={p.provider}
            officialReceiptUrl={p.officialReceiptUrl ?? p.latestReceipt?.officialReceiptUrl}
            cbeReceiptToken={p.cbeReceiptToken ?? p.latestReceipt?.cbeReceiptToken}
            transactionReference={p.transactionReference}
            verifiedReference={p.verifiedReference}
            extractedReference={p.extractedReference ?? p.latestReceipt?.extractedReference}
            sourceUrl={p.sourceUrl}
            qrData={p.latestReceipt?.extractedQrData}
            reason={p.officialReceiptReason ?? p.latestReceipt?.officialReceiptReason}
            label="Open Official Receipt"
            size="sm"
            variant="cta"
          />
          {p.latestReceipt ? (
            <OpenReceiptButton
              receiptId={p.latestReceipt.id}
              label="View Uploaded Receipt"
              size="sm"
              variant="outline"
            />
          ) : null}
          <Button
            type="button"
            variant={
              p.paymentStatus === "ReviewRequired" ||
              p.latestReceipt?.status === "Pending" ||
              p.latestReceipt?.status === "Manual Review"
                ? "cta"
                : "outline"
            }
            size="sm"
            onClick={() => openInspectionModal(p)}
          >
            <Eye className="size-3.5" /> Inspect (
            {p.receipts?.length ? `${p.receipts.length}R` : p.logs.length})
          </Button>
        </div>
      ),
    },
  ];

  if (!isMounted) {
    return <AdminTablePageSkeleton title="Payment Verification" hasCreateButton={false} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Payment Verification Console
          </h1>
          <p className="text-xs text-muted-foreground">
            Inspect receipt verifications, resolve flagged mismatches, and configure store
            receiving accounts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={activeTab === "queue" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("queue")}
          >
            <ShieldCheck className="size-4" /> Verification Queue
          </Button>
          <Button
            type="button"
            variant={activeTab === "providers" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("providers")}
          >
            <Settings2 className="size-4" /> Receiving Accounts ({providerConfigs.length})
          </Button>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setActiveTab("queue");
            setStatusFilter(statusFilter === "Paid" ? "" : "Paid");
            setPage(1);
          }}
          className={cn(
            "rounded-xl border bg-surface p-4 text-left shadow-card transition-all cursor-pointer",
            statusFilter === "Paid" ? "border-emerald-500 ring-1 ring-emerald-500/40" : "border-border",
          )}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Verified Paid</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-foreground">
            {summary.paidCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("queue");
            setStatusFilter(statusFilter === "Pending" ? "" : "Pending");
            setPage(1);
          }}
          className={cn(
            "rounded-xl border bg-surface p-4 text-left shadow-card transition-all cursor-pointer",
            statusFilter === "Pending" ? "border-primary ring-1 ring-primary/40" : "border-border",
          )}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Pending Transfer</span>
            <Clock className="size-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-foreground">
            {summary.pendingCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("queue");
            setStatusFilter(statusFilter === "ManualReview" ? "" : "ManualReview");
            setPage(1);
          }}
          className={cn(
            "rounded-xl border bg-surface p-4 text-left shadow-card transition-all cursor-pointer",
            statusFilter === "ManualReview" ||
              statusFilter === "ReviewRequired" ||
              statusFilter === "ReceiptPending"
              ? "border-amber-500 ring-1 ring-amber-500/40"
              : "border-border",
          )}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Manual Review &amp; Pending</span>
            <ShieldAlert className="size-4 text-amber-600" />
          </div>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {summary.manualReviewCount ?? summary.reviewRequiredCount}
            </p>
            <div className="flex flex-wrap gap-1">
              {(summary.pendingReceiptsCount ?? 0) > 0 ? (
                <Badge variant="warning" className="text-[10px]">
                  {summary.pendingReceiptsCount} Pending
                </Badge>
              ) : null}
              {(summary.verifiedReceiptsCount ?? 0) > 0 ? (
                <Badge variant="success" className="text-[10px]">
                  {summary.verifiedReceiptsCount} Verified R.
                </Badge>
              ) : null}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("queue");
            setStatusFilter(statusFilter === "Failed" ? "" : "Failed");
            setPage(1);
          }}
          className={cn(
            "rounded-xl border bg-surface p-4 text-left shadow-card transition-all cursor-pointer",
            statusFilter === "Failed"
              ? "border-destructive ring-1 ring-destructive/40"
              : "border-border",
          )}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Failed Verifications</span>
            <XCircle className="size-4 text-destructive" />
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-destructive">
            {summary.failedCount}
          </p>
        </button>
      </div>

      {activeTab === "queue" ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 shadow-card sm:grid-cols-2 xl:grid-cols-12 xl:items-center">
            <div className="relative sm:col-span-2 xl:col-span-3">
              <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Order #, Reference, or Customer..."
                className="pl-10"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-xs font-bold text-foreground xl:col-span-2"
            >
              {PAYMENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-xs font-bold text-foreground xl:col-span-2"
            >
              {PROVIDER_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              aria-label="Start date"
              className="min-w-0 xl:col-span-2"
            />

            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              aria-label="End date"
              className="min-w-0 xl:col-span-2"
            />

            <div className="sm:col-span-2 xl:col-span-1">
              <Button
                type="button"
                variant="outline"
                title="Refresh queue"
                aria-label="Refresh payment verification queue"
                disabled={isPaymentsFetching}
                onClick={() => refetchPayments()}
                className="h-11 w-full gap-1.5 rounded-lg px-3 text-xs font-bold xl:px-0"
              >
                <RefreshCw
                  className={cn("size-4 shrink-0", isPaymentsFetching && "animate-spin")}
                />
                <span className="xl:sr-only">Refresh Queue</span>
              </Button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={items}
            rowKey={(p) => p.id}
            emptyMessage="No payments match the selected filters."
            isLoading={isPaymentsLoading}
          />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-xs">
              <span className="text-muted-foreground">
                Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>{" "}
                ({pagination.total} payment records)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-3.5" /> Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-low p-4 text-xs text-muted-foreground">
            <strong className="text-foreground">Store Account Validation Rules:</strong> Provider
            verifications check masked receiver accounts and account holder names strictly against
            these configured receiving accounts. Ensure only real AddisGebeya accounts are enabled.
          </div>

          {isProvidersLoading ? (
            <AdminTablePageSkeleton title="Providers" hasCreateButton={false} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {providerConfigs.map((cfg) => (
                <div
                  key={cfg.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-5 shadow-card"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Landmark className="size-4 text-primary" />
                        <div>
                          <h3 className="font-display text-sm font-bold text-foreground">
                            {cfg.displayName}
                          </h3>
                          <span className="font-mono text-[11px] uppercase text-muted-foreground">
                            {cfg.providerCode}
                          </span>
                        </div>
                      </div>
                      <Badge variant={cfg.isEnabled ? "success" : "destructive"}>
                        {cfg.isEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>

                    <div className="space-y-1 rounded-lg bg-surface-low p-3 text-xs">
                      <p>
                        <span className="text-muted-foreground">Holder:</span>{" "}
                        <strong className="text-foreground">{cfg.receivingAccountName}</strong>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Account / Wallet:</span>{" "}
                        <strong className="font-mono text-primary">
                          {cfg.receivingAccountNumber}
                        </strong>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Max Age Window:</span>{" "}
                        <strong>{cfg.maxPaymentAgeDays} days</strong>
                        {cfg.accountSuffixDigits ? ` • ${cfg.accountSuffixDigits}-digit suffix` : ""}
                      </p>
                    </div>

                    {cfg.instructions && (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {cfg.instructions}
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openProviderEditor(cfg)}
                  >
                    <Settings2 className="size-3.5" /> Configure Receiving Account
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inspection & Audited Manual Review Modal */}
      <ModalDialog
        open={Boolean(selectedPayment)}
        onClose={() => setSelectedPayment(null)}
        className="max-w-4xl"
        title={
          selectedPayment
            ? `Payment Inspection — Order #${selectedPayment.orderNumber}`
            : ""
        }
        description={
          selectedPayment
            ? `${selectedPayment.customerName} (${selectedPayment.customerEmail}) • Provider: ${selectedPayment.provider.toUpperCase()}`
            : ""
        }
      >
        {selectedPayment && (
          <div className="space-y-5 text-sm">
            {openReceiptError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-bold">Receipt Unavailable</p>
                  <p className="mt-0.5">{openReceiptError}</p>
                </div>
              </div>
            )}

            {selectedPayment.isDuplicateReference && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-bold">Duplicate Transaction Reference Detected</p>
                  <p>
                    This reference appears on another payment record. Carefully verify the original
                    bank receipt before taking action.
                  </p>
                </div>
              </div>
            )}

            {/* Persistent Original Receipt Card & Status-Specific Guidance */}
            {selectedPayment.latestReceipt ? (
              <div className="rounded-xl border border-primary/25 bg-surface-low p-4 text-xs">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <button
                    type="button"
                    onClick={() =>
                      setZoomReceipt({
                        receipt: selectedPayment.latestReceipt!,
                        orderNumber: selectedPayment.orderNumber,
                      })
                    }
                    className="group relative flex h-48 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-media p-2 sm:w-56 cursor-zoom-in"
                    title="Inspect original receipt in full-resolution zoom viewer"
                  >
                    <ProtectedReceiptImage
                      receiptId={selectedPayment.latestReceipt.id}
                      fileUrl={selectedPayment.latestReceipt.fileUrl}
                      fallbackImageUrl={selectedPayment.latestReceipt.imageUrl}
                      mimeType={selectedPayment.latestReceipt.mimeType}
                      alt={`Original receipt for order #${selectedPayment.orderNumber}`}
                      className="max-h-full max-w-full object-contain"
                    />
                    <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white">
                      <ZoomIn className="size-3" /> Zoom
                    </span>
                  </button>

                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-display text-sm font-bold text-foreground">
                          Original Customer Receipt
                        </span>
                        <Badge variant={getReceiptBadgeVariant(selectedPayment.latestReceipt.status)}>
                          {selectedPayment.latestReceipt.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {getVerificationSourceLabel(
                            selectedPayment.latestReceipt.verificationSource,
                          )}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Submitted {formatDateShort(selectedPayment.latestReceipt.submittedAt)}
                      </span>
                    </div>

                    <p className="leading-relaxed text-muted-foreground">
                      {isPaymentSettledStatus(selectedPayment.paymentStatus)
                        ? selectedPayment.verificationSource === "provider_api"
                          ? "Payment has been confirmed by the payment provider API. The original receipt remains permanently stored for audit and dispute inspection."
                          : "Payment was manually approved after administrator review. The original receipt remains permanently stored for inspection."
                        : selectedPayment.latestReceipt.status === "Manual Review" ||
                            selectedPayment.paymentStatus === "ReviewRequired"
                          ? "Automatic verification requires administrator inspection. Open the full-resolution receipt to compare reference, amount, and receiving account."
                          : selectedPayment.latestReceipt.status === "Rejected"
                            ? "This submission was rejected. Rejected receipts and any replacement submissions are preserved in full below."
                            : "Receipt is pending verification. Open and inspect the original receipt before making a verification decision."}
                    </p>

                    {(selectedPayment.failureReason ||
                      selectedPayment.latestReceipt.failureReason ||
                      selectedPayment.latestReceipt.rejectionReason) && (
                      <div
                        className={cn(
                          "rounded-lg border px-3 py-2",
                          selectedPayment.latestReceipt.status === "Rejected"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-amber-500/35 bg-amber-50/70 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100",
                        )}
                      >
                        <span className="font-bold">
                          {selectedPayment.latestReceipt.status === "Rejected"
                            ? "Rejection / Failure Reason: "
                            : "Auto-Verification Note: "}
                        </span>
                        <span>
                          {selectedPayment.latestReceipt.rejectionReason ||
                            selectedPayment.latestReceipt.failureReason ||
                            selectedPayment.failureReason}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <OpenOfficialReceiptButton
                        provider={selectedPayment.provider}
                        officialReceiptUrl={
                          selectedPayment.officialReceiptUrl ??
                          selectedPayment.latestReceipt.officialReceiptUrl
                        }
                        cbeReceiptToken={
                          selectedPayment.cbeReceiptToken ??
                          selectedPayment.latestReceipt.cbeReceiptToken
                        }
                        transactionReference={selectedPayment.transactionReference}
                        verifiedReference={selectedPayment.verifiedReference}
                        extractedReference={selectedPayment.latestReceipt.extractedReference}
                        sourceUrl={selectedPayment.sourceUrl}
                        qrData={selectedPayment.latestReceipt.extractedQrData}
                        reason={
                          selectedPayment.officialReceiptReason ??
                          selectedPayment.latestReceipt.officialReceiptReason
                        }
                        label="Open Official Receipt"
                        variant="cta"
                        size="sm"
                      />
                      <OpenReceiptButton
                        receiptId={selectedPayment.latestReceipt.id}
                        label="View Uploaded Receipt"
                        variant="outline"
                        size="sm"
                        onError={(msg) => setOpenReceiptError(msg)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setZoomReceipt({
                            receipt: selectedPayment.latestReceipt!,
                            orderNumber: selectedPayment.orderNumber,
                          })
                        }
                      >
                        <ZoomIn className="size-3.5" /> Zoom / Rotate
                      </Button>
                      {!isPaymentSettledStatus(selectedPayment.paymentStatus) &&
                        selectedPayment.latestReceipt.status !== "Verified" &&
                        selectedPayment.latestReceipt.status !== "Approved" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={retryingReceiptId === selectedPayment.latestReceipt.id}
                            onClick={() =>
                              handleRetryReceiptProviderVerify(selectedPayment.latestReceipt!)
                            }
                          >
                            {retryingReceiptId === selectedPayment.latestReceipt.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3.5" />
                            )}
                            Re-run Provider API Verify
                          </Button>
                        )}
                    </div>
                    {!selectedPayment.officialReceiptUrl &&
                    !selectedPayment.latestReceipt.officialReceiptUrl &&
                    (selectedPayment.officialReceiptReason ||
                      selectedPayment.latestReceipt.officialReceiptReason) ? (
                      <div className="rounded-lg border border-amber-500/35 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                        <span className="font-bold">Official Provider Link Unavailable: </span>
                        <span>
                          {selectedPayment.officialReceiptReason ||
                            selectedPayment.latestReceipt.officialReceiptReason}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              selectedPayment.failureReason &&
              !selectedPayment.reviewReason && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-50/70 p-3 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold">Verification / OCR Failure Reason</p>
                    <p className="mt-0.5">{selectedPayment.failureReason}</p>
                  </div>
                </div>
              )
            )}

            {/* Side-by-Side Transaction Details & OCR vs Provider Attribution */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2 rounded-xl bg-surface-low p-4 text-xs">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                  <span className="font-display text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Order &amp; Transaction Summary
                  </span>
                  <Badge variant={getPaymentBadgeVariant(selectedPayment.paymentStatus)}>
                    {selectedPayment.paymentStatus}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div>
                    <span className="text-muted-foreground">Order Number</span>
                    <p className="font-mono font-bold text-primary">
                      #{selectedPayment.orderNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer</span>
                    <p className="font-semibold text-foreground">{selectedPayment.customerName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payment Provider</span>
                    <p className="font-bold uppercase text-foreground">
                      {selectedPayment.provider}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Verification Source</span>
                    <div className="mt-0.5">
                      <Badge
                        variant={
                          selectedPayment.verificationSource === "provider_api"
                            ? "success"
                            : selectedPayment.verificationSource === "admin_manual"
                              ? "warning"
                              : "soft"
                        }
                        className="text-[10px]"
                      >
                        {getVerificationSourceLabel(selectedPayment.verificationSource)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Original Submitted Ref</span>
                    <p className="font-mono font-semibold text-foreground break-all">
                      {selectedPayment.transactionReference || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Confirmed Ref</span>
                    <p className="font-mono font-semibold text-foreground break-all">
                      {selectedPayment.verifiedReference || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Order Total</span>
                    <p className="font-bold text-foreground">
                      {formatETB(selectedPayment.expectedOrderTotalETB)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Verified / Paid Amount</span>
                    <p className="font-bold text-primary">
                      {selectedPayment.verifiedAmountETB != null
                        ? formatETB(selectedPayment.verifiedAmountETB)
                        : formatETB(selectedPayment.amountETB)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Receiver Account</span>
                    <p className="font-semibold text-foreground">
                      {selectedPayment.receiverName || "—"} (
                      {selectedPayment.receiverAccount || "—"})
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tx / Verified Time</span>
                    <p className="font-semibold text-foreground">
                      {selectedPayment.verifiedAt
                        ? formatDateShort(selectedPayment.verifiedAt)
                        : selectedPayment.transactionDate
                          ? formatDateShort(selectedPayment.transactionDate)
                          : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] text-muted-foreground">
                      Official Provider Receipt ({selectedPayment.provider.toUpperCase()})
                    </span>
                    <p className="truncate font-mono text-[11px] font-medium text-foreground">
                      {selectedPayment.officialReceiptUrl
                        ? selectedPayment.officialReceiptUrl
                        : selectedPayment.cbeReceiptToken
                          ? `CBE Token: ${selectedPayment.cbeReceiptToken}`
                          : selectedPayment.officialReceiptReason ||
                            "No official provider receipt link available"}
                    </p>
                  </div>
                  <OpenOfficialReceiptButton
                    provider={selectedPayment.provider}
                    officialReceiptUrl={
                      selectedPayment.officialReceiptUrl ??
                      selectedPayment.latestReceipt?.officialReceiptUrl
                    }
                    cbeReceiptToken={
                      selectedPayment.cbeReceiptToken ??
                      selectedPayment.latestReceipt?.cbeReceiptToken
                    }
                    transactionReference={selectedPayment.transactionReference}
                    verifiedReference={selectedPayment.verifiedReference}
                    extractedReference={
                      selectedPayment.extractedReference ??
                      selectedPayment.latestReceipt?.extractedReference
                    }
                    sourceUrl={selectedPayment.sourceUrl}
                    qrData={selectedPayment.latestReceipt?.extractedQrData}
                    reason={
                      selectedPayment.officialReceiptReason ??
                      selectedPayment.latestReceipt?.officialReceiptReason
                    }
                    label="Open Official Receipt"
                    variant="cta"
                    size="sm"
                  />
                </div>
              </div>

              {/* Distinct OCR Extraction vs Provider Confirmation Panel */}
              <div className="space-y-3">
                <div className="space-y-2 rounded-xl border border-border bg-surface-low p-4 text-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                    <span className="inline-flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-primary">
                      <ScanText className="size-3.5" /> OCR-Extracted Info
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Unverified OCR Estimate
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    <div>
                      <span className="text-muted-foreground">OCR Transaction #</span>
                      <p className="font-mono font-bold text-foreground break-all">
                        {selectedPayment.latestReceipt?.extractedReference ||
                          selectedPayment.extractedReference ||
                          "Not detected"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">OCR Amount</span>
                      <p className="font-bold text-foreground">
                        {selectedPayment.extractedAmountETB != null
                          ? formatETB(selectedPayment.extractedAmountETB)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">OCR Date &amp; Time</span>
                      <p className="text-foreground">
                        {selectedPayment.latestReceipt?.extractedDate || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">OCR Confidence</span>
                      <p className="text-foreground">
                        {selectedPayment.latestReceipt?.ocrConfidence != null
                          ? `${selectedPayment.latestReceipt.ocrConfidence}%`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">OCR Receiver</span>
                      <p className="truncate text-foreground">
                        {selectedPayment.latestReceipt?.extractedReceiverName ||
                          selectedPayment.latestReceipt?.extractedReceiverAccount ||
                          "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">OCR Sender</span>
                      <p className="truncate text-foreground">
                        {selectedPayment.latestReceipt?.extractedSenderName ||
                          selectedPayment.latestReceipt?.extractedSenderAccount ||
                          "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedPayment.verificationResponse && (
                  <div className="space-y-2 rounded-xl border border-border bg-surface-low/80 p-3.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-primary">
                        <Landmark className="size-3.5" /> Provider API Verification Result
                      </span>
                      <Badge
                        variant={
                          selectedPayment.verificationResponse.verified === true
                            ? "success"
                            : "warning"
                        }
                        className="text-[10px]"
                      >
                        {selectedPayment.verificationResponse.verified === true
                          ? "Confirmed by Provider"
                          : "Unconfirmed / Mismatch"}
                      </Badge>
                    </div>
                    <pre className="max-h-36 overflow-auto rounded-lg bg-surface p-2.5 font-mono text-[11px] leading-relaxed text-foreground">
                      {JSON.stringify(selectedPayment.verificationResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {selectedPayment.reviewReason && (
              <div className="rounded-xl border border-border bg-surface-container/40 p-3 text-xs">
                <p className="font-bold text-foreground">Review / Failure Note</p>
                <p className="mt-1 text-muted-foreground">{selectedPayment.reviewReason}</p>
              </div>
            )}

            {/* Submitted Customer Payment Receipts (All Historical Original & Replacements Preserved) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Submitted Payment Receipts History ({selectedPayment.receipts?.length ?? 0})
                </h4>
                {selectedPayment.latestReceipt ? (
                  <Badge variant={getReceiptBadgeVariant(selectedPayment.latestReceipt.status)}>
                    Latest: {selectedPayment.latestReceipt.status}
                  </Badge>
                ) : null}
              </div>

              {!selectedPayment.receipts || selectedPayment.receipts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-low/50 p-4 text-xs text-muted-foreground">
                  No receipt image or PDF has been uploaded by the customer for this payment yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedPayment.receipts.map((receipt, idx) => {
                    const submissionIndex = selectedPayment.receipts.length - idx;
                    return (
                      <div
                        key={receipt.id}
                        className={cn(
                          "rounded-xl border p-3.5 text-xs space-y-2.5",
                          idx === 0
                            ? "border-primary/30 bg-surface-low/70"
                            : "border-border bg-surface-low/40",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {submissionIndex === 1
                                ? "#1 Original Submission"
                                : `#${submissionIndex} Replacement`}
                            </Badge>
                            <Badge variant={getReceiptBadgeVariant(receipt.status)}>
                              {receipt.status}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {getVerificationSourceLabel(receipt.verificationSource)}
                            </Badge>
                            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                              {receipt.captureMethod === "camera" ? (
                                <Camera className="size-3.5 text-primary" />
                              ) : (
                                <Upload className="size-3.5 text-primary" />
                              )}
                              {receipt.captureMethod === "camera"
                                ? "Camera Capture"
                                : "Uploaded File"}
                            </span>
                            {idx === 0 && (
                              <Badge variant="soft" className="text-[10px]">
                                Latest
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDateShort(receipt.submittedAt)}
                          </span>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          <button
                            type="button"
                            onClick={() =>
                              setZoomReceipt({
                                receipt,
                                orderNumber: selectedPayment.orderNumber,
                              })
                            }
                            className="group relative flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-media p-1.5 sm:w-44 cursor-zoom-in"
                            title="Click to open and zoom receipt"
                          >
                            <ProtectedReceiptImage
                              receiptId={receipt.id}
                              fileUrl={receipt.fileUrl}
                              fallbackImageUrl={receipt.imageUrl}
                              mimeType={receipt.mimeType}
                              alt={`Receipt for order #${selectedPayment.orderNumber}`}
                              className="max-h-full max-w-full object-contain"
                            />
                            <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white">
                              <ZoomIn className="size-3" /> Zoom
                            </span>
                          </button>

                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                              <p>
                                <span className="text-muted-foreground">Provider:</span>{" "}
                                <strong className="uppercase text-foreground">
                                  {receipt.provider}
                                </strong>
                              </p>
                              <p>
                                <span className="text-muted-foreground">Submitted Ref:</span>{" "}
                                <strong className="font-mono text-foreground">
                                  {receipt.transactionReference || "Not entered"}
                                </strong>
                              </p>
                              <p className="sm:col-span-2">
                                <span className="text-muted-foreground">File Details:</span>{" "}
                                <span className="font-medium text-foreground">
                                  {receipt.mimeType.replace("image/", "").replace("application/", "").toUpperCase()}{" "}
                                  • {formatFileSize(receipt.fileSizeBytes)}
                                  {receipt.width && receipt.height
                                    ? ` • ${receipt.width}×${receipt.height}px`
                                    : ""}
                                </span>
                              </p>
                            </div>

                            {/* OCR Extraction Details Box */}
                            {receipt.ocrCompletedAt ||
                            receipt.extractedReference ||
                            receipt.extractedAmountETB != null ||
                            receipt.extractedQrData ? (
                              <div className="space-y-1.5 rounded-lg border border-border bg-surface p-2.5 text-[11px]">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                  <span className="inline-flex items-center gap-1 font-bold text-primary">
                                    <ScanText className="size-3.5" /> OCR Extracted Info
                                  </span>
                                  {receipt.ocrConfidence != null ? (
                                    <Badge variant="soft" className="text-[10px]">
                                      {receipt.ocrConfidence}% confidence
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                  <p>
                                    <span className="text-muted-foreground">OCR Ref:</span>{" "}
                                    <span className="font-mono font-bold text-foreground">
                                      {receipt.extractedReference || "None"}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">OCR Amount:</span>{" "}
                                    <span className="font-bold text-foreground">
                                      {receipt.extractedAmountETB != null
                                        ? formatETB(receipt.extractedAmountETB)
                                        : "—"}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">OCR Date:</span>{" "}
                                    <span className="text-foreground">
                                      {receipt.extractedDate || "—"}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">OCR Provider:</span>{" "}
                                    <span className="uppercase text-foreground">
                                      {receipt.detectedProvider || "—"}
                                    </span>
                                  </p>
                                  {(receipt.extractedSenderName ||
                                    receipt.extractedSenderAccount) && (
                                    <p>
                                      <span className="text-muted-foreground">Sender:</span>{" "}
                                      <span className="text-foreground">
                                        {receipt.extractedSenderName ||
                                          receipt.extractedSenderAccount}
                                      </span>
                                    </p>
                                  )}
                                  {(receipt.extractedReceiverName ||
                                    receipt.extractedReceiverAccount) && (
                                    <p>
                                      <span className="text-muted-foreground">Receiver:</span>{" "}
                                      <span className="text-foreground">
                                        {receipt.extractedReceiverName ||
                                          receipt.extractedReceiverAccount}
                                      </span>
                                    </p>
                                  )}
                                </div>
                                {receipt.extractedQrData && (
                                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                                    QR: {receipt.extractedQrData}
                                  </p>
                                )}
                              </div>
                            ) : null}

                            {(receipt.rejectionReason || receipt.failureReason) && (
                              <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-destructive">
                                <strong>Failure / Rejection Reason:</strong>{" "}
                                {receipt.rejectionReason || receipt.failureReason}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                              <OpenOfficialReceiptButton
                                provider={receipt.provider || selectedPayment.provider}
                                officialReceiptUrl={receipt.officialReceiptUrl}
                                cbeReceiptToken={receipt.cbeReceiptToken}
                                transactionReference={
                                  receipt.transactionReference || selectedPayment.transactionReference
                                }
                                verifiedReference={selectedPayment.verifiedReference}
                                extractedReference={receipt.extractedReference}
                                sourceUrl={selectedPayment.sourceUrl}
                                qrData={receipt.extractedQrData}
                                reason={receipt.officialReceiptReason}
                                label="Open Official Receipt"
                                variant="cta"
                                size="sm"
                              />
                              <OpenReceiptButton
                                receiptId={receipt.id}
                                label="View Uploaded Receipt"
                                variant="default"
                                size="sm"
                                onError={(msg) => setOpenReceiptError(msg)}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setZoomReceipt({
                                    receipt,
                                    orderNumber: selectedPayment.orderNumber,
                                  })
                                }
                              >
                                <ZoomIn className="size-3.5" /> Zoom / Rotate Modal
                              </Button>
                              {!isPaymentSettledStatus(selectedPayment.paymentStatus) &&
                                receipt.status !== "Verified" &&
                                receipt.status !== "Approved" && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={retryingReceiptId === receipt.id}
                                    onClick={() => handleRetryReceiptProviderVerify(receipt)}
                                  >
                                    {retryingReceiptId === receipt.id ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <RefreshCw className="size-3.5" />
                                    )}
                                    Re-run Provider API Verify
                                  </Button>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Audited Verification Logs */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Verification Attempt &amp; Audit History ({selectedPayment.logs.length})
                </h4>
                {selectedPayment.latestReceipt ? (
                  <OpenReceiptButton
                    receiptId={selectedPayment.latestReceipt.id}
                    label="View Latest Uploaded Receipt"
                    variant="ghost"
                    size="sm"
                    onError={(msg) => setOpenReceiptError(msg)}
                  />
                ) : null}
              </div>
              {selectedPayment.logs.length === 0 ? (
                <p className="rounded-lg bg-surface-low p-3 text-xs text-muted-foreground">
                  No automated or admin verification attempts logged yet.
                </p>
              ) : (
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {selectedPayment.logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-border bg-surface-low p-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getPaymentBadgeVariant(log.verificationStatus)}>
                            {log.verificationStatus}
                          </Badge>
                          <span className="font-semibold uppercase text-muted-foreground">
                            {log.actorType}
                          </span>
                          {log.chekiHttpStatus && (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              HTTP {log.chekiHttpStatus}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateShort(log.attemptedAt)}
                        </span>
                      </div>
                      {log.submittedReference && (
                        <p className="mt-1 font-mono text-[11px] text-foreground">
                          Ref: {log.submittedReference}
                        </p>
                      )}
                      {(log.errorMessage || log.reason) && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {log.reason || log.errorMessage}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audited Manual Override Form */}
            {isPaymentSettledStatus(selectedPayment.paymentStatus) ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  This payment is already settled (<strong>{selectedPayment.paymentStatus}</strong>
                  ). Verified paid records cannot be manually overridden.
                </span>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-border bg-surface-container/50 p-4">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-primary">
                  Audited Manual Review Decision
                </h4>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    Verified Reference (optional when approving)
                  </label>
                  <Input
                    value={reviewReference}
                    onChange={(e) => setReviewReference(e.target.value)}
                    placeholder="e.g. FT2611998877"
                  />
                </div>
                {selectedPayment.provider?.toLowerCase() === "cbe" ? (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-foreground">
                      Official CBE Receipt Token or URL (optional)
                    </label>
                    <Input
                      value={reviewCbeToken}
                      onChange={(e) => setReviewCbeToken(e.target.value)}
                      placeholder="e.g. v2-hfHCxHBTw7FA4RR1DP0b or https://mbreciept.cbe.com.et/v2-..."
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Enter only the real CBE receipt token or official URL supplied during payment confirmation; never invent a token from an FT reference.
                    </p>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    Audit / Rejection Reason <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    rows={2}
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="Explain verification evidence or rejection reason (min 5 characters)..."
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Receipt verified against AddisGebeya bank statement.",
                      "Receipt image is blurry or cut off; please upload a clearer photo.",
                      "Transferred amount or receiving account does not match order total.",
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setReviewReason(preset)}
                        className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmittingReview}
                    onClick={() => handleReviewDecision("request_new_receipt")}
                  >
                    {isSubmittingReview ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    Request New Receipt
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isSubmittingReview}
                    onClick={() => handleReviewDecision("reject")}
                  >
                    {isSubmittingReview ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <XCircle className="size-3.5" />
                    )}
                    Reject Payment
                  </Button>
                  <Button
                    type="button"
                    variant="cta"
                    size="sm"
                    disabled={isSubmittingReview}
                    onClick={() => handleReviewDecision("approve")}
                  >
                    {isSubmittingReview ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    Approve &amp; Confirm Order
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </ModalDialog>

      {/* Edit Receiving Account Modal */}
      <ModalDialog
        open={Boolean(editingProvider)}
        onClose={() => setEditingProvider(null)}
        title={
          editingProvider
            ? `Configure Receiving Account — ${editingProvider.displayName}`
            : ""
        }
        description="Customers will be shown these details and submitted receipts will validate against this receiving account."
      >
        {editingProvider && (
          <form onSubmit={handleSaveProviderConfig} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Display Name</label>
                <Input
                  value={providerForm.displayName}
                  onChange={(e) =>
                    setProviderForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Account Holder Name *</label>
                <Input
                  value={providerForm.receivingAccountName}
                  onChange={(e) =>
                    setProviderForm((f) => ({ ...f, receivingAccountName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Account / Wallet Number *
                </label>
                <Input
                  value={providerForm.receivingAccountNumber}
                  onChange={(e) =>
                    setProviderForm((f) => ({ ...f, receivingAccountNumber: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Account Suffix Digits (optional)
                </label>
                <Input
                  type="number"
                  min={2}
                  max={16}
                  value={providerForm.accountSuffixDigits}
                  onChange={(e) =>
                    setProviderForm((f) => ({ ...f, accountSuffixDigits: e.target.value }))
                  }
                  placeholder="e.g. 5 or 8"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Max Receipt Age (Days)</label>
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={providerForm.maxPaymentAgeDays}
                  onChange={(e) =>
                    setProviderForm((f) => ({ ...f, maxPaymentAgeDays: e.target.value }))
                  }
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={providerForm.isEnabled}
                    onChange={(e) =>
                      setProviderForm((f) => ({ ...f, isEnabled: e.target.checked }))
                    }
                    className="size-4 accent-primary"
                  />
                  Enable Provider at Checkout
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Checkout Instructions</label>
              <Textarea
                rows={3}
                value={providerForm.instructions}
                onChange={(e) =>
                  setProviderForm((f) => ({ ...f, instructions: e.target.value }))
                }
                placeholder="Instructions displayed to customers during transfer..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingProvider(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="cta" disabled={isSavingProvider}>
                {isSavingProvider && <Loader2 className="size-3.5 animate-spin" />}
                Save Configuration
              </Button>
            </div>
          </form>
        )}
      </ModalDialog>
      {/* Fullscreen Zoom Lightbox for Receipt Inspection */}
      <ReceiptLightboxModal
        open={Boolean(zoomReceipt)}
        onClose={() => setZoomReceipt(null)}
        title={
          zoomReceipt
            ? `Receipt Inspection — Order #${zoomReceipt.orderNumber}`
            : "Receipt Inspection"
        }
        subtitle={
          zoomReceipt
            ? `${zoomReceipt.receipt.provider.toUpperCase()} • ${zoomReceipt.receipt.status} • Submitted ${formatDateShort(zoomReceipt.receipt.submittedAt)}`
            : undefined
        }
        receiptId={zoomReceipt?.receipt.id}
        fileUrl={zoomReceipt?.receipt.fileUrl}
        fallbackImageUrl={zoomReceipt?.receipt.imageUrl}
        mimeType={zoomReceipt?.receipt.mimeType}
      />
    </div>
  );
}

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<AdminTablePageSkeleton title="Payment Verification" hasCreateButton={false} />}>
      <AdminPaymentsInner />
    </Suspense>
  );
}

