"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Headphones,
  Heart,
  Lock,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CartPageSkeleton } from "@/components/shared/page-skeletons";
import { SizeGuideModal } from "@/components/shared/size-guide-modal";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useProductsQuery } from "@/hooks/use-store-queries";
import { computeCartTotals, useCartStore } from "@/stores/cart.store";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { formatETB } from "@/utils/format";
import {
  DEFAULT_FALLBACK_IMAGE,
  getCardImageUrl,
  getThumbnailImageUrl,
} from "@/utils/cloudinary";

export function CartView() {
  const {
    items,
    appliedPromoCode,
    activePromo,
    deliverySpeed,
    updateQuantity,
    removeItem,
    addItem,
    applyPromo,
    removePromo,
  } = useCartStore();
  const { data: allStoreProducts = [] } = useProductsQuery();
  const settings = useCatalogStore((s) => s.settings);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const addToast = useUiStore((s) => s.addToast);

  const [promoInput, setPromoInput] = React.useState(appliedPromoCode ?? "");
  const [promoOpen, setPromoOpen] = React.useState(true);
  const [sizeGuideOpen, setSizeGuideOpen] = React.useState(false);
  const isMounted = useIsMounted();

  const recommendedItems = React.useMemo(
    () => allStoreProducts.slice(0, 3),
    [allStoreProducts],
  );

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

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    const res = await applyPromo(promoInput);
    addToast({
      title: res.ok ? "Promo Applied" : "Promo Not Applied",
      description: res.message,
      variant: res.ok ? "success" : "warning",
    });
  };

  const getMaxStock = (productId: string, colorwayId: string, size: number) => {
    const product = allStoreProducts.find((p) => p.id === productId);
    const cw = product?.colorways.find((c) => c.id === colorwayId);
    return cw?.stockBySize[size];
  };

  if (!isMounted) {
    return <CartPageSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 lg:px-8 lg:py-10">
      {/* Header & Buyer Assurance Banner */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Express Cart</Badge>
            <h1 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
              Your Shopping Bag{" "}
              <span className="font-normal text-muted-foreground">
                ({totals.itemCount} {totals.itemCount === 1 ? "Item" : "Items"})
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-1.5 font-label text-xs font-bold text-primary">
            <ShieldCheck className="size-4" />
            <span>100% Genuine Addis Stock</span>
          </div>
        </div>

        {/* Addis Doorstep Try-On & Buyer Assurance Banner */}
        <div className="flex flex-col items-stretch justify-between gap-4 rounded-xl border border-primary/20 bg-primary-light/40 p-4 shadow-card sm:p-5 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs sm:size-10">
              <Sparkles className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-bold text-foreground sm:text-base">
                  Addis Doorstep Try-On &amp; Fit Assurance
                </span>
                <Badge variant="default" className="text-[10px]">
                  Bole Hub Service
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Order with complete confidence. Inspect and test-fit your footwear at your doorstep
                before completing payment via Telebirr or Cash. Our courier can bring an adjacent EU size for free comparison!
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 font-label text-[11px] text-primary">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="size-3.5 shrink-0 text-cta" />
                  <span>Same-Day Addis Dispatch</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="size-3.5 shrink-0 text-cta" />
                  <span>100% Genuine Addis Stock</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="size-3.5 shrink-0 text-cta" />
                  <span>7-Day Hassle-Free Size Exchange</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 min-[400px]:flex-row md:w-auto md:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSizeGuideOpen(true)}
              className="w-full gap-1.5 bg-surface text-xs font-bold min-[400px]:flex-1 md:w-auto md:flex-initial"
            >
              <Ruler className="size-3.5 shrink-0 text-primary" />
              <span>Size Guide</span>
            </Button>
            <Link
              href="/shop"
              className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-4 font-label text-xs font-bold text-primary shadow-xs transition-colors hover:bg-surface-container min-[400px]:flex-1 md:w-auto md:flex-initial"
            >
              <span>Explore Vault</span>
              <ArrowRight className="size-3.5 shrink-0" />
            </Link>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Your Shopping Bag is Empty"
          description="Discover our latest Addis Velocity runners, Bole heritage sneakers, and handcrafted Ethiopian leather shoes."
          action={
            <Button asChild variant="cta" size="lg">
              <Link href="/shop">Explore Footwear Vault</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left Column: Bag Items, Promo, Addis Dispatch Callout (7 cols) */}
          <div className="flex flex-col gap-5 lg:col-span-7">
            <div className="space-y-4">
              {items.map((item) => {
                const liveMaxStock = item.isAccessory
                  ? 5
                  : getMaxStock(item.productId, item.colorwayId, item.size);

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      {/* Thumbnail */}
                      <Link
                        href={item.isAccessory ? "/shop" : `/products/${item.productSlug}`}
                        className="group relative flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-media sm:w-36"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getThumbnailImageUrl(item.image)}
                          alt={item.productName}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                          }}
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {item.badge ? (
                          <Badge
                            variant={item.badge.toLowerCase().includes("sale") ? "cta" : "default"}
                            className="absolute top-2 left-2 text-[10px]"
                          >
                            {item.badge}
                          </Badge>
                        ) : null}
                      </Link>

                      {/* Info & Controls */}
                      <div className="flex flex-1 flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-label text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                                {item.categoryName}
                              </span>
                              <Link
                                href={item.isAccessory ? "/shop" : `/products/${item.productSlug}`}
                              >
                                <h2 className="font-display text-base sm:text-lg font-bold text-foreground hover:text-primary">
                                  {item.productName}
                                </h2>
                              </Link>
                            </div>
                            <div className="shrink-0 text-right">
                              {item.compareAtPriceETB ? (
                                <span className="block text-xs text-muted-foreground line-through">
                                  {formatETB(item.compareAtPriceETB * item.quantity)}
                                </span>
                              ) : null}
                              <span className="font-display text-base font-extrabold text-primary">
                                {formatETB(item.unitPriceETB * item.quantity)}
                              </span>
                            </div>
                          </div>

                          {/* Spec Badges */}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5 rounded bg-surface-container px-2 py-0.5 font-medium text-foreground">
                              <span
                                className="inline-block size-2.5 rounded-full border border-border"
                                style={{ backgroundColor: item.colorHex }}
                              />
                              {item.colorwayName}
                            </span>
                            {!item.isAccessory ? (
                              <span className="rounded bg-surface-container px-2 py-0.5 font-label font-bold text-foreground">
                                Size: EU {item.size}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1 font-label text-[11px] font-bold text-primary">
                              <Zap className="size-3 text-cta" />
                              {liveMaxStock !== undefined
                                ? `${liveMaxStock} pairs in Bole Hub`
                                : "In Stock (Bole Hub)"}
                            </span>
                          </div>
                        </div>

                        {/* Stepper & Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
                          <div className="inline-flex items-center rounded-full border border-border bg-surface-low p-1">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() => updateQuantity(item.id, item.quantity - 1, liveMaxStock)}
                              className="flex size-7 items-center justify-center rounded-full bg-surface text-foreground hover:bg-surface-container cursor-pointer"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-8 text-center font-display text-sm font-bold text-foreground">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() => updateQuantity(item.id, item.quantity + 1, liveMaxStock)}
                              className="flex size-7 items-center justify-center rounded-full bg-surface text-foreground hover:bg-surface-container cursor-pointer"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-4">
                            {!item.isAccessory ? (
                              <button
                                type="button"
                                onClick={() => {
                                  toggleWishlist(item.productId);
                                  removeItem(item.id);
                                  addToast({
                                    title: "Moved to Wishlist",
                                    description: `${item.productName} saved for later.`,
                                  });
                                }}
                                className="inline-flex items-center gap-1 font-label text-xs font-semibold text-muted-foreground hover:text-primary cursor-pointer"
                              >
                                <Heart className="size-3.5" /> Move to Wishlist
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                removeItem(item.id);
                                addToast({
                                  title: "Removed from Bag",
                                  description: `${item.productName} was removed.`,
                                });
                              }}
                              className="inline-flex items-center gap-1 font-label text-xs font-semibold text-muted-foreground hover:text-destructive cursor-pointer"
                            >
                              <Trash2 className="size-3.5" /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Promo Code Accordion */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <button
                type="button"
                onClick={() => setPromoOpen((o) => !o)}
                className="flex w-full items-center justify-between text-left cursor-pointer"
              >
                <span className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <Tag className="size-4 text-primary" />
                  Have a promo voucher or Addis VIP code?
                </span>
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${promoOpen ? "rotate-180" : ""}`}
                />
              </button>

              {promoOpen ? (
                <div className="mt-4 space-y-3">
                  <form onSubmit={handleApplyPromo} className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      placeholder="Try ADDISRUN, WELCOME10, or VIP15..."
                      className="h-11 flex-1 rounded-full border border-border bg-surface-low px-4 font-label text-sm font-bold tracking-wider text-foreground uppercase focus:border-primary focus:outline-none"
                    />
                    <Button type="submit" className="h-11 shrink-0 px-6">
                      Apply Code
                    </Button>
                  </form>

                  {activePromo ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-light px-3.5 py-2 text-xs text-primary">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="size-4 shrink-0 text-cta" />
                        <span>
                          Coupon <strong>{activePromo.code}</strong> applied:{" "}
                          {activePromo.description} (-{formatETB(totals.discountETB)})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          removePromo();
                          setPromoInput("");
                        }}
                        className="shrink-0 font-bold text-muted-foreground underline hover:text-destructive cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Direct Dispatch Callout */}
            <div className="flex items-start gap-3.5 rounded-xl border border-border bg-surface-container/60 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <MapPin className="size-5" />
              </div>
              <div>
                <h4 className="font-label text-xs font-bold text-primary uppercase">
                  Direct Dispatch from Addis Ababa Hubs
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Orders placed before 2:00 PM are dispatched on the same afternoon via AddisGebeya
                  direct courier to Bole, Kazanchis, Piassa, Sarbet, and surrounding sub-cities.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Order Summary (5 cols) */}
          <aside className="space-y-4 lg:sticky lg:top-28 lg:col-span-5">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-7">
              <h3 className="border-b border-border pb-3 font-display text-lg font-bold text-foreground">
                Order Summary
              </h3>

              <div className="space-y-3 py-4 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Items Subtotal</span>
                  <span className="font-display font-bold text-foreground">
                    {formatETB(totals.subtotalETB)}
                  </span>
                </div>

                {totals.discountETB > 0 ? (
                  <div className="flex items-center justify-between font-semibold text-cta">
                    <span className="flex items-center gap-1.5">
                      Promotional Discount
                      <Badge variant="cta" className="text-[10px]">
                        {activePromo?.code}
                      </Badge>
                    </span>
                    <span>-{formatETB(totals.discountETB)}</span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <span>Estimated Delivery Fee</span>
                  <span className="font-label text-xs font-bold text-cta">
                    {totals.deliveryFeeETB === 0
                      ? "FREE"
                      : formatETB(totals.deliveryFeeETB)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Import Customs &amp; Duty</span>
                  <span className="text-xs text-muted-foreground">0 ETB (Local Stock)</span>
                </div>
              </div>

              {/* Total Highlight */}
              <div className="mb-6 rounded-xl bg-surface-low p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-base font-bold text-foreground">
                    Total Amount
                  </span>
                  <span className="font-display text-2xl sm:text-3xl font-extrabold text-primary">
                    {formatETB(totals.totalETB)}
                  </span>
                </div>
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  Inclusive of Ethiopian Value Added Tax (15% VAT)
                </p>
              </div>

              {/* Proceed to Checkout CTA */}
              <div className="space-y-2">
                <Link
                  href="/checkout"
                  className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-cta px-6 font-label text-sm font-bold tracking-wider uppercase text-cta-foreground shadow-md transition-all hover:-translate-y-0.5 hover:bg-cta-hover"
                >
                  <Lock className="size-4" />
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="size-4" />
                </Link>
                <p className="text-center font-label text-[11px] text-muted-foreground">
                  Instant checkout or pay via Telebirr / Cash at doorstep
                </p>
              </div>

              {/* Local Payment Providers */}
              <div className="mt-6 space-y-2 border-t border-border pt-5">
                <span className="block text-center font-label text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Seamless Local Payment Options
                </span>
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  {[
                    { title: "telebirr", sub: "Mobile Pay" },
                    { title: "CBE Birr", sub: "Commercial" },
                    { title: "Awash", sub: "Bank Pay" },
                    { title: "COD", sub: "Door Cash" },
                  ].map((p) => (
                    <div key={p.title} className="rounded-lg bg-surface-low px-1 py-2">
                      <span className="block font-display text-[11px] font-extrabold text-primary">
                        {p.title}
                      </span>
                      <span className="block font-label text-[9px] text-muted-foreground">
                        {p.sub}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust Badges */}
              <div className="mt-5 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>100% Guaranteed Authentic Global Footwear</span>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw className="size-4 text-primary" />
                  <span>Hassle- 7-Day Size &amp; Model Exchange</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="size-4 text-primary" />
                  <span>Inspect &amp; Try On Before Payment Option</span>
                </div>
              </div>
            </div>

            {/* Help Mini Callout */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-low p-4">
              <div className="flex items-center gap-3">
                <Headphones className="size-6 text-primary" />
                <div>
                  <p className="font-label text-xs font-bold text-foreground">
                    Need Sizing Guidance?
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Chat live with our Addis shoe specialists
                  </p>
                </div>
              </div>
              <Link
                href="/contact"
                className="rounded-full bg-surface px-3.5 py-1.5 font-label text-xs font-bold text-primary shadow-xs hover:bg-surface-container"
              >
                Chat Now
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Complete Your Footwear Care Upsell Grid */}
      <section className="mt-16 border-t border-border pt-12">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <span className="font-label text-xs font-bold tracking-widest text-cta uppercase">
              Frequently Bundled
            </span>
            <h3 className="mt-1 font-display text-2xl font-bold text-foreground">
              Complete Your Footwear Care
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Quick-add essentials to protect your shoes and maximize comfort.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {recommendedItems.map((prod) => (
            <div
              key={prod.id}
              className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-card transition-all hover:shadow-card-hover"
            >
              <div className="space-y-3">
                <div className="relative h-44 w-full overflow-hidden rounded-lg bg-surface-low">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getCardImageUrl(prod.colorways[0]?.images[0])}
                    alt={prod.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                    }}
                    className="size-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                  />
                  {prod.badges[0] ? (
                    <Badge variant="secondary" className="absolute top-2.5 right-2.5">
                      {prod.badges[0]}
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <span className="font-label text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {prod.categoryName}
                  </span>
                  <h4 className="font-display text-base font-bold text-foreground">{prod.name}</h4>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{prod.tagline}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between pt-2">
                <span className="font-display text-base font-extrabold text-primary">
                  {formatETB(prod.priceETB)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const cw = prod.colorways[0];
                    if (cw) {
                      addItem(prod, cw.id, 42, 1);
                      addToast({
                        title: "Added to Bag",
                        description: `${prod.name} (EU 42) added to your shopping bag.`,
                        variant: "success",
                      });
                    }
                  }}
                >
                  <Plus className="size-3.5" /> Quick Add
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sizing Guidance Modal */}
      <SizeGuideModal open={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
    </div>
  );
}

