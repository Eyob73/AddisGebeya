"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductFormView } from "@/features/admin/product-form-view";
import { useCatalogStore } from "@/stores/catalog.store";

export default function AdminEditProductPage() {
  const params = useParams<{ id: string }>();
  const products = useCatalogStore((s) => s.products);
  const existing = products.find((p) => p.id === params?.id || p.slug === params?.id);

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

  return <ProductFormView existingProduct={existing} />;
}

