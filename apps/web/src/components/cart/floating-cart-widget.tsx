"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { computeCartTotals, useCartStore } from "@/stores/cart.store";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import { DEFAULT_FALLBACK_IMAGE, getThumbnailImageUrl } from "@/utils/cloudinary";
import { formatETB } from "@/utils/format";

export function FloatingCartWidget() {
  const isMounted = useIsMounted();
  const pathname = usePathname();
  const { items, appliedPromoCode, activePromo, deliverySpeed, updateQuantity, removeItem, clearCart } =
    useCartStore();
  const settings = useCatalogStore((s) => s.settings);
  const { isCartOpen, openCart, closeCart } = useUiStore();

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

  React.useEffect(() => {
    if (!isCartOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCart();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCartOpen, closeCart]);

  const hiddenRoute =
    pathname === "/cart" || pathname === "/checkout" || pathname.startsWith("/admin");

  // Hide the cart open button completely when the cart is empty or already on cart/checkout pages
  if (!isMounted || totals.itemCount === 0 || hiddenRoute) {
    return null;
  }

  return (
    <>
      {!isCartOpen ? (
        <div className="fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <button
            type="button"
            onClick={openCart}
            data-testid="open-cart-button"
            aria-label={`Open cart with ${totals.itemCount} ${totals.itemCount === 1 ? "item" : "items"}`}
            className="group flex items-center gap-3 rounded-full bg-cta px-4 py-3 text-cta-foreground shadow-xl ring-2 ring-white/80 transition-all hover:-translate-y-0.5 hover:bg-cta-hover active:scale-95 cursor-pointer dark:ring-slate-900"
          >
            <span className="relative flex size-8 items-center justify-center rounded-full bg-white/20">
              <ShoppingBag className="size-4.5" aria-hidden="true" />
              <span className="absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full bg-primary font-label text-[10px] font-extrabold text-primary-foreground leading-none shadow-xs">
                {totals.itemCount}
              </span>
            </span>

            <div className="flex flex-col text-left leading-tight">
              <span className="font-display text-xs font-extrabold uppercase tracking-wider">
                Open Cart
              </span>
              <span className="font-label text-[11px] font-semibold opacity-90">
                {totals.itemCount} {totals.itemCount === 1 ? "item" : "items"} •{" "}
                {formatETB(totals.subtotalETB)}
              </span>
            </div>

            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </div>
      ) : (
        <div className="fixed inset-0 z-[70] flex justify-end">
          {/* Backdrop */}
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart drawer"
            className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity"
          />

          {/* Slide-Over Cart Drawer */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Shopping Bag"
            data-testid="cart-drawer"
            className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl animate-in slide-in-from-right duration-200"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShoppingBag className="size-4.5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-extrabold text-foreground">
                      Shopping Bag
                    </h2>
                    <Badge variant="cta">
                      {totals.itemCount} {totals.itemCount === 1 ? "pair" : "pairs"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Ready for Addis Ababa express dispatch
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeCart}
                aria-label="Close shopping bag"
                className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-surface-low hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 divide-y divide-border/70 overflow-y-auto px-5">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3.5 py-4">
                  <Link
                    href={item.isAccessory ? "/cart" : `/products/${item.productSlug}`}
                    onClick={closeCart}
                    className="flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-media p-1.5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getThumbnailImageUrl(item.image)}
                      alt={item.productName}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                      }}
                      className="size-full object-contain"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={item.isAccessory ? "/cart" : `/products/${item.productSlug}`}
                        onClick={closeCart}
                        className="truncate font-display text-sm font-bold text-foreground hover:text-primary"
                      >
                        {item.productName}
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (items.length === 1) closeCart();
                          removeItem(item.id);
                        }}
                        aria-label={`Remove ${item.productName}`}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive cursor-pointer dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.colorwayName}
                      {!item.isAccessory ? ` • EU ${item.size}` : ""}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-full border border-border bg-surface-low p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.quantity <= 1 && items.length === 1) {
                              closeCart();
                            }
                            updateQuantity(item.id, item.quantity - 1);
                          }}
                          aria-label={`Decrease quantity of ${item.productName}`}
                          className="flex size-6 items-center justify-center rounded-full text-foreground hover:bg-surface cursor-pointer"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="min-w-6 text-center font-mono text-xs font-bold text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.productName}`}
                          className="flex size-6 items-center justify-center rounded-full text-foreground hover:bg-surface cursor-pointer"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>

                      <span className="font-display text-sm font-extrabold text-primary">
                        {formatETB(item.unitPriceETB * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-border bg-surface-low/60 px-5 py-4">
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-display text-base font-extrabold text-foreground">
                    {formatETB(totals.subtotalETB)}
                  </span>
                </div>
                {totals.discountETB > 0 ? (
                  <div className="flex items-center justify-between font-semibold text-cta">
                    <span>Promo ({appliedPromoCode})</span>
                    <span>-{formatETB(totals.discountETB)}</span>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Button asChild variant="cta" size="lg" className="w-full" onClick={closeCart}>
                  <Link href="/checkout">
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-surface"
                    onClick={closeCart}
                  >
                    <Link href="/cart">View Full Cart</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      closeCart();
                      clearCart();
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Clear Bag
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

