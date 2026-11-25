"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminTablePageSkeleton } from "@/components/shared/page-skeletons";
import { ProductFormView } from "@/features/admin/product-form-view";
import { useProductDetailQuery } from "@/hooks/use-store-queries";

export default function AdminEditProductPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id ?? "";
  const { data: existing, isLoading } = useProductDetailQuery(productId);

  if (isLoading) {
    return <AdminTablePageSkeleton />;
  }

  if (!existing) {
    return (
      <EmptyState
        icon={Package}
        title="Shoe Model Not Found"
        description="This product could not be located in your catalog."
        action={
          <Button asChild>
            <Link href="/admin/products">Back to Product Management</Link>
          </Button>
        }
      />
    );
  }

  return <ProductFormView key={existing.id} existingProduct={existing} />;
}

