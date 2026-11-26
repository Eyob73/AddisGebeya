"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, Package, ShieldCheck, Truck, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AccountShell } from "@/components/layout/account-shell";
import { OrderHistoryPageSkeleton } from "@/components/shared/page-skeletons";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog, ModalDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getPaymentBadgeVariant,
  isPaymentSettledStatus,
} from "@/features/payment/payment-verification-panel";
import { useOrdersQuery } from "@/hooks/use-store-queries";
import { storeService } from "@/services/store.service";
import { useUiStore } from "@/stores/ui.store";
import type { OrderRecord } from "@/types/store.types";
import { formatDateShort, formatETB } from "@/utils/format";
import { cn } from "@/lib/utils";
import { DEFAULT_FALLBACK_IMAGE, getThumbnailImageUrl } from "@/utils/cloudinary";

const STATUS_TABS = [
  { id: "all", label: "All Orders" },
  { id: "active", label: "In Progress" },
  { id: "delivered", label: "Delivered" },
];

export default function OrderHistoryPage() {
  const isMounted = useIsMounted();
  const queryClient = useQueryClient();
  const addToast = useUiStore((s) => s.addToast);
  const { data: orders = [], isLoading, refetch } = useOrdersQuery();
  const [filter, setFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedOrder, setSelectedOrder] = React.useState<OrderRecord | null>(null);
  const [cancelTargetOrder, setCancelTargetOrder] = React.useState<OrderRecord | null>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const canCustomerCancelOrder = (order: OrderRecord) => {
    const s = order.status.toLowerCase();
    return s === "pendingpayment" || s === "pending" || s === "confirmed";
  };

  const handleConfirmCancel = async () => {
    if (!cancelTargetOrder || isCancelling) return;
    setIsCancelling(true);
    try {
      await storeService.cancelOrder(cancelTargetOrder.id, "Cancelled by customer from Order History");
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
      addToast({
        title: `Order #${cancelTargetOrder.id} Cancelled`,
        description: "Your order has been cancelled and reserved stock released.",
        variant: "warning",
      });
    } catch (err) {
      addToast({
        title: "Cancellation Failed",
        description: err instanceof Error ? err.message : "Could not cancel order.",
        variant: "error",
      });
    } finally {
      setIsCancelling(false);
      setCancelTargetOrder(null);
    }
  };

  const PAGE_SIZE = 5;

  const filtered = React.useMemo(() => {
    if (filter === "delivered") {
      return orders.filter((o) => o.status.toLowerCase() === "delivered");
    }
    if (filter === "active") {
      return orders.filter((o) => {
        const s = o.status.toLowerCase();
        return s !== "delivered" && s !== "cancelled";
      });
    }
    return orders;
  }, [orders, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedOrders = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const handleTabChange = (tabId: string) => {
    setFilter(tabId);
    setCurrentPage(1);
  };

  if (!isMounted || isLoading) {
    return (
      <AccountShell
        title="Order History"
        subtitle="Review all your AddisGebeya Shoes receipts, sizes purchased, and dispatch details."
      >
        <OrderHistoryPageSkeleton />
      </AccountShell>
    );
  }

  return (
    <AccountShell
      title="Order History"
      subtitle="Review all your AddisGebeya Shoes receipts, sizes purchased, and dispatch details."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "rounded-full px-4 py-2 font-label text-xs font-bold transition-colors cursor-pointer",
                filter === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-surface text-foreground hover:bg-primary-light",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No Orders in This View"
            description="Orders you place at Checkout appear here immediately with live courier tracking."
            action={
              <Button asChild variant="cta">
                <Link href="/shop">Shop Footwear</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {paginatedOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-border bg-surface p-5 shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display text-base font-extrabold text-foreground">
                      Order #{order.id}
                    </span>
                    <Badge
                      variant={
                        order.status.toLowerCase() === "delivered"
                          ? "success"
                          : order.status === "PendingPayment"
                            ? "warning"
                            : order.status.toLowerCase() === "cancelled"
                              ? "destructive"
                              : order.status === "out_for_delivery" ||
                                  order.status === "Shipped" ||
                                  order.status === "Confirmed"
                                ? "cta"
                                : "soft"
                      }
                    >
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant={getPaymentBadgeVariant(order.paymentStatus)}>
                      Payment: {order.paymentStatus.replace(/_/g, " ")}
                    </Badge>
                    {order.receiptStatus ? (
                      <Badge
                        variant={
                          order.receiptStatus === "Verified" || order.receiptStatus === "Approved"
                            ? "success"
                            : order.receiptStatus === "Rejected"
                              ? "destructive"
                              : "warning"
                        }
                      >
                        Receipt: {order.receiptStatus}
                      </Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      Placed {formatDateShort(order.createdAt)}
                    </span>
                  </div>
                  <span className="font-display text-lg font-extrabold text-primary">
                    {formatETB(order.totalETB)}
                  </span>
                </div>

                <div className="divide-y divide-border/60 py-2">
                  {order.items.map((item, idx) => (
                    <div key={`${order.id}-${idx}`} className="flex items-center gap-3.5 py-2.5">
                      <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-surface-media p-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getThumbnailImageUrl(item.image)}
                          alt={item.productName}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                          }}
                          className="size-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-bold text-foreground">
                          {item.productName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.colorwayName} • EU {item.size} × {item.quantity}
                        </p>
                      </div>
                      <span className="font-display text-sm font-bold text-foreground">
                        {formatETB(item.unitPriceETB * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {order.receiptStatus === "Rejected" && order.latestReceiptRejectionReason ? (
                  <div className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
                    <span className="font-bold">
                      {order.latestReceiptResubmissionRequested
                        ? "New Receipt Requested: "
                        : "Receipt Rejected: "}
                    </span>
                    <span className="text-foreground">{order.latestReceiptRejectionReason}</span>
                  </div>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
                  <span className="text-xs text-muted-foreground">
                    Destination: <strong className="text-foreground">{order.subCity}</strong> •
                    Payment:{" "}
                    <strong className="text-foreground uppercase">
                      {order.paymentMethod.replace("_", " ")}
                    </strong>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isPaymentSettledStatus(order.paymentStatus) &&
                      order.paymentMethod !== "cod" &&
                      order.paymentStatus !== "cod_due" &&
                      order.status.toLowerCase() !== "cancelled" && (
                        <Button asChild variant="cta" size="sm">
                          <Link href={`/checkout?order=${encodeURIComponent(order.id)}`}>
                            <ShieldCheck className="size-3.5" />{" "}
                            {order.receiptStatus === "Rejected"
                              ? "Upload Replacement Receipt"
                              : order.receiptStatus === "Manual Review"
                                ? "Retry Verification / Review"
                                : order.receiptStatus === "Pending" ||
                                    order.receiptStatus === "Processing"
                                  ? "View Receipt Status"
                                  : "Submit Receipt / Verify"}
                          </Link>
                        </Button>
                      )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <Eye className="size-3.5" /> Receipt
                    </Button>
                    {canCustomerCancelOrder(order) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isCancelling}
                        onClick={() => setCancelTargetOrder(order)}
                        className="text-destructive hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/40"
                      >
                        <XCircle className="size-3.5" /> Cancel
                      </Button>
                    ) : null}
                    <Button asChild size="sm">
                      <Link href={`/account/tracking?order=${order.id}`}>
                        <Truck className="size-3.5" /> Track Order
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
                  {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} orders
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="size-4 mr-1" /> Previous
                  </Button>

                  <span className="text-xs font-bold text-foreground px-2">
                    {currentPage} / {totalPages}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next <ChevronRight className="size-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ModalDialog
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Receipt — Order #${selectedOrder.id}` : ""}
        description={
          selectedOrder
            ? `${selectedOrder.customerName} • ${selectedOrder.subCity}, ${selectedOrder.city}`
            : ""
        }
      >
        {selectedOrder ? (
          <div className="space-y-4 text-sm">
            <div className="space-y-2 rounded-xl bg-surface-low p-4">
              {selectedOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    {item.productName} (EU {item.size}) × {item.quantity}
                  </span>
                  <span className="font-bold">{formatETB(item.unitPriceETB * item.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatETB(selectedOrder.subtotalETB)}</span>
              </div>
              {selectedOrder.discountETB > 0 ? (
                <div className="flex justify-between text-xs font-semibold text-cta">
                  <span>Discount ({selectedOrder.promoCode})</span>
                  <span>-{formatETB(selectedOrder.discountETB)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Delivery</span>
                <span>
                  {selectedOrder.deliveryFeeETB === 0
                    ? "FREE"
                    : formatETB(selectedOrder.deliveryFeeETB)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-display text-base font-extrabold text-primary">
                <span>Total Paid / Due</span>
                <span>{formatETB(selectedOrder.totalETB)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Landmark: {selectedOrder.landmark}
            </p>
          </div>
        ) : null}
      </ModalDialog>

      <ConfirmationDialog
        open={Boolean(cancelTargetOrder)}
        onClose={() => setCancelTargetOrder(null)}
        onConfirm={() => void handleConfirmCancel()}
        title={cancelTargetOrder ? `Cancel Order #${cancelTargetOrder.id}?` : "Cancel Order"}
        description="Cancelling this order releases your reserved shoe sizes back to inventory. This action cannot be undone."
        confirmLabel={isCancelling ? "Cancelling..." : "Confirm Cancellation"}
        cancelLabel="Keep Order"
        destructive
      />
    </AccountShell>
  );
}

