"use client";

import { useQuery } from "@tanstack/react-query";
import { storeService, type ProductQueryFilters } from "@/services/store.service";
import { useCatalogStore } from "@/stores/catalog.store";

export function useProductsQuery(filters: ProductQueryFilters = {}) {
  const productsVersion = useCatalogStore((s) => s.products);
  return useQuery({
    queryKey: ["products", filters, productsVersion],
    queryFn: () => storeService.listProducts(filters),
  });
}

export function useProductDetailQuery(slug: string) {
  const productsVersion = useCatalogStore((s) => s.products);
  return useQuery({
    queryKey: ["product", slug, productsVersion],
    queryFn: () => storeService.getProductBySlug(slug),
    enabled: Boolean(slug),
  });
}

export function useCategoriesQuery() {
  const categoriesVersion = useCatalogStore((s) => s.categories);
  return useQuery({
    queryKey: ["categories", categoriesVersion],
    queryFn: () => storeService.listCategories(),
  });
}

export function useOrdersQuery() {
  const ordersVersion = useCatalogStore((s) => s.orders);
  return useQuery({
    queryKey: ["orders", ordersVersion],
    queryFn: () => storeService.listOrders(),
  });
}

