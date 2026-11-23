"use client";

import { PackageOpen } from "lucide-react";
import { ProductCard } from "@/components/shared/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShoeProduct } from "@/types/store.types";
import { cn } from "@/lib/utils";

interface ProductGridProps {
  products: ShoeProduct[];
  columns?: 3 | 4;
  variant?: "home" | "catalog";
  isLoading?: boolean;
  emptyAction?: React.ReactNode;
  className?: string;
}

export function ProductGrid({
  products,
  columns = 4,
  variant = "catalog",
  isLoading = false,
  emptyAction,
  className,
}: ProductGridProps) {
  const gridCols =
    columns === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5";

  if (isLoading) {
    return (
      <div className={cn("grid", gridCols, className)}>
        {Array.from({ length: columns * 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="No matching footwear found"
        description="Try adjusting your EU size, price range, color tone, or clearing active filters to explore the full AddisGebeya vault."
        action={emptyAction}
      />
    );
  }

  return (
    <div className={cn("grid", gridCols, className)}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} variant={variant} />
      ))}
    </div>
  );
}

