"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { ColorSelector } from "@/components/shared/color-selector";
import { PriceDisplay } from "@/components/shared/price-display";
import { Rating } from "@/components/shared/rating";
import { WishlistButton } from "@/components/shared/wishlist-button";
import { Badge } from "@/components/ui/badge";
import { getColorwayTotalStock } from "@/data/mock-footwear";
import { useCartStore } from "@/stores/cart.store";
import { useUiStore } from "@/stores/ui.store";
import type { ShoeProduct } from "@/types/store.types";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: ShoeProduct;
  variant?: "home" | "catalog";
  className?: string;
}

export function ProductCard({ product, variant = "catalog", className }: ProductCardProps) {
  const [activeColorwayId, setActiveColorwayId] = React.useState(product.colorways[0]?.id ?? "");
  const activeColorway =
    product.colorways.find((c) => c.id === activeColorwayId) ?? product.colorways[0];

  const availableSizes = React.useMemo(() => {
    if (!activeColorway) return [];
    return Object.entries(activeColorway.stockBySize)
      .filter(([, qty]) => qty > 0)
      .map(([size]) => Number(size))
      .sort((a, b) => a - b);
  }, [activeColorway]);

  const [selectedQuickSize, setSelectedQuickSize] = React.useState<number | null>(null);
  const quickSize =
    selectedQuickSize !== null && availableSizes.includes(selectedQuickSize)
      ? selectedQuickSize
      : availableSizes.includes(42)
        ? 42
        : (availableSizes[0] ?? null);

  const addItem = useCartStore((s) => s.addItem);
  const addToast = useUiStore((s) => s.addToast);

  const totalColorStock = activeColorway ? getColorwayTotalStock(activeColorway.stockBySize) : 0;
  const isSoldOut = totalColorStock <= 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!activeColorway || quickSize === null || isSoldOut) {
      addToast({
        title: "Size Unavailable",
        description: "This colorway is currently out of stock.",
        variant: "warning",
      });
      return;
    }

    const result = addItem(
      product,
      activeColorway.id,
      quickSize,
      1,
      activeColorway.stockBySize[quickSize] ?? 0,
    );

    addToast({
      title: result.ok ? "Added to Shopping Bag" : "Stock Limit Reached",
      description: result.message,
      variant: result.ok ? "success" : "warning",
    });
  };

  return (
    <article
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5",
        className,
      )}
    >
      <div>
        {/* Media Frame */}
        <Link
          href={`/products/${product.slug}`}
          className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-surface-media"
        >
          {/* Floating Badges */}
          <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1">
            {isSoldOut ? (
              <Badge variant="destructive">Sold Out</Badge>
            ) : (
              product.badges.slice(0, 2).map((badge, idx) => (
                <Badge
                  key={badge}
                  variant={
                    badge.startsWith("-") ||
                    badge.toLowerCase().includes("best") ||
                    badge.toLowerCase().includes("hot")
                      ? "cta"
                      : idx === 0
                        ? "default"
                        : "soft"
                  }
                >
                  {badge}
                </Badge>
              ))
            )}
          </div>

          {/* Wishlist Toggle */}
          <div className="absolute top-2.5 right-2.5 z-20">
            <WishlistButton productId={product.id} productName={product.name} size="sm" />
          </div>

          {/* Sneaker Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeColorway?.images[0]}
            alt={product.name}
            loading="lazy"
            className={cn(
              "size-full transition-transform duration-500 group-hover:scale-105",
              variant === "home" ? "object-cover" : "object-contain p-3",
              isSoldOut && "opacity-60 grayscale",
            )}
          />

          {/* Hover Slide-up Quick EU Size Selector */}
          {!isSoldOut && availableSizes.length > 0 ? (
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="absolute inset-x-2 bottom-2 z-20 translate-y-10 rounded-lg border border-border/70 bg-surface/95 p-1.5 opacity-0 shadow-md backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="pl-1 font-label text-[10px] font-bold uppercase text-muted-foreground">
                  EU:
                </span>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  {availableSizes.slice(0, 5).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedQuickSize(sz);
                      }}
                      className={cn(
                        "rounded px-1.5 py-0.5 font-label text-[11px] font-bold transition-colors cursor-pointer",
                        quickSize === sz
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-low text-foreground hover:bg-primary hover:text-primary-foreground",
                      )}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Link>

        {/* Product Info */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-label text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              {product.brand}
            </span>
            <Rating rating={product.rating} reviewCount={product.reviewCount} />
          </div>

          <Link href={`/products/${product.slug}`} className="block">
            <h3 className="truncate font-display text-base font-bold text-foreground transition-colors group-hover:text-primary">
              {product.name}
            </h3>
          </Link>

          <p className="line-clamp-1 text-xs text-muted-foreground">{product.tagline}</p>

          <div className="flex items-center justify-between pt-1">
            <ColorSelector
              colorways={product.colorways}
              selectedColorwayId={activeColorway?.id ?? ""}
              onSelect={setActiveColorwayId}
              size="sm"
            />
            {quickSize && !isSoldOut ? (
              <span className="font-label text-[11px] font-semibold text-muted-foreground">
                EU {quickSize} ready
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Price & Add CTA */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        <div className="min-w-0">
          <PriceDisplay
            priceETB={product.priceETB}
            compareAtPriceETB={product.compareAtPriceETB}
            size="md"
          />
          {product.freeAddisDelivery ? (
            <span className="block font-label text-[11px] font-semibold text-primary">
              Free Addis Express
            </span>
          ) : (
            <span className="block font-label text-[11px] text-muted-foreground">
              Addis Stock Ready
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={isSoldOut}
          aria-label={`Add ${product.name} to bag`}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 font-label text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
            variant === "home"
              ? "bg-primary text-primary-foreground hover:bg-primary-hover"
              : "bg-cta text-cta-foreground hover:bg-cta-hover",
          )}
        >
          <ShoppingBag className="size-3.5" />
          <span>{isSoldOut ? "Out" : "Add"}</span>
        </button>
      </div>
    </article>
  );
}
