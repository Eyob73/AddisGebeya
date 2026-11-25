import { Suspense } from "react";
import type { Metadata } from "next";
import { CatalogView } from "@/features/catalog/catalog-view";

export const metadata: Metadata = {
  title: "Shop All Footwear",
  description:
    "Browse authentic sneakers, running shoes, loafers, boots, and handcrafted leather shoes in ETB.",
};

export default function ShopAllPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground">Loading footwear catalog...</div>}>
      <CatalogView initialCategorySlug="all" pageTitle="Curated Footwear Vault" />
    </Suspense>
  );
}

