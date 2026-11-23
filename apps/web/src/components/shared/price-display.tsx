import { cn } from "@/lib/utils";
import { calculateDiscountPercent, formatETB } from "@/utils/format";

interface PriceDisplayProps {
  priceETB: number;
  compareAtPriceETB?: number;
  size?: "sm" | "md" | "lg" | "hero";
  showSavingsBadge?: boolean;
  className?: string;
}

export function PriceDisplay({
  priceETB,
  compareAtPriceETB,
  size = "md",
  showSavingsBadge = false,
  className,
}: PriceDisplayProps) {
  const discount = calculateDiscountPercent(priceETB, compareAtPriceETB);

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-display font-extrabold tracking-tight text-primary",
          size === "sm" && "text-sm",
          size === "md" && "text-base sm:text-lg",
          size === "lg" && "text-xl sm:text-2xl",
          size === "hero" && "text-2xl sm:text-[32px] leading-tight",
        )}
      >
        {formatETB(priceETB)}
      </span>
      {compareAtPriceETB && compareAtPriceETB > priceETB ? (
        <span
          className={cn(
            "font-display text-muted-foreground line-through",
            size === "sm" && "text-xs",
            size === "md" && "text-xs",
            size === "lg" && "text-sm",
            size === "hero" && "text-base sm:text-lg",
          )}
        >
          {formatETB(compareAtPriceETB)}
        </span>
      ) : null}
      {showSavingsBadge && discount > 0 ? (
        <span className="rounded-full bg-cta px-2.5 py-0.5 font-label text-[11px] font-bold text-cta-foreground">
          Save {formatETB((compareAtPriceETB ?? 0) - priceETB)} (-{discount}%)
        </span>
      ) : null}
    </div>
  );
}

