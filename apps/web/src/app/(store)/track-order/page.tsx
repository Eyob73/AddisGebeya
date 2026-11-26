"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { OrderTrackingPageSkeleton } from "@/components/shared/page-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPaymentBadgeVariant,
  isPaymentSettledStatus,
} from "@/features/payment/payment-verification-panel";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { storeService } from "@/services/store.service";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";
import { formatETB } from "@/utils/format";

function TrackOrderInner() {
  const isMounted = useIsMounted();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const queryOrder = searchParams.get("order") ?? "";
  const queryEmail = searchParams.get("email") ?? "";

  const [orderNumberInput, setOrderNumberInput] = React.useState(queryOrder);
  const [emailInput, setEmailInput] = React.useState(queryEmail);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [submittedLookup, setSubmittedLookup] = React.useState<{
    orderNumber: string;
    email: string;
  } | null>(() =>
    queryOrder && queryEmail
      ? { orderNumber: queryOrder.trim(), email: queryEmail.trim() }
      : null,
  );

  const activeLookup = submittedLookup;

  const {
    data: order = null,
    error: queryError,
    isFetching: isSearching,
  } = useQuery({
    queryKey: ["guest-track-order", activeLookup?.orderNumber, activeLookup?.email],
    queryFn: () =>
      storeService.trackGuestOrder(activeLookup!.orderNumber, activeLookup!.email),
    enabled: Boolean(activeLookup?.orderNumber && activeLookup?.email),
    retry: false,
  });

  const lookupError =
    validationError ??
    (queryError
      ? queryError instanceof Error
        ? queryError.message
        : "No matching order found for that order number and email address."
      : null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOrder = orderNumberInput.trim();
    const cleanEmail = emailInput.trim();
    if (!cleanOrder || !cleanEmail) {
      setValidationError("Enter both your order number (e.g. AG-9482) and email address.");
      return;
    }
    setValidationError(null);
    setSubmittedLookup({ orderNumber: cleanOrder, email: cleanEmail });
  };

  if (!isMounted) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
        <OrderTrackingPageSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <span className="font-label text-xs font-bold tracking-widest text-primary uppercase">
            AddisGebeya Fulfillment
          </span>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Track Your Order
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the order number and email used at checkout to check payment verification and
            Addis Ababa courier progress.
          </p>
        </div>

        {isAuthenticated ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/account/orders">
              <Package className="size-4" /> My Order History
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Lookup Form */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-5">
            <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
            <Input
              value={orderNumberInput}
              onChange={(e) => setOrderNumberInput(e.target.value)}
              placeholder="Order Reference (e.g. AG-9482)"
              aria-label="Order Number"
              className="pl-10 font-mono uppercase"
              required
            />
          </div>
          <div className="relative sm:col-span-5">
            <Mail className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Checkout Email Address"
              aria-label="Checkout Email Address"
              className="pl-10"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="cta" className="h-11 w-full" disabled={isSearching}>
              {isSearching ? <Loader2 className="size-4 animate-spin" /> : "Track"}
            </Button>
          </div>
        </form>

        {lookupError ? (
          <p role="alert" className="mt-3 text-xs font-semibold text-destructive">
            {lookupError}
          </p>
        ) : null}
      </div>

      {order ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Timeline */}
          <div className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-card xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
              <div>
                <span className="font-label text-xs font-bold text-muted-foreground uppercase">
                  Tracking Reference
                </span>
                <h2 className="font-display text-xl font-extrabold text-primary">#{order.id}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    order.status.toLowerCase() === "delivered"
                      ? "success"
                      : order.status === "PendingPayment"
                        ? "warning"
                        : order.status.toLowerCase() === "cancelled"
                          ? "destructive"
                          : "cta"
                  }
                >
                  {order.status.replace(/_/g, " ")}
                </Badge>
                <Badge variant={getPaymentBadgeVariant(order.paymentStatus)}>
                  Payment: {order.paymentStatus.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>

            <ol className="relative space-y-6 border-l-2 border-surface-container pl-6">
              {order.trackingEvents.map((ev, idx) => (
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

          {/* Dispatch Details & Items */}
          <div className="space-y-5 xl:col-span-5">
            {!isPaymentSettledStatus(order.paymentStatus) &&
            order.paymentMethod !== "cod" &&
            order.paymentStatus !== "cod_due" &&
            order.status.toLowerCase() !== "cancelled" ? (
              <div className="space-y-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 shadow-card">
                <p className="font-display text-sm font-bold text-foreground">
                  Payment Verification Pending
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Complete bank verification or upload your receipt from your checkout confirmation
                  page to dispatch Order #{order.id}.
                </p>
                <Button asChild variant="cta" size="sm" className="w-full">
                  <Link href={`/checkout?order=${encodeURIComponent(order.id)}`}>
                    <ShieldCheck className="size-4" /> Complete Payment Verification
                  </Link>
                </Button>
              </div>
            ) : null}

            <div className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
              <h3 className="font-display text-base font-bold text-foreground">Dispatch Details</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-bold text-foreground">
                      {order.subCity}, {order.city}
                    </p>
                    <p className="text-muted-foreground">{order.landmark}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Truck className="size-4 shrink-0 text-cta" />
                  <span className="font-semibold text-foreground">
                    {order.courierName ??
                      (order.waybill
                        ? `Regional Waybill #${order.waybill}`
                        : "Bole Hub Express Queue")}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="size-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">
                    Recipient Phone: {order.customerPhone}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
              <h3 className="font-display text-base font-bold text-foreground">
                Footwear in Parcel
              </h3>
              <div className="divide-y divide-border/70">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2.5">
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
                <span className="text-primary">{formatETB(order.totalETB)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
          <OrderTrackingPageSkeleton />
        </div>
      }
    >
      <TrackOrderInner />
    </Suspense>
  );
}

