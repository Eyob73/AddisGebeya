"use client";

import { getColorwayTotalStock } from "@/data/mock-footwear";
import type { ShoeColorway } from "@/types/store.types";
import { cn } from "@/lib/utils";

interface ColorSelectorProps {
  colorways: ShoeColorway[];
  selectedColorwayId: string;
  onSelect: (colorwayId: string) => void;
  size?: "sm" | "md";
  disableOutOfStock?: boolean;
  className?: string;
}

export function ColorSelector({
  colorways,
  selectedColorwayId,
  onSelect,
  size = "md",
  disableOutOfStock = true,
  className,
}: ColorSelectorProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="radiogroup"
      aria-label="Select shoe colorway"
    >
      {colorways.map((cw) => {
        const totalStock = getColorwayTotalStock(cw.stockBySize);
        const isOutOfStock = disableOutOfStock && totalStock <= 0;
        const isSelected = cw.id === selectedColorwayId && !isOutOfStock;
        const backgroundStyle = cw.secondaryHex
          ? { background: `linear-gradient(135deg, ${cw.hex} 50%, ${cw.secondaryHex} 50%)` }
          : { backgroundColor: cw.hex };

        return (
          <button
            key={cw.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isOutOfStock}
            disabled={isOutOfStock}
            aria-label={isOutOfStock ? `${cw.name} (Out of stock)` : cw.name}
            title={isOutOfStock ? `${cw.name} — Out of stock` : `${cw.name} (${totalStock} pairs)`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isOutOfStock) onSelect(cw.id);
            }}
            className={cn(
              "relative flex items-center justify-center rounded-full border border-border/80 transition-all overflow-hidden",
              size === "sm" ? "size-5 p-[1.5px]" : "size-9 p-0.5 shadow-sm",
              isOutOfStock
                ? "cursor-not-allowed opacity-45 grayscale"
                : "cursor-pointer hover:scale-105",
              isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
            )}
          >
            <span className="block size-full rounded-full" style={backgroundStyle} />
            {isOutOfStock ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <span className="h-[1.5px] w-[140%] -rotate-45 bg-foreground/75" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

