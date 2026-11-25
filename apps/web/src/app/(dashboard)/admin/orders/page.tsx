"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Eye, Search, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ModalDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AdminTablePageSkeleton } from "@/components/shared/page-skeletons";
import { OpenOfficialReceiptButton } from "@/components/shared/open-official-receipt-button";
import { OpenReceiptButton } from "@/components/shared/open-receipt-button";
import {
  getPaymentBadgeVariant,
  isPaymentSettledStatus,
} from "@/features/payment/payment-verification-panel";
import { getReceiptBadgeVariant } from "@/features/payment/payment-receipt-submission";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useOrdersQuery } from "@/hooks/use-store-queries";
import { storeService } from "@/services/store.service";
import { useUiStore } from "@/stores/ui.store";
import type { OrderRecord, OrderStatus } from "@/types/store.types";
import { formatDateShort, formatETB } from "@/utils/format";

const ORDER_STATUSES: Array<{ value: OrderStatus; label: string }> = [
  { value: "PendingPayment", label: "Pending Payment" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Processing", label: "Processing" },
  { value: "Shipped", label: "Shipped" },
  { value: "Delivered", label: "Delivered" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "pending", label: "Pending (Legacy)" },
  { value: "confirmed", label: "Confirmed (Legacy)" },
  { value: "packed", label: "Packed (Legacy)" },
  { value: "out_for_delivery", label: "Out with Courier" },
  { value: "shipped_regional", label: "Shipped Regional" },
  { value: "delivered", label: "Delivered (Legacy)" },
  { value: "cancelled", label: "Cancelled (Legacy)" },
];

export default function AdminOrdersPage() {
  const { data: orders = [], isLoading, refetch } = useOrdersQuery();
  const addToast = useUiStore((s) => s.addToast);

  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedOrder, setSelectedOrder] = React.useState<OrderRecord | null>(null);
  const [refInput, setRefInput] = React.useState("");
  const isMounted = useIsMounted();

  const filteredOrders = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (
        q &&
        !o.id.toLowerCase().includes(q) &&
        !o.customerName.toLowerCase().includes(q) &&
        !o.subCity.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, query, statusFilter]);

  const columns: DataTableColumn<OrderRecord>[] = [
    {
      key: "id",
      header: "Order ID",
      render: (o) => (
        <div>
          <span className="font-mono font-extrabold text-primary">#{o.id}</span>
          <span className="block text-[11px] text-muted-foreground">
            {formatDateShort(o.createdAt)}
          </span>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer & Destination",
      render: (o) => (
        <div>
          <p className="font-bold text-foreground">{o.customerName}</p>
          <p className="text-xs text-muted-foreground">
            {o.subCity}, {o.city}
          </p>
        </div>
      ),
    },
    {
      key: "items",
      header: "Pairs",
      render: (o) => (
        <div className="text-xs">
          <span className="font-semibold text-foreground">
            {o.items.reduce((s, i) => s + i.quantity, 0)} pair(s)
          </span>
          <span className="block text-muted-foreground">
            EU {o.items.map((i) => i.size).join(", ")}
          </span>
        </div>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      render: (o) => (
        <div className="space-y-1">
          <span className="block font-label text-xs font-bold uppercase text-foreground">
            {o.paymentMethod.replace(/_/g, " ")}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant={getPaymentBadgeVariant(o.paymentStatus)}>
              {o.paymentStatus.replace(/_/g, " ")}
            </Badge>
            {o.receiptStatus ? (
              <Badge variant={getReceiptBadgeVariant(o.receiptStatus)} className="text-[10px]">
                Receipt: {o.receiptStatus}
              </Badge>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total (ETB)",
      align: "right",
      render: (o) => (
        <span className="font-display font-extrabold text-primary">{formatETB(o.totalETB)}</span>
      ),
    },
    {
      key: "status",
      header: "Fulfillment Status",
      render: (o) => (
        <select
          value={o.status}
          onChange={async (e) => {
            const nextStatus = e.target.value as OrderStatus;
            try {
              await storeService.updateOrderStatus(
                o.id,
                nextStatus,
                nextStatus === "out_for_delivery" || nextStatus === "Shipped"
                  ? "Courier Henok (Bike #04)"
                  : o.courierName,
              );
              refetch();
              addToast({
                title: `Order #${o.id} Updated`,
                description: `Status changed to ${nextStatus.replace(/_/g, " ")}.`,
                variant: "success",
              });
            } catch (err) {
              addToast({
                title: "Status Update Blocked",
                description:
                  err instanceof Error
                    ? err.message
                    : "Unpaid orders cannot be advanced until payment is verified.",
                variant: "error",
              });
            }
          }}
          className="h-9 rounded-lg border border-border bg-surface-low px-2.5 font-label text-xs font-bold text-foreground focus:border-primary focus:outline-none cursor-pointer"
        >
          {ORDER_STATUSES.map((st) => (
            <option key={st.value} value={st.value}>
              {st.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "actions",
      header: "Inspect",
      align: "right",
      render: (o) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedOrder(o);
            setRefInput(o.paymentReference ?? "");
          }}
        >
          <Eye className="size-3.5" /> Details
        </Button>
      ),
    },
  ];

  if (!isMounted || isLoading) {
    return <AdminTablePageSkeleton title="Orders" hasCreateButton={false} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Order Management &amp; Dispatch
          </h1>
          <p className="text-xs text-muted-foreground">
            Update fulfillment statuses, assign Addis couriers, and verify Telebirr / CBE transfers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/payments">
              <ShieldCheck className="size-4" /> Payment Verification
            </Link>
          </Button>
          <Badge variant="cta">{orders.length} Total Orders</Badge>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Order ID, customer name, or Addis sub-city..."
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 rounded-lg border border-border bg-surface px-3 text-xs font-bold text-foreground"
        >
          <option value="all">All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filteredOrders}
        rowKey={(o) => o.id}
        emptyMessage="No orders match your filter."
        isLoading={!isMounted}
      />

      <ModalDialog
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Order #${selectedOrder.id} — ${selectedOrder.customerName}` : ""}
        description={
          selectedOrder ? `${selectedOrder.customerPhone} • ${selectedOrder.customerEmail}` : ""
        }
      >
        {selectedOrder ? (
          <div className="space-y-5 text-sm">
            <div className="rounded-xl bg-surface-low p-4 text-xs space-y-1.5">
              <p>
                <strong>Address:</strong> {selectedOrder.subCity}, {selectedOrder.city}
              </p>
              <p>
                <strong>Landmark:</strong> {selectedOrder.landmark}
              </p>
              {selectedOrder.riderNotes ? (
                <p>
                  <strong>Rider Note:</strong> {selectedOrder.riderNotes}
                </p>
              ) : null}
            </div>

            <div className="divide-y divide-border rounded-xl border border-border p-4">
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <p className="font-bold text-foreground">{item.productName}</p>
                    <p className="text-muted-foreground">
                      {item.colorwayName} • EU {item.size} × {item.quantity}
                    </p>
                  </div>
                  <span className="font-display font-bold text-primary">
                    {formatETB(item.unitPriceETB * item.quantity)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-3 font-display text-base font-extrabold">
                <span>Total</span>
                <span className="text-cta">{formatETB(selectedOrder.totalETB)}</span>
              </div>
            </div>

            {/* Verify Payment Reference */}
            <div className="space-y-3 rounded-xl bg-surface-container/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block font-label text-xs font-bold text-primary">
                  Telebirr / CBE / Bank Verification Reference
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedOrder.receiptStatus ? (
                    <Badge variant={getReceiptBadgeVariant(selectedOrder.receiptStatus)}>
                      Receipt: {selectedOrder.receiptStatus}
                    </Badge>
                  ) : null}
                  <Badge variant={getPaymentBadgeVariant(selectedOrder.paymentStatus)}>
                    {selectedOrder.paymentStatus.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
              {selectedOrder.latestReceiptId ||
              selectedOrder.officialReceiptUrl ||
              selectedOrder.paymentReference ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {selectedOrder.paymentMethod.toUpperCase()} Receipt Verification Links
                    </p>
                    <p className="text-muted-foreground">
                      Open the official provider receipt page or inspect the uploaded customer file.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <OpenOfficialReceiptButton
                      provider={selectedOrder.paymentMethod}
                      officialReceiptUrl={selectedOrder.officialReceiptUrl}
                      cbeReceiptToken={selectedOrder.cbeReceiptToken}
                      transactionReference={selectedOrder.paymentReference}
                      reason={selectedOrder.officialReceiptReason}
                      label="Open Official Receipt"
                      variant="cta"
                      size="sm"
                    />
                    {selectedOrder.latestReceiptId ? (
                      <OpenReceiptButton
                        receiptId={selectedOrder.latestReceiptId}
                        label="View Uploaded Receipt"
                        variant="outline"
                        size="sm"
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
              {isPaymentSettledStatus(selectedOrder.paymentStatus) ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Verified Reference:{" "}
                    <strong className="font-mono text-foreground">
                      {selectedOrder.paymentReference || "Verified"}
                    </strong>
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/payments?search=${encodeURIComponent(selectedOrder.id)}`}>
                      <ShieldCheck className="size-3.5" /> View Audit Log
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={refInput}
                      onChange={(e) => setRefInput(e.target.value)}
                      placeholder="Enter TX reference (e.g. FT2611...)"
                    />
                    <Button
                      type="button"
                      onClick={async () => {
                        try {
                          await storeService.verifyOrderPayment(
                            selectedOrder.id,
                            refInput || "MANUAL-VERIFIED",
                            "Paid",
                          );
                          refetch();
                          addToast({
                            title: "Payment Marked Verified",
                            description: `Order #${selectedOrder.id} payment confirmed.`,
                            variant: "success",
                          });
                          setSelectedOrder(null);
                        } catch (err) {
                          addToast({
                            title: "Verification Update Failed",
                            description:
                              err instanceof Error ? err.message : "Could not verify payment.",
                            variant: "error",
                          });
                        }
                      }}
                    >
                      <CheckCircle2 className="size-4" /> Mark Paid
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Need to inspect payment verification logs or leave an audit reason?{" "}
                    <Link
                      href={`/admin/payments?search=${encodeURIComponent(selectedOrder.id)}`}
                      className="font-semibold text-primary underline"
                    >
                      Open Payment Verification Console
                    </Link>
                    .
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  try {
                    await storeService.updateOrderStatus(
                      selectedOrder.id,
                      "Shipped",
                      "Courier Henok (Bike #04)",
                    );
                    refetch();
                    addToast({ title: "Dispatched with Courier Henok", variant: "success" });
                    setSelectedOrder(null);
                  } catch (err) {
                    addToast({
                      title: "Dispatch Blocked",
                      description:
                        err instanceof Error
                          ? err.message
                          : "Verify payment before dispatching this order.",
                      variant: "error",
                    });
                  }
                }}
              >
                <Truck className="size-4" /> Dispatch Courier
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </ModalDialog>
    </div>
  );
}

