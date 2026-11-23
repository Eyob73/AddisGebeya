"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Circle, MapPin, Phone, Search, ShieldCheck, Truck } from "lucide-react";
import { AccountShell } from "@/components/layout/account-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCatalogStore } from "@/stores/catalog.store";
import { formatETB } from "@/utils/format";
import { cn } from "@/lib/utils";

function OrderTrackingInner() {
  const searchParams = useSearchParams();
  const orders = useCatalogStore((s) => s.orders);
  const queryOrder = searchParams.get("order") ?? orders[0]?.id ?? "AG-9482";

  const [manualOrderId, setManualOrderId] = React.useState<string | null>(null);
  const activeOrderId = manualOrderId ?? queryOrder;
  const [lookupInput, setLookupInput] = React.useState(activeOrderId);

  const activeOrder = React.useMemo(() => {
    const normalized = activeOrderId.replace(/^#/, "").trim().toUpperCase();
    return orders.find((o) => o.id.toUpperCase() === normalized) ?? null;
  }, [orders, activeOrderId]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setManualOrderId(lookupInput);
  };

  return (
    <AccountShell
      title="Live Order Tracking"
      subtitle="Enter your AddisGebeya order ID to inspect real-time Bole hub packaging and courier dispatch status."
    >
      <div className="space-y-6">
        {/* Lookup Bar */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <form onSubmit={handleLookup} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
              <Input
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                placeholder="Enter Order ID (e.g. AG-9482)"
                className="pl-10 font-mono uppercase"
              />
            </div>
            <Button type="submit" variant="cta">
              Track Order
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-label font-semibold text-muted-foreground">Quick select:</span>
            {orders.slice(0, 4).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setLookupInput(o.id);
                  setManualOrderId(o.id);
                }}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-xs font-bold transition-colors cursor-pointer",
                  activeOrder?.id === o.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-low text-primary hover:bg-surface-container",
                )}
              >
                #{o.id}
              </button>
            ))}
          </div>
        </div>

        {!activeOrder ? (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="font-display text-lg font-bold text-foreground">
              Order &ldquo;{activeOrderId}&rdquo; Not Found
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Double-check your order ID (for example: AG-9482 or AG-9481) or select one above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* Timeline (7 cols) */}
            <div className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-card xl:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                <div>
                  <span className="font-label text-xs font-bold text-muted-foreground uppercase">
                    Tracking Reference
                  </span>
                  <h2 className="font-display text-xl font-extrabold text-primary">
                    #{activeOrder.id}
                  </h2>
                </div>
                <Badge variant={activeOrder.status === "delivered" ? "success" : "cta"}>
                  {activeOrder.status.replace(/_/g, " ")}
                </Badge>
              </div>

              <ol className="relative space-y-6 border-l-2 border-surface-container pl-6">
                {activeOrder.trackingEvents.map((ev, idx) => (
                  <li key={`${ev.step}-${idx}`} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[33px] top-0.5 flex size-6 items-center justify-center rounded-full border-2 bg-surface",
                        ev.current
                          ? "border-cta text-cta"
                          : ev.completed
                            ? "border-primary bg-primary text-white"
                            : "border-border text-muted-foreground",
                      )}
                    >
                      {ev.completed ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <Circle className="size-3" />
                      )}
                    </span>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3
                        className={cn(
                          "font-display text-sm font-bold",
                          ev.current ? "text-cta" : "text-foreground",
                        )}
                      >
                        {ev.step}
                      </h3>
                      <span className="font-label text-[11px] font-semibold text-muted-foreground">
                        {ev.timestamp}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {ev.description}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Dispatch Info & Items (5 cols) */}
            <div className="space-y-5 xl:col-span-5">
              <div className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
                <h3 className="font-display text-base font-bold text-foreground">
                  Dispatch Details
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-bold text-foreground">
                        {activeOrder.subCity}, {activeOrder.city}
                      </p>
                      <p className="text-muted-foreground">{activeOrder.landmark}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Truck className="size-4 shrink-0 text-cta" />
                    <span className="font-semibold text-foreground">
                      {activeOrder.courierName ??
                        (activeOrder.waybill
                          ? `Regional Waybill #${activeOrder.waybill}`
                          : "Bole Hub Express Queue")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="size-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">
                      Recipient Phone: {activeOrder.customerPhone}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
                <h3 className="font-display text-base font-bold text-foreground">
                  Footwear in Parcel
                </h3>
                <div className="divide-y divide-border/70">
                  {activeOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5">
                      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-surface-media p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image}
                          alt={item.productName}
                          className="size-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-foreground">
                          {item.productName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          EU {item.size} • Qty {item.quantity}
                        </p>
                      </div>
                      <span className="font-display text-xs font-extrabold text-primary">
                        {formatETB(item.unitPriceETB * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 font-display text-sm font-extrabold">
                  <span>Order Total</span>
                  <span className="text-primary">{formatETB(activeOrder.totalETB)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-primary-light p-4 text-xs text-primary">
                <ShieldCheck className="size-5 shrink-0" />
                <span>
                  10-minute doorstep try-on window included on all Addis Ababa courier deliveries.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AccountShell>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground">Loading order tracking...</div>}>
      <OrderTrackingInner />
    </Suspense>
  );
}
