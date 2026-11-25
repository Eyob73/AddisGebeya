"use client";

import * as React from "react";
import { EU_SIZES, getConfiguredSizesForColorway } from "@/data/mock-footwear";
import { cn } from "@/lib/utils";

interface SizeSelectorProps {
  stockBySize: Record<number, number>;
  selectedSize: number | null;
  onSelect: (size: number) => void;
  sizes?: readonly number[];
  compact?: boolean;
  showStockHints?: boolean;
  className?: string;
}

export function SizeSelector({
  stockBySize,
  selectedSize,
  onSelect,
  sizes,
  compact = false,
  showStockHints = true,
  className,
}: SizeSelectorProps) {
  const resolvedSizes = React.useMemo(
    () => (sizes && sizes.length > 0 ? sizes : getConfiguredSizesForColorway(stockBySize, [...EU_SIZES])),
    [sizes, stockBySize],
  );

  return (
    <div
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-5" : "grid-cols-3 sm:grid-cols-5 md:grid-cols-6",
        className,
      )}
      role="radiogroup"
      aria-label="Select EU shoe size"
    >
      {resolvedSizes.map((size) => {
        const stock = stockBySize[size] ?? 0;
        const isOutOfStock = stock <= 0;
        const isLowStock = stock > 0 && stock <= 2;
        const isSelected = selectedSize === size && !isOutOfStock;

        return (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isOutOfStock}
            onClick={() => {
              if (!isOutOfStock) onSelect(size);
            }}
            title={
              isOutOfStock
                ? `EU ${size} — Out of stock`
                : `EU ${size} — ${stock} pair${stock === 1 ? "" : "s"} available`
            }
            className={cn(
              "relative flex flex-col items-center justify-center rounded-lg border-[1.5px] font-label font-bold transition-all",
              compact ? "px-1.5 py-1 text-xs" : "py-2.5 px-2 text-sm",
              isOutOfStock &&
                "cursor-not-allowed border-border/60 bg-muted/60 text-muted-foreground/45 overflow-hidden",
              !isOutOfStock &&
                !isSelected &&
                "cursor-pointer border-border bg-surface text-foreground hover:border-primary hover:bg-primary-light/60",
              isSelected &&
                "cursor-pointer border-primary bg-primary text-primary-foreground shadow-sm",
            )}
          >
            {isOutOfStock ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <span className="h-[1.5px] w-[140%] -rotate-45 bg-muted-foreground/40" />
              </span>
            ) : null}

            <span>{size}</span>

            {showStockHints && !compact ? (
              <span
                className={cn(
                  "mt-0.5 text-[10px] font-semibold leading-none",
                  isSelected
                    ? "text-primary-light"
                    : isOutOfStock
                      ? "text-muted-foreground/60"
                      : isLowStock
                        ? "text-cta"
                        : "text-primary",
                )}
              >
                {isOutOfStock ? "Sold out" : isLowStock ? `${stock} left` : `${stock} pairs`}
              </span>
            ) : null}

            {!showStockHints && isLowStock && !isSelected && !compact ? (
              <span className="absolute -top-2 -right-1 rounded-full bg-cta px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-cta-foreground">
                {stock} left
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

