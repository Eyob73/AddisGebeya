"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import { ColorSelector } from "@/components/shared/color-selector";
import { PriceDisplay } from "@/components/shared/price-display";
import { Rating } from "@/components/shared/rating";
import { WishlistButton } from "@/components/shared/wishlist-button";
import { Badge } from "@/components/ui/badge";
import {
  getColorwayTotalStock,
  getConfiguredSizesForColorway,
} from "@/data/mock-footwear";
import { useCartStore } from "@/stores/cart.store";
import { useUiStore } from "@/stores/ui.store";
import type { ShoeProduct } from "@/types/store.types";
import { cn } from "@/lib/utils";
import { calculateDiscountPercent } from "@/utils/format";
import { getCardImageUrl, DEFAULT_FALLBACK_IMAGE } from "@/utils/cloudinary";

interface ProductCardProps {
  product: ShoeProduct;
  variant?: "home" | "catalog";
  className?: string;
}

export function ProductCard({ product, variant = "catalog", className }: ProductCardProps) {
  const defaultColorway = React.useMemo(
    () =>
      product.colorways.find((cw) => getColorwayTotalStock(cw.stockBySize) > 0) ??
      product.colorways[0],
    [product.colorways],
  );

  const [activeColorwayId, setActiveColorwayId] = React.useState(defaultColorway?.id ?? "");
  const activeColorway =
    product.colorways.find((c) => c.id === activeColorwayId) ?? defaultColorway;

  const configuredSizes = React.useMemo(() => {
    if (!activeColorway) return [];
    return getConfiguredSizesForColorway(activeColorway.stockBySize);
  }, [activeColorway]);

  const availableSizes = React.useMemo(() => {
    if (!activeColorway) return [];
    return Object.entries(activeColorway.stockBySize)
      .filter(([, qty]) => qty > 0)
      .map(([size]) => Number(size))
      .sort((a, b) => a - b);
  }, [activeColorway]);

  const [selectedQuickSize, setSelectedQuickSize] = React.useState<number | null>(null);
  const chosenSize =
    selectedQuickSize !== null && availableSizes.includes(selectedQuickSize)
      ? selectedQuickSize
      : availableSizes.includes(42)
        ? 42
        : (availableSizes[0] ?? null);

  const addItem = useCartStore((s) => s.addItem);
  const addToast = useUiStore((s) => s.addToast);
  const [justAdded, setJustAdded] = React.useState(false);

  const totalColorStock = activeColorway ? getColorwayTotalStock(activeColorway.stockBySize) : 0;
  const totalProductStock = React.useMemo(
    () => product.colorways.reduce((sum, cw) => sum + getColorwayTotalStock(cw.stockBySize), 0),
    [product.colorways],
  );
  const isColorSoldOut = totalColorStock <= 0;
  const isProductSoldOut = totalProductStock <= 0;
  const selectedSizeStock =
    chosenSize !== null && activeColorway ? (activeColorway.stockBySize[chosenSize] ?? 0) : 0;

  const discountPct = calculateDiscountPercent(product.priceETB, product.compareAtPriceETB);

  const cardImageRaw =
    activeColorway?.images[0] ||
    product.productImages?.find((img) => img.isPrimary)?.imageUrl ||
    product.productImages?.[0]?.imageUrl;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!activeColorway || chosenSize === null || selectedSizeStock <= 0) {
      addToast({
        title: "Size Unavailable",
        description: "Please select an in-stock size and color before adding to bag.",
        variant: "warning",
      });
      return;
    }

    const result = addItem(
      product,
      activeColorway.id,
      chosenSize,
      1,
      selectedSizeStock,
    );

    if (result.ok) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1400);
    }

    addToast({
      title: result.ok ? "Added to Shopping Bag" : "Stock Limit Reached",
      description: result.message,
      variant: result.ok ? "success" : "warning",
    });
  };

  return (
    <article
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-3.5 sm:p-4 shadow-card transition-all duration-300 hover:border-primary/25 hover:shadow-card-hover hover:-translate-y-0.5",
        className,
      )}
    >
      <div>
        {/* Media Frame */}
        <Link
          href={`/products/${product.slug}`}
          className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-surface-media"
        >
          {/* Floating Badges */}
          <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap gap-1">
            {isProductSoldOut ? (
              <Badge variant="destructive">Sold Out</Badge>
            ) : (
              <>
                {discountPct > 0 ? <Badge variant="cta">-{discountPct}% OFF</Badge> : null}
                {product.badges
                  .filter((badge) => {
                    const normalized = badge.trim().toLowerCase();
                    if (normalized === "ethiopian made") return false;
                    if (discountPct > 0 && normalized.startsWith("-")) return false;
                    return true;
                  })
                  .slice(0, discountPct > 0 ? 1 : 2)
                  .map((badge, idx) => (
                    <Badge
                      key={badge}
                      variant={
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
                  ))}
              </>
            )}
          </div>

          {/* Wishlist Toggle */}
          <div className="absolute top-2.5 right-2.5 z-20">
            <WishlistButton productId={product.id} productName={product.name} size="sm" />
          </div>

          {/* Sneaker Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getCardImageUrl(cardImageRaw)}
            alt={`${product.name}${activeColorway ? ` - ${activeColorway.name}` : ""}`}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
            }}
            className={cn(
              "size-full transition-transform duration-500 group-hover:scale-105",
              variant === "home" ? "object-cover" : "object-contain p-3",
              (isColorSoldOut || isProductSoldOut) && "opacity-60 grayscale",
            )}
          />
        </Link>

        {/* Product Info */}
        <div className="mt-3.5 space-y-2">
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

          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate font-medium">
              {product.gender} • {product.shoeType || product.categoryName}
            </span>
            <span
              className={cn(
                "shrink-0 font-label font-bold",
                isColorSoldOut
                  ? "text-destructive"
                  : totalColorStock <= 5
                    ? "text-cta"
                    : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {isColorSoldOut
                ? "Out of stock"
                : selectedSizeStock > 0 && chosenSize !== null
                  ? `${selectedSizeStock} left in EU ${chosenSize}`
                  : `${totalColorStock} in stock`}
            </span>
          </div>

          {/* Colorway Selection */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <ColorSelector
              colorways={product.colorways}
              selectedColorwayId={activeColorway?.id ?? ""}
              onSelect={(cwId) => {
                setActiveColorwayId(cwId);
              }}
              size="sm"
            />
            {activeColorway ? (
              <span className="truncate font-label text-[11px] font-medium text-muted-foreground">
                {activeColorway.name}
              </span>
            ) : null}
          </div>

          {/* Always-visible Interactive EU Size Chips */}
          {configuredSizes.length > 0 ? (
            <div className="pt-1" aria-label={`Available EU sizes for ${product.name}`}>
              <div className="flex flex-wrap items-center gap-1">
                {configuredSizes.slice(0, 7).map((sz) => {
                  const qty = activeColorway?.stockBySize[sz] ?? 0;
                  const disabled = qty <= 0;
                  const isSelected = chosenSize === sz && !disabled;
                  return (
                    <button
                      key={sz}
                      type="button"
                      disabled={disabled}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!disabled) setSelectedQuickSize(sz);
                      }}
                      title={
                        disabled
                          ? `EU ${sz} — Out of stock`
                          : `Select EU ${sz} (${qty} ${qty === 1 ? "pair" : "pairs"} left)`
                      }
                      className={cn(
                        "h-6 min-w-7 rounded-md border px-1.5 font-mono text-[11px] font-bold transition-all",
                        disabled
                          ? "cursor-not-allowed border-border/50 bg-muted/50 text-muted-foreground/40 line-through"
                          : isSelected
                            ? "cursor-pointer border-primary bg-primary text-primary-foreground shadow-2xs"
                            : "cursor-pointer border-border bg-surface-low text-foreground hover:border-primary hover:bg-primary-light",
                      )}
                    >
                      {sz}
                    </button>
                  );
                })}
                {configuredSizes.length > 7 ? (
                  <Link
                    href={`/products/${product.slug}`}
                    className="px-1 font-label text-[10px] font-bold text-primary hover:underline"
                  >
                    +{configuredSizes.length - 7}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
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
          disabled={isColorSoldOut || chosenSize === null}
          aria-label={`Add ${product.name} to bag`}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 font-label text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
            justAdded
              ? "bg-emerald-600 text-white"
              : variant === "home"
                ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                : "bg-cta text-cta-foreground hover:bg-cta-hover",
          )}
        >
          {justAdded ? <Check className="size-3.5" /> : <ShoppingBag className="size-3.5" />}
          <span>{isColorSoldOut ? "Out" : justAdded ? "Added" : "Add"}</span>
        </button>
      </div>
    </article>
  );
}
