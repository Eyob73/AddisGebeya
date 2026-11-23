import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingProps {
  rating: number;
  reviewCount?: number;
  variant?: "compact" | "full";
  className?: string;
}

export function Rating({ rating, reviewCount, variant = "compact", className }: RatingProps) {
  if (variant === "compact") {
    return (
      <div className={cn("inline-flex items-center gap-1 font-label text-xs", className)}>
        <Star className="size-3.5 fill-cta text-cta" aria-hidden="true" />
        <span className="font-bold text-foreground">{rating.toFixed(1)}</span>
        {reviewCount !== undefined ? (
          <span className="text-[11px] text-muted-foreground">({reviewCount})</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div className="flex items-center gap-0.5 text-amber-500" aria-label={`Rated ${rating} out of 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "size-4",
              i < Math.round(rating) ? "fill-amber-500 text-amber-500" : "text-border",
            )}
          />
        ))}
      </div>
      <span className="font-display text-sm font-bold text-foreground">{rating.toFixed(1)}</span>
      {reviewCount !== undefined ? (
        <span className="text-xs font-medium text-muted-foreground">({reviewCount} reviews)</span>
      ) : null}
    </div>
  );
}

