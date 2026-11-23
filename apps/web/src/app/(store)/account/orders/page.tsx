"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, Package, Truck } from "lucide-react";
import { AccountShell } from "@/components/layout/account-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useCatalogStore } from "@/stores/catalog.store";
import type { OrderRecord } from "@/types/store.types";
import { formatDateShort, formatETB } from "@/utils/format";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { id: "all", label: "All Orders" },
  { id: "active", label: "In Progress" },
  { id: "delivered", label: "Delivered" },
];

export default function OrderHistoryPage() {
  const orders = useCatalogStore((s) => s.orders);
  const [filter, setFilter] = React.useState("all");
  const [selectedOrder, setSelectedOrder] = React.useState<OrderRecord | null>(null);

  const filtered = React.useMemo(() => {
    if (filter === "delivered") return orders.filter((o) => o.status === "delivered");
    if (filter === "active")
      return orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
    return orders;
  }, [orders, filter]);

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
              onClick={() => setFilter(tab.id)}
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
            {filtered.map((order) => (
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
                        order.status === "delivered"
                          ? "success"
                          : order.status === "out_for_delivery"
                            ? "cta"
                            : "soft"
                      }
                    >
                      {order.status.replace(/_/g, " ")}
                    </Badge>
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
                          src={item.image}
                          alt={item.productName}
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

                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
                  <span className="text-xs text-muted-foreground">
                    Destination: <strong className="text-foreground">{order.subCity}</strong> •
                    Payment:{" "}
                    <strong className="text-foreground uppercase">
                      {order.paymentMethod.replace("_", " ")}
                    </strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <Eye className="size-3.5" /> Receipt
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/account/tracking?order=${order.id}`}>
                        <Truck className="size-3.5" /> Track Order
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
    </AccountShell>
  );
}

