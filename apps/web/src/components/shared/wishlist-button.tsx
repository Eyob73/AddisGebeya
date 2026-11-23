"use client";

import { Heart } from "lucide-react";
import { useUiStore } from "@/stores/ui.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  productId: string;
  productName?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function WishlistButton({
  productId,
  productName,
  size = "sm",
  className,
}: WishlistButtonProps) {
  const isWishlisted = useWishlistStore((s) => s.productIds.includes(productId));
  const toggle = useWishlistStore((s) => s.toggle);
  const addToast = useUiStore((s) => s.addToast);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggle(productId);
    addToast({
      title: added ? "Saved to Wishlist" : "Removed from Wishlist",
      description: productName
        ? added
          ? `${productName} has been added to your wishlist.`
          : `${productName} was removed from your wishlist.`
        : undefined,
      variant: added ? "success" : "default",
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={isWishlisted}
      className={cn(
        "flex items-center justify-center rounded-full bg-surface/90 backdrop-blur-sm border border-border/60 shadow-sm transition-all duration-200 hover:scale-105 active:scale-90 cursor-pointer",
        isWishlisted ? "text-cta border-cta/30" : "text-muted-foreground hover:text-cta",
        size === "sm" && "size-8",
        size === "md" && "size-10",
        size === "lg" && "size-12",
        className,
      )}
    >
      <Heart
        className={cn(
          size === "sm" && "size-4",
          size === "md" && "size-5",
          size === "lg" && "size-5",
          isWishlisted && "fill-cta",
        )}
      />
    </button>
  );
}

