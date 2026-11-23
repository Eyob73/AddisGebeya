"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { CatalogView } from "@/features/catalog/catalog-view";
import { useCatalogStore } from "@/stores/catalog.store";

const SPECIAL_CATEGORIES: Record<string, { title: string; subtitle: string }> = {
  "new-arrivals": {
    title: "New Arrivals & Drops",
    subtitle: "Freshly landed weekly limited silhouettes verified at our Bole Medhanialem hub.",
  },
  sale: {
    title: "Seasonal Footwear Sale",
    subtitle: "Limited-time Ethiopian Birr markdowns on authentic athletic and streetwear pairs.",
  },
};

function CategoryPageInner() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "all";
  const categories = useCatalogStore((s) => s.categories);
  const matchedCategory = categories.find((c) => c.slug === slug);
  const special = SPECIAL_CATEGORIES[slug];

  const title =
    matchedCategory?.name ??
    special?.title ??
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const subtitle = matchedCategory?.description ?? special?.subtitle;

  return (
    <CatalogView
      key={slug}
      initialCategorySlug={slug}
      pageTitle={title}
      pageSubtitle={subtitle}
      heroBannerImage={matchedCategory?.image}
    />
  );
}

export default function CategoryPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground">Loading category...</div>}>
      <CategoryPageInner />
    </Suspense>
  );
}
