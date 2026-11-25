"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Handshake,
  Info,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  User,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BrandLogo } from "@/components/shared/brand-logo";
import { CheckoutPageSkeleton } from "@/components/shared/page-skeletons";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea } from "@/components/ui/input";
import { ADDIS_SUBCITIES, ETHIOPIAN_CITIES } from "@/data/mock-footwear";
import { usePaymentProvidersQuery, usePaymentStatusQuery } from "@/hooks/use-store-queries";
import { useAuthStore } from "@/stores/auth.store";
import { computeCartTotals, useCartStore } from "@/stores/cart.store";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import { storeService } from "@/services/store.service";
import type { OrderRecord, PaymentMethod } from "@/types/store.types";
import { formatETB, formatETBPrefix } from "@/utils/format";
import { cn } from "@/lib/utils";
import { DEFAULT_FALLBACK_IMAGE, getThumbnailImageUrl } from "@/utils/cloudinary";
import {
  isPaymentSettledStatus,
  PaymentVerificationPanel,
} from "@/features/payment/payment-verification-panel";

const checkoutSchema = z.object({
  fullName: z.string().min(2, "Please enter your full name"),
  phone: z
    .string()
    .min(9, "Enter a valid Ethiopian phone number (e.g., +251 911 234 567)"),
  email: z.string().email("Enter a valid email address for order confirmation"),
  city: z.string().min(2, "Select your city"),
  subCity: z.string().min(2, "Select your sub-city or area"),
  landmark: z.string().min(5, "Provide a landmark or building detail for the courier"),
  riderNotes: z.string().optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export function CheckoutView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderQueryParam = searchParams.get("order") ?? "";

  const {
    items,
    appliedPromoCode,
    activePromo,
    deliverySpeed,
    setDeliverySpeed,
    clearCart,
  } = useCartStore();
  const settings = useCatalogStore((s) => s.settings);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addToast = useUiStore((s) => s.addToast);

  const { data: liveProviders = [], isLoading: loadingProviders } = usePaymentProvidersQuery();

  const [selectedPaymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cbe");
  const paymentMethod: PaymentMethod =
    selectedPaymentMethod === "cod" ||
      liveProviders.length === 0 ||
      liveProviders.some((p) => p.id === selectedPaymentMethod)
      ? selectedPaymentMethod
      : liveProviders[0]!.id;
  const [countdownSeconds, setCountdownSeconds] = React.useState(892);
  const [confirmedOrder, setConfirmedOrder] = React.useState<OrderRecord | null>(null);
  const [copiedAccount, setCopiedAccount] = React.useState(false);
  const isMounted = useIsMounted();

  // Rehydrate order when returning or refreshing page with ?order=AG-XXXX
  React.useEffect(() => {
    if (!orderQueryParam) return;
    if (confirmedOrder?.id === orderQueryParam) return;

    storeService
      .getOrderById(orderQueryParam)
      .then((order) => {
        if (order) {
          setConfirmedOrder(order);
        }
      })
      .catch(() => { });
  }, [orderQueryParam, confirmedOrder?.id]);

  const { data: activeOrderPaymentStatus } = usePaymentStatusQuery(confirmedOrder?.id);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedCountdown = `${String(Math.floor(countdownSeconds / 60)).padStart(2, "0")}:${String(
    countdownSeconds % 60,
  ).padStart(2, "0")}`;

  const totals = React.useMemo(
    () =>
      computeCartTotals(
        items,
        appliedPromoCode,
        deliverySpeed,
        settings.freeDeliveryThresholdETB,
        settings.standardAddisDeliveryFeeETB,
        settings.vipTwoHourDeliveryFeeETB,
        activePromo,
      ),
    [
      items,
      appliedPromoCode,
      deliverySpeed,
      settings.freeDeliveryThresholdETB,
      settings.standardAddisDeliveryFeeETB,
      settings.vipTwoHourDeliveryFeeETB,
      activePromo,
    ],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: user?.name ?? "",
      phone: user?.phone ?? "+251 911 234 567",
      email: user?.email ?? "",
      city: "Addis Ababa",
      subCity: user?.subCity || ADDIS_SUBCITIES[0],
      landmark: "",
      riderNotes: "",
    },
  });

  const selectedProviderInfo = liveProviders.find((p) => p.id === paymentMethod);

  const handleCopyAccountNumber = async () => {
    if (!selectedProviderInfo?.receivingAccountNumber) return;
    try {
      await navigator.clipboard.writeText(selectedProviderInfo.receivingAccountNumber);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const onSubmit = async (values: CheckoutFormValues) => {
    if (items.length === 0) return;

    if (!isAuthenticated) {
      addToast({
        title: "Sign In Required",
        description: "Please sign in so we can link and verify your bank payment securely.",
        variant: "warning",
      });
      router.push("/login?redirect=/checkout");
      return;
    }

    try {
      const placedOrder = await storeService.createOrder({
        customerId: user?.id,
        customerName: values.fullName.trim(),
        customerPhone: values.phone.trim(),
        customerEmail: values.email.trim(),
        city: values.city,
        subCity: values.subCity,
        landmark: values.landmark.trim(),
        riderNotes: values.riderNotes?.trim() || undefined,
        deliverySpeed,
        deliveryFeeETB: totals.deliveryFeeETB,
        subtotalETB: totals.subtotalETB,
        discountETB: totals.discountETB,
        promoCode: appliedPromoCode ?? undefined,
        totalETB: totals.totalETB,
        paymentMethod,
        items: items.map((item) => ({
          productId: item.productId,
          colorwayId: item.colorwayId,
          productName: item.productName,
          sku: item.productId.toUpperCase(),
          colorwayName: item.colorwayName,
          size: item.size,
          quantity: item.quantity,
          unitPriceETB: item.unitPriceETB,
          image: item.image,
        })),
      });

      clearCart();
      setConfirmedOrder(placedOrder);
      router.replace(`/checkout?order=${encodeURIComponent(placedOrder.id)}`);

      addToast({
        title:
          paymentMethod === "cod"
            ? `Order #${placedOrder.id} Logged!`
            : `Order #${placedOrder.id} Created — Verify Payment`,
        description:
          paymentMethod === "cod"
            ? "Cash on Delivery request registered. Awaiting confirmation."
            : "Transfer to the displayed account and click Verify Payment.",
        variant: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to place order.";
      addToast({
        title: "Order Failed",
        description: message,
        variant: "error",
      });
    }
  };

  const resolvedOrderPaymentStatus =
    activeOrderPaymentStatus?.paymentStatus ?? confirmedOrder?.paymentStatus ?? "Pending";
  const resolvedOrderStatus =
    activeOrderPaymentStatus?.orderStatus ?? confirmedOrder?.status ?? "PendingPayment";
  const resolvedReceiptStatus =
    activeOrderPaymentStatus?.receiptStatus ?? confirmedOrder?.receiptStatus ?? null;
  const isConfirmedPaid = isPaymentSettledStatus(resolvedOrderPaymentStatus);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Checkout Trust Banner */}
      <header className="w-full bg-primary-deep px-4 py-3 text-white shadow-sm lg:px-8">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white px-2.5 py-1">
              <BrandLogo imgClassName="h-8 w-auto" />
            </div>
          </div>

          <div className="flex items-center gap-2 font-label text-xs font-semibold text-banner-accent">
            <Lock className="size-3.5" />
            <span>Encrypted &amp; Institution-Verified Checkout</span>
          </div>

          <div className="hidden items-center gap-4 text-xs text-banner-muted/90 md:flex">
            <span className="flex items-center gap-1.5">
              <Truck className="size-4 text-banner-warm" /> Bole Hub Active
            </span>
            <span>•</span>
            <span>Support: {settings.phone}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-8 lg:px-8">
        {!isMounted ? (
          <CheckoutPageSkeleton />
        ) : confirmedOrder ? (
          /* Order Verification & Confirmation Screen */
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl sm:p-8">
              <div className="mb-6 flex flex-col items-center text-center">
                <div
                  className={cn(
                    "mb-4 flex size-16 items-center justify-center rounded-full",
                    isConfirmedPaid
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-primary-light text-primary",
                  )}
                >
                  {isConfirmedPaid ? (
                    <CheckCircle2 className="size-9" />
                  ) : (
                    <Clock className="size-8" />
                  )}
                </div>
                <Badge
                  variant={
                    isConfirmedPaid
                      ? "success"
                      : resolvedReceiptStatus === "Rejected"
                        ? "destructive"
                        : "warning"
                  }
                  className="mb-2"
                >
                  {isConfirmedPaid
                    ? "Order Confirmed & Paid"
                    : resolvedReceiptStatus === "Pending"
                      ? `Receipt Pending Verification • Order ${resolvedOrderStatus}`
                      : resolvedReceiptStatus === "Rejected"
                        ? "Receipt Rejected — Replacement Needed"
                        : `Status: ${resolvedOrderStatus} • ${resolvedOrderPaymentStatus}`}
                </Badge>
                <h1 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
                  {isConfirmedPaid
                    ? `Payment Confirmed, ${confirmedOrder.customerName}!`
                    : `Complete Payment for Order #${confirmedOrder.id}`}
                </h1>
                <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                  {isConfirmedPaid
                    ? "Your payment has been verified and your AddisGebeya footwear order is confirmed for dispatch."
                    : resolvedReceiptStatus === "Pending"
                      ? "Your payment receipt has been received and is awaiting verification by our finance team."
                      : resolvedReceiptStatus === "Rejected"
                        ? "Your previous receipt could not be approved. Please upload or capture a clear replacement receipt below."
                        : "Your stock is reserved. Complete your bank or mobile money transfer and upload or capture your receipt below."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl bg-surface-low p-4 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Order Number</span>
                  <p className="font-mono font-bold text-primary">#{confirmedOrder.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Destination</span>
                  <p className="truncate font-semibold text-foreground">
                    {confirmedOrder.subCity}, {confirmedOrder.city}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Order Status</span>
                  <p className="font-bold text-foreground">{resolvedOrderStatus}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Due</span>
                  <p className="font-display text-base font-extrabold text-cta">
                    {formatETB(confirmedOrder.totalETB)}
                  </p>
                </div>
              </div>
            </div>

            {confirmedOrder.paymentMethod !== "cod" ? (
              <PaymentVerificationPanel
                orderNumber={confirmedOrder.id}
                initialProvider={confirmedOrder.paymentMethod}
                initialStatus={resolvedOrderPaymentStatus}
                initialReference={confirmedOrder.paymentReference}
                totalETB={confirmedOrder.totalETB}
                providers={liveProviders}
                onVerified={(res) => {
                  setConfirmedOrder((prev) =>
                    prev
                      ? {
                        ...prev,
                        paymentStatus: "Paid",
                        status: "Confirmed",
                        paymentReference: res.reference,
                      }
                      : null,
                  );
                }}
              />
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild variant="cta" size="lg">
                <Link href={`/account/tracking?order=${confirmedOrder.id}`}>
                  Track Order #{confirmedOrder.id}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/account/orders">View Order History</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/shop">Continue Shopping</Link>
              </Button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Your Bag is Empty"
            description="Add footwear pairs to your shopping bag before checking out."
            action={
              <Button asChild variant="cta">
                <Link href="/shop">Return to Footwear Vault</Link>
              </Button>
            }
          />
        ) : (
          <>
            {/* Page Heading */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <Link
                  href="/cart"
                  className="mb-2 inline-flex items-center gap-1 font-label text-xs font-bold text-primary hover:underline"
                >
                  <ArrowLeft className="size-3.5" /> Back to Shopping Bag
                </Link>
                <span className="block font-label text-xs font-bold tracking-widest text-primary uppercase">
                  Addis Ababa Express Dispatch
                </span>
                <h1 className="mt-0.5 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
                  Finalize Footwear Order
                </h1>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full bg-primary-light px-3.5 py-1.5 font-label text-xs font-bold text-primary sm:inline-flex">
                <ShieldCheck className="size-4" /> Real-Time Bank Verification
              </span>
            </div>

            {!isAuthenticated ? (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-50 px-5 py-3.5 text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-center gap-2.5">
                  <Lock className="size-4 shrink-0" />
                  <span>
                    Sign in to your AddisGebeya account to link your order and verify bank
                    transfers securely.
                  </span>
                </div>
                <Button asChild size="sm" variant="cta">
                  <Link href="/login?redirect=/checkout">Sign In to Continue</Link>
                </Button>
              </div>
            ) : null}

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10"
            >
              {/* LEFT COLUMN: 3 Checkout Steps (7 cols) */}
              <div className="space-y-6 lg:col-span-7">
                {/* STEP 1: Customer Contact */}
                <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">
                        1
                      </span>
                      <h2 className="font-display text-lg font-bold text-foreground">
                        Customer Contact
                      </h2>
                    </div>
                    <span className="font-label text-[11px] font-bold tracking-wider text-primary uppercase">
                      Required for Dispatch
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="fullName"
                        className="mb-1.5 block font-label text-xs font-bold text-muted-foreground"
                      >
                        Full Name *
                      </label>
                      <div className="relative">
                        <Input id="fullName" {...register("fullName")} className="pr-10" />
                        <User className="pointer-events-none absolute top-3 right-3.5 size-4 text-muted-foreground" />
                      </div>
                      {errors.fullName ? (
                        <p className="mt-1 text-xs text-destructive">{errors.fullName.message}</p>
                      ) : null}
                    </div>

                    <div>
                      <label
                        htmlFor="phone"
                        className="mb-1.5 block font-label text-xs font-bold text-muted-foreground"
                      >
                        Phone Number <span className="text-cta">*</span>
                      </label>
                      <div className="relative">
                        <Input id="phone" type="tel" {...register("phone")} className="pr-10" />
                        <Phone className="pointer-events-none absolute top-3 right-3.5 size-4 text-muted-foreground" />
                      </div>
                      {errors.phone ? (
                        <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Courier calls prior to physical doorstep drop.
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="mb-1.5 block font-label text-xs font-bold text-muted-foreground"
                      >
                        Email Address (Confirmation) *
                      </label>
                      <div className="relative">
                        <Input id="email" type="email" {...register("email")} className="pr-10" />
                        <Mail className="pointer-events-none absolute top-3 right-3.5 size-4 text-muted-foreground" />
                      </div>
                      {errors.email ? (
                        <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
                      ) : null}
                    </div>
                  </div>
                </section>

                {/* STEP 2: Delivery Address */}
                <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">
                        2
                      </span>
                      <h2 className="font-display text-lg font-bold text-foreground">
                        Delivery Address in Ethiopia
                      </h2>
                    </div>
                    <span className="inline-flex items-center gap-1 font-label text-[11px] font-bold text-cta">
                      <Clock className="size-3.5" /> Express Active
                    </span>
                  </div>

                  <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="city"
                        className="mb-1.5 block font-label text-xs font-bold text-muted-foreground"
                      >
                        Region / City
                      </label>
                      <select
                        id="city"
                        {...register("city")}
                        className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-foreground focus:border-primary focus:outline-none"
                      >
                        {ETHIOPIAN_CITIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="subCity"
                        className="mb-1.5 block font-label text-xs font-bold text-muted-foreground"
                      >
                        Sub-City / Area
                      </label>
                      <select
                        id="subCity"
                        {...register("subCity")}
                        className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-foreground focus:border-primary focus:outline-none"
                      >
                        {ADDIS_SUBCITIES.map((sc) => (
                          <option key={sc} value={sc}>
                            {sc}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="landmark"
                        className="mb-1.5 block font-label text-xs font-bold text-muted-foreground"
                      >
                        Specific Landmark / Building Details *
                      </label>
                      <div className="relative">
                        <Input
                          id="landmark"
                          placeholder="e.g., Near Medhanialem Church, Morning Star Mall 3rd floor"
                          {...register("landmark")}
                          className="pr-10"
                        />
                        <MapPin className="pointer-events-none absolute top-3 right-3.5 size-4 text-muted-foreground" />
                      </div>
                      {errors.landmark ? (
                        <p className="mt-1 text-xs text-destructive">{errors.landmark.message}</p>
                      ) : null}
                    </div>
                  </div>

                  {/* Delivery Speed Radio Cards */}
                  <span className="mb-2.5 block font-label text-xs font-bold text-foreground">
                    Select Delivery Speed:
                  </span>
                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-4 transition-all",
                        deliverySpeed === "standard"
                          ? "border-primary bg-primary-light/70"
                          : "border-border bg-surface-low/50 hover:bg-surface-container/50",
                      )}
                    >
                      <input
                        type="radio"
                        name="deliverySpeed"
                        checked={deliverySpeed === "standard"}
                        onChange={() => setDeliverySpeed("standard")}
                        className="mt-1 size-4 accent-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-bold text-foreground">
                            Standard Express
                          </span>
                          <span className="font-label text-xs font-extrabold text-cta">
                            {totals.isFreeDelivery
                              ? "FREE"
                              : formatETB(settings.standardAddisDeliveryFeeETB)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Same-Day Addis drop. Delivered after payment confirmation.
                        </p>
                      </div>
                    </label>

                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-4 transition-all",
                        deliverySpeed === "vip"
                          ? "border-primary bg-primary-light/70"
                          : "border-border bg-surface-low/50 hover:bg-surface-container/50",
                      )}
                    >
                      <input
                        type="radio"
                        name="deliverySpeed"
                        checked={deliverySpeed === "vip"}
                        onChange={() => setDeliverySpeed("vip")}
                        className="mt-1 size-4 accent-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-bold text-foreground">
                            VIP 2-Hour Courier
                          </span>
                          <span className="font-label text-xs font-extrabold text-primary">
                            {formatETB(settings.vipTwoHourDeliveryFeeETB)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Doorstep size try-on kit + priority direct motorcycle runner.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label
                      htmlFor="riderNotes"
                      className="mb-1.5 block font-label text-xs font-bold text-muted-foreground"
                    >
                      Special Instructions for Rider
                    </label>
                    <Textarea
                      id="riderNotes"
                      rows={2}
                      placeholder="Gate code, call upon arrival, etc."
                      {...register("riderNotes")}
                    />
                  </div>
                </section>

                {/* STEP 3: Dynamic Ethiopian Payment Providers */}
                <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">
                        3
                      </span>
                      <h2 className="font-display text-lg font-bold text-foreground">
                        Ethiopian Bank &amp; Mobile Money
                      </h2>
                    </div>
                    <Badge variant="soft">Instant Verification</Badge>
                  </div>

                  {loadingProviders ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="h-20 animate-pulse rounded-xl bg-surface-low"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                      {liveProviders.map((provider) => {
                        const active = paymentMethod === provider.id;
                        return (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => setPaymentMethod(provider.id)}
                            className={cn(
                              "flex flex-col justify-between rounded-xl border-[1.5px] p-3.5 text-left transition-all cursor-pointer",
                              active
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-surface-low/60 text-foreground hover:border-primary/60 hover:bg-surface-container/60",
                            )}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span
                                className="flex size-7 shrink-0 items-center justify-center rounded-lg font-mono text-[10px] font-extrabold text-white"
                                style={{ backgroundColor: provider.color }}
                              >
                                {provider.initials}
                              </span>
                              <span
                                className={cn(
                                  "flex size-5 items-center justify-center rounded-full border",
                                  active
                                    ? "border-white bg-white text-primary"
                                    : "border-border bg-surface",
                                )}
                              >
                                {active ? <Check className="size-3" /> : null}
                              </span>
                            </div>
                            <div>
                              <p className="font-display text-xs font-bold leading-snug">
                                {provider.name}
                              </p>
                              <p
                                className={cn(
                                  "mt-0.5 text-[10px]",
                                  active
                                    ? "text-primary-foreground/85"
                                    : "text-muted-foreground",
                                )}
                              >
                                {provider.healthStatus === "reachable"
                                  ? "Live Auto-Verify"
                                  : provider.healthStatus === "geo-blocked"
                                    ? "May require review"
                                    : provider.type.toUpperCase()}
                              </p>
                            </div>
                          </button>
                        );
                      })}

                      {settings.paymentMethods.cod ? (
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("cod")}
                          className={cn(
                            "flex flex-col justify-between rounded-xl border-[1.5px] p-3.5 text-left transition-all cursor-pointer",
                            paymentMethod === "cod"
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-surface-low/60 text-foreground hover:border-primary/60 hover:bg-surface-container/60",
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-slate-700 text-white">
                              <Handshake className="size-4" />
                            </span>
                            <span
                              className={cn(
                                "flex size-5 items-center justify-center rounded-full border",
                                paymentMethod === "cod"
                                  ? "border-white bg-white text-primary"
                                  : "border-border bg-surface",
                              )}
                            >
                              {paymentMethod === "cod" ? <Check className="size-3" /> : null}
                            </span>
                          </div>
                          <div>
                            <p className="font-display text-xs font-bold">Cash / POS on Delivery</p>
                            <p
                              className={cn(
                                "mt-0.5 text-[10px]",
                                paymentMethod === "cod"
                                  ? "text-primary-foreground/85"
                                  : "text-muted-foreground",
                              )}
                            >
                              Pay at door after inspection
                            </p>
                          </div>
                        </button>
                      ) : null}
                    </div>
                  )}

                  {/* Receiving Account Preview Before Placing Order */}
                  {selectedProviderInfo ? (
                    <div className="mt-4 space-y-2.5 rounded-xl bg-surface-container/70 p-4 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-label font-bold text-primary">
                          <Info className="size-4 shrink-0" />
                          Transfer Destination: {selectedProviderInfo.name}
                        </span>
                        <span className="font-mono font-extrabold text-cta">
                          {formatETB(totals.totalETB)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3">
                        <div>
                          <span className="text-[11px] text-muted-foreground">Account Name:</span>
                          <p className="font-bold text-foreground">
                            {selectedProviderInfo.receivingAccountName}
                          </p>
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            Account Number:
                          </span>
                          <p className="font-mono text-sm font-extrabold text-primary">
                            {selectedProviderInfo.receivingAccountNumber}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleCopyAccountNumber}
                        >
                          {copiedAccount ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                          <span>{copiedAccount ? "Copied" : "Copy Account"}</span>
                        </Button>
                      </div>

                      <p className="text-muted-foreground leading-relaxed">
                        {selectedProviderInfo.instructions ||
                          "After placing your order, submit your transaction reference or receipt link in the next step to confirm your order immediately."}
                      </p>
                    </div>
                  ) : paymentMethod === "cod" ? (
                    <div className="mt-4 flex items-start gap-3 rounded-xl bg-surface-container/70 p-3.5 text-xs">
                      <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                      <p className="text-muted-foreground">
                        <strong className="text-primary">Cash / POS on Delivery:</strong> Orders remain
                        in <code className="font-mono">PendingPayment</code> until collected by courier
                        or confirmed via admin review.
                      </p>
                    </div>
                  ) : null}
                </section>
              </div>

              {/* RIGHT COLUMN: Order Review Sidebar (5 cols) */}
              <aside className="space-y-5 lg:sticky lg:top-8 lg:col-span-5">
                <div className="rounded-xl border border-border bg-surface p-6 shadow-md">
                  <div className="mb-4 flex items-center justify-between border-b border-border pb-3.5">
                    <h3 className="font-display text-lg font-bold text-foreground">
                      Order Summary
                    </h3>
                    <Badge variant="soft">
                      {totals.itemCount} {totals.itemCount === 1 ? "Pair" : "Pairs"}
                    </Badge>
                  </div>

                  <div className="divide-y divide-border/70">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3.5 py-3">
                        <div className="flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-media p-1.5">
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
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="truncate font-display text-sm font-bold text-foreground">
                                {item.productName}
                              </h4>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.colorwayName}
                                {!item.isAccessory ? ` • EU ${item.size}` : ""} × {item.quantity}
                              </p>
                            </div>
                            <span className="font-display text-sm font-bold text-foreground whitespace-nowrap">
                              {formatETBPrefix(item.unitPriceETB * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cost Breakdown */}
                  <div className="space-y-2.5 border-t border-border pt-4 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Items Subtotal</span>
                      <span className="font-label font-bold text-foreground">
                        {formatETB(totals.subtotalETB)}
                      </span>
                    </div>
                    {totals.discountETB > 0 ? (
                      <div className="flex justify-between font-semibold text-cta">
                        <span className="flex items-center gap-1">
                          <Tag className="size-3.5" /> Promo ({activePromo?.code})
                        </span>
                        <span>-{formatETB(totals.discountETB)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between">
                      <span>Delivery Fee</span>
                      <span className="font-label font-bold text-primary">
                        {totals.deliveryFeeETB === 0 ? "FREE" : formatETB(totals.deliveryFeeETB)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-border pt-3">
                      <span className="font-display text-base font-extrabold text-foreground">
                        Total Amount
                      </span>
                      <div className="text-right">
                        <span className="font-display text-2xl font-black text-cta">
                          {formatETB(totals.totalETB)}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          Includes 15% Ethiopian VAT
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Button
                      type="submit"
                      variant="cta"
                      size="lg"
                      disabled={isSubmitting}
                      className="h-13 w-full text-sm uppercase tracking-wider"
                    >
                      <ShoppingBag className="size-4" />
                      <span>
                        {paymentMethod === "cod"
                          ? "Place Order (Cash on Delivery)"
                          : "Place Order"}
                      </span>
                    </Button>
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      Orders remain <strong className="text-foreground">PendingPayment</strong> until
                      transaction verification succeeds.
                    </p>
                  </div>
                </div>

                {/* Zero Risk Fit Assurance Card */}
                <div className="rounded-xl border border-border bg-surface-container/60 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <ShieldCheck className="size-5" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-bold text-primary">
                        The Addis &ldquo;Zero Risk&rdquo; Fit Guarantee
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Our delivery partner waits up to 10 minutes while you inspect your shoes
                        and test the size. If the fit isn&apos;t right, hand them back for a prompt
                        size swap.
                      </p>
                      <div className="mt-2.5 flex items-center gap-3 font-label text-[11px] font-bold text-primary">
                        <span className="flex items-center gap-1">
                          <Check className="size-3.5" /> 100% Genuine Box
                        </span>
                        <span className="flex items-center gap-1">
                          <Check className="size-3.5" /> Free Exchange
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reservation Timer Strip */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface-low p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="size-2.5 animate-pulse rounded-full bg-cta" />
                    <div className="text-xs">
                      <span className="block font-bold text-foreground">
                        Bole Fulfillment Center
                      </span>
                      <span className="text-muted-foreground">
                        Inventory reserved for checkout
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-extrabold text-primary">
                    {formattedCountdown}
                  </span>
                </div>
              </aside>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
