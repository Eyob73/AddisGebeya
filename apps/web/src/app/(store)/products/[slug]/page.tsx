"use client";

import { useParams } from "next/navigation";
import { ProductDetailView } from "@/features/product/product-detail-view";

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  return <ProductDetailView slug={params?.slug ?? ""} />;
}

