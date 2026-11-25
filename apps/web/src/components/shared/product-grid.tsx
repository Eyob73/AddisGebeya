"use client";

import { PackageOpen } from "lucide-react";
import { ProductCard } from "@/components/shared/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonProductGrid } from "@/components/ui/skeleton";
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
      <SkeletonProductGrid
        columns={columns}
        count={columns * 2}
        variant={variant}
        className={className}
      />
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

