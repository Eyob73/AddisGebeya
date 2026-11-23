"use client";

import type { ShoeColorway } from "@/types/store.types";
import { cn } from "@/lib/utils";

interface ColorSelectorProps {
  colorways: ShoeColorway[];
  selectedColorwayId: string;
  onSelect: (colorwayId: string) => void;
  size?: "sm" | "md";
  className?: string;
}

export function ColorSelector({
  colorways,
  selectedColorwayId,
  onSelect,
  size = "md",
  className,
}: ColorSelectorProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="radiogroup" aria-label="Select shoe colorway">
      {colorways.map((cw) => {
        const isSelected = cw.id === selectedColorwayId;
        const backgroundStyle = cw.secondaryHex
          ? { background: `linear-gradient(135deg, ${cw.hex} 50%, ${cw.secondaryHex} 50%)` }
          : { backgroundColor: cw.hex };

        return (
          <button
            key={cw.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={cw.name}
            title={cw.name}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(cw.id);
            }}
            className={cn(
              "relative flex items-center justify-center rounded-full border border-border/80 transition-all cursor-pointer",
              size === "sm" ? "size-4 p-[1px]" : "size-9 p-0.5 shadow-sm hover:scale-105",
              isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
            )}
          >
            <span className="block size-full rounded-full" style={backgroundStyle} />
          </button>
        );
      })}
    </div>
  );
}

