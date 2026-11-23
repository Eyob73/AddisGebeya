"use client";

import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import { ProductGrid } from "@/components/shared/product-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useCatalogStore } from "@/stores/catalog.store";
import { useWishlistStore } from "@/stores/wishlist.store";

export default function WishlistPage() {
  const { productIds, clear } = useWishlistStore();
  const products = useCatalogStore((s) => s.products);

  const savedProducts = products.filter((p) => productIds.includes(p.id));

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-10 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
        <div>
          <Badge variant="secondary" className="mb-2">
            Saved Rotation
          </Badge>
          <h1 className="font-display text-3xl font-extrabold text-foreground">
            Your Footwear Wishlist{" "}
            <span className="font-normal text-muted-foreground">({savedProducts.length})</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track stock across your favorite EU sizes and move pairs straight to your bag.
          </p>
        </div>

        {savedProducts.length > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            <Trash2 className="size-4" /> Clear Wishlist
          </Button>
        ) : null}
      </div>

      {savedProducts.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Your Wishlist is Empty"
          description="Tap the heart icon on any sneaker, running shoe, or leather pair to keep tabs on it here."
          action={
            <Button asChild variant="cta" size="lg">
              <Link href="/shop">Explore Footwear Vault</Link>
            </Button>
          }
        />
      ) : (
        <ProductGrid products={savedProducts} columns={4} />
      )}
    </div>
  );
}

