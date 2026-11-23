"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Handshake,
  Info,
  Landmark,
  Lock,
  Mail,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  User,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea } from "@/components/ui/input";
import { ADDIS_SUBCITIES, ETHIOPIAN_CITIES } from "@/data/mock-footwear";
import { useAuthStore } from "@/stores/auth.store";
import { computeCartTotals, useCartStore } from "@/stores/cart.store";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import type { OrderRecord, PaymentMethod } from "@/types/store.types";
import { formatETB, formatETBPrefix } from "@/utils/format";
import { cn } from "@/lib/utils";

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

const PAYMENT_OPTIONS: Array<{
  id: PaymentMethod;
  title: string;
  desc: string;
  icon: typeof QrCode;
  noteTitle: string;
  noteBody: string;
}> = [
  {
    id: "telebirr",
    title: "Telebirr",
    desc: "Pay via Telebirr SuperApp QR or USSD reference after order confirmation.",
    icon: QrCode,
    noteTitle: "Telebirr Payment Instructions:",
    noteBody:
      "No real card or mobile money is charged in this preview. After placing your order, you will receive your official Order ID and Telebirr merchant reference instructions.",
  },
  {
    id: "cbe_birr",
    title: "CBE Birr",
    desc: "Direct mobile transfer via Commercial Bank of Ethiopia (*847#).",
    icon: Landmark,
    noteTitle: "CBE Birr Reference:",
    noteBody:
      "Transfer using Commercial Bank of Ethiopia mobile app referencing your Order ID. Our Bole HQ team verifies receipts within minutes.",
  },
  {
    id: "bank_transfer",
    title: "Bank Transfer",
    desc: "Awash, Dashen, BoA, or Hibret bank transfer receipt verification.",
    icon: Building2,
    noteTitle: "Bank Wire Transfer:",
    noteBody:
      "Awash Bank & Dashen Bank account details will appear on your confirmation receipt so you can attach your transfer slip.",
  },
  {
    id: "cod",
    title: "Cash / POS",
    desc: "Inspect and try on your sneakers first; pay rider via cash or POS.",
    icon: Handshake,
    noteTitle: "Pay on Arrival (Zero Risk):",
    noteBody:
      "Try your shoes on with our Bole courier. Pay in Ethiopian Birr cash or domestic debit POS once satisfied with the fit.",
  },
];

function generateOrderMeta() {
  const orderNum = `AG-${Math.floor(9485 + Math.random() * 500)}`;
  const now = new Date();
  return {
    orderNum,
    customerFallbackId: `cust-${now.getTime()}`,
    nowIso: now.toISOString(),
    nowTime: now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function CheckoutView() {
  const {
    items,
    appliedPromoCode,
    deliverySpeed,
    setDeliverySpeed,
    clearCart,
  } = useCartStore();
  const { settings, createOrder, decrementStockForOrder } = useCatalogStore();
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);

  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("telebirr");
  const [countdownSeconds, setCountdownSeconds] = React.useState(892);
  const [confirmedOrder, setConfirmedOrder] = React.useState<OrderRecord | null>(null);

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
      ),
    [
      items,
      appliedPromoCode,
      deliverySpeed,
      settings.freeDeliveryThresholdETB,
      settings.standardAddisDeliveryFeeETB,
      settings.vipTwoHourDeliveryFeeETB,
    ],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: user?.name ?? "Abebe Tadesse",
      phone: user?.phone ?? "+251 911 234 567",
      email: user?.email ?? "abebe.t@gmail.com",
      city: "Addis Ababa",
      subCity: ADDIS_SUBCITIES[0],
      landmark: "Near Medhanialem Church, Morning Star Mall 3rd floor, Office 304",
      riderNotes: "Please call when you reach the gate. Security will direct you to elevator B.",
    },
  });

  const activePayment =
    PAYMENT_OPTIONS.find((p) => p.id === paymentMethod) ?? PAYMENT_OPTIONS[0]!;

  const onSubmit = (values: CheckoutFormValues) => {
    if (items.length === 0) return;

    const { orderNum, customerFallbackId, nowIso, nowTime } = generateOrderMeta();

    const newOrder: OrderRecord = {
      id: orderNum,
      customerId: user?.id ?? customerFallbackId,
      customerName: values.fullName,
      customerPhone: values.phone,
      customerEmail: values.email,
      city: values.city,
      subCity: values.subCity,
      landmark: values.landmark,
      riderNotes: values.riderNotes,
      deliverySpeed,
      deliveryFeeETB: totals.deliveryFeeETB,
      subtotalETB: totals.subtotalETB,
      discountETB: totals.discountETB,
      promoCode: totals.activePromo?.code,
      totalETB: totals.totalETB,
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "cod_due" : "pending",
      status: "confirmed",
      items: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.productId.toUpperCase(),
        colorwayName: item.colorwayName,
        size: item.size,
        quantity: item.quantity,
        unitPriceETB: item.unitPriceETB,
        image: item.image,
      })),
      trackingEvents: [
        {
          step: "Order Confirmed",
          description: `Order #${orderNum} received and pairs reserved at Bole Medhanialem Hub.`,
          timestamp: `Today, ${nowTime}`,
          completed: true,
          current: true,
        },
        {
          step:
            paymentMethod === "cod"
              ? "Cash / POS on Delivery Selected"
              : "Awaiting Payment Verification",
          description:
            paymentMethod === "cod"
              ? "Pay our courier after trying on your shoes."
              : "Complete your mobile transfer using your Order ID reference.",
          timestamp: "Pending",
          completed: false,
        },
        {
          step: "Packed & Quality Checked",
          description: "Serial verification & silk dust bag packaging.",
          timestamp: "Pending",
          completed: false,
        },
        {
          step: "Out with Addis Courier",
          description:
            deliverySpeed === "vip"
              ? "VIP 2-Hour motorcycle courier dispatch."
              : "Same-day express courier dispatch.",
          timestamp: "Pending",
          completed: false,
        },
      ],
      createdAt: nowIso,
    };

    // Deduct size+colorway stock immediately for non-accessory footwear items
    decrementStockForOrder(
      items
        .filter((i) => !i.isAccessory)
        .map((i) => ({
          productId: i.productId,
          colorwayId: i.colorwayId,
          size: i.size,
          quantity: i.quantity,
        })),
    );
    createOrder(newOrder);
    clearCart();
    setConfirmedOrder(newOrder);

    addToast({
      title: `Order #${orderNum} Confirmed!`,
      description: "Your footwear order has been placed and stock reserved.",
      variant: "success",
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Checkout Trust Banner (Exact Stitch Checkout Header) */}
      <header className="w-full bg-primary-deep px-4 py-3 text-white shadow-sm lg:px-8">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white px-2.5 py-1">
              <BrandLogo imgClassName="h-8 w-auto" />
            </div>
          </div>

          <div className="flex items-center gap-2 font-label text-xs font-semibold text-[#B0ECFF]">
            <Lock className="size-3.5" />
            <span>Encrypted &amp; 256-Bit Secure Checkout</span>
          </div>

          <div className="hidden items-center gap-4 text-xs text-[#EBF6F8]/90 md:flex">
            <span className="flex items-center gap-1.5">
              <Truck className="size-4 text-[#FFDBD0]" /> Bole Hub Active
            </span>
            <span>•</span>
            <span>Support: {settings.phone}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-8 lg:px-8">
        {confirmedOrder ? (
          /* Order Confirmation Screen */
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-xl sm:p-10">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 className="size-9" />
              </div>
              <Badge variant="success" className="mb-2">
                Order Placed &amp; Stock Reserved
              </Badge>
              <h1 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
                Thank You, {confirmedOrder.customerName}!
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your order <strong className="text-primary">#{confirmedOrder.id}</strong> has been
                logged at our Bole Medhanialem fulfillment center.
              </p>
            </div>

            <div className="space-y-4 rounded-xl bg-surface-low p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Number</span>
                <span className="font-mono font-bold text-primary">#{confirmedOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Destination</span>
                <span className="text-right font-semibold text-foreground">
                  {confirmedOrder.subCity}, {confirmedOrder.city}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Option</span>
                <span className="font-semibold text-foreground uppercase">
                  {confirmedOrder.paymentMethod.replace("_", " ")} (
                  {confirmedOrder.paymentStatus === "cod_due"
                    ? "Pay on Delivery"
                    : "Awaiting Transfer Verification"}
                  )
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <span className="font-bold text-foreground">Total Due</span>
                <span className="font-display text-xl font-extrabold text-cta">
                  {formatETB(confirmedOrder.totalETB)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild variant="cta" size="lg">
                <Link href={`/account/tracking?order=${confirmedOrder.id}`}>
                  Track Order #{confirmedOrder.id}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
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
                <ShieldCheck className="size-4" /> Authentic Stock Guarantee
              </span>
            </div>

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
                        <Input id="landmark" {...register("landmark")} className="pr-10" />
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
                            {totals.qualifiesForFreeDelivery
                              ? "FREE"
                              : formatETB(settings.standardAddisDeliveryFeeETB)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Same-Day Addis drop. Delivered before 6:00 PM today.
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
                    <Textarea id="riderNotes" rows={2} {...register("riderNotes")} />
                  </div>
                </section>

                {/* STEP 3: Payment Method */}
                <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">
                        3
                      </span>
                      <h2 className="font-display text-lg font-bold text-foreground">
                        Payment Method
                      </h2>
                    </div>
                    <span className="font-label text-xs text-muted-foreground">
                      Order Verification Flow
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {PAYMENT_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const active = paymentMethod === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPaymentMethod(opt.id)}
                          className={cn(
                            "flex flex-col justify-between rounded-xl border-[1.5px] p-4 text-left transition-all cursor-pointer",
                            active
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-surface-low/60 text-foreground hover:border-primary/60 hover:bg-surface-container/60",
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="flex items-center gap-2 font-display text-sm font-bold">
                              <Icon className="size-4" />
                              {opt.title}
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
                          <p
                            className={cn(
                              "text-xs",
                              active ? "text-[#EBF6F8]/90" : "text-muted-foreground",
                            )}
                          >
                            {opt.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-start gap-3 rounded-xl bg-surface-container/70 p-3.5 text-xs">
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p className="text-muted-foreground">
                      <strong className="text-primary">{activePayment.noteTitle}</strong>{" "}
                      {activePayment.noteBody}
                    </p>
                  </div>
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
                            src={item.image}
                            alt={item.productName}
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
                          <Tag className="size-3.5" /> Promo ({totals.activePromo?.code})
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
                      <span>Confirm &amp; Place Order</span>
                    </Button>
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      By placing this order you agree to AddisGebeya&apos;s delivery &amp; 7-day
                      exchange policy.
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
                        Bole Medhanialem Fulfillment Center
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
