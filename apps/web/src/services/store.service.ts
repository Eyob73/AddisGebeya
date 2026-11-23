import { useCatalogStore } from "@/stores/catalog.store";
import type { OrderRecord, ShoeCategory, ShoeProduct } from "@/types/store.types";

/**
 * Temporary frontend service layer backed by the local Zustand catalog store.
 *
 * Backend integration note:
 * The Express backend currently implements `GET /api/v1/health` (wired in `health.service.ts`).
 * Product, Category, Inventory, Order, Auth, and Customer REST endpoints are not yet created
 * in `apps/api`. This service isolates all data access so components can seamlessly switch to
 * `apiClient.get/post/patch/delete` once those backend endpoints are added.
 */

export interface ProductQueryFilters {
  search?: string;
  categorySlug?: string;
  gender?: string;
  brand?: string;
  size?: number;
  colorHex?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  sortBy?: "featured" | "newest" | "best_selling" | "price_low" | "price_high" | "rating";
}

export const storeService = {
  async listProducts(filters: ProductQueryFilters = {}): Promise<ShoeProduct[]> {
    const allProducts = useCatalogStore.getState().products.filter((p) => p.status === "active");

    const filtered = allProducts.filter((product) => {
      if (filters.search) {
        const q = filters.search.trim().toLowerCase();
        const hit =
          product.name.toLowerCase().includes(q) ||
          product.brand.toLowerCase().includes(q) ||
          product.categoryName.toLowerCase().includes(q) ||
          product.tagline.toLowerCase().includes(q) ||
          product.sku.toLowerCase().includes(q);
        if (!hit) return false;
      }

      if (filters.categorySlug && filters.categorySlug !== "all") {
        if (filters.categorySlug === "men") {
          if (product.gender !== "Men" && product.gender !== "Unisex") return false;
        } else if (filters.categorySlug === "women") {
          if (product.gender !== "Women" && product.gender !== "Unisex") return false;
        } else if (filters.categorySlug === "new-arrivals") {
          if (!product.featuredNewDrop) return false;
        } else if (filters.categorySlug === "sale") {
          if (!product.isOnSale && !product.compareAtPriceETB) return false;
        } else if (product.categorySlug !== filters.categorySlug) {
          return false;
        }
      }

      if (filters.gender && filters.gender !== "All") {
        if (product.gender !== filters.gender && product.gender !== "Unisex") {
          return false;
        }
      }

      if (filters.brand && filters.brand !== "All") {
        if (product.brand !== filters.brand) return false;
      }

      if (filters.size) {
        const hasSizeInStock = product.colorways.some(
          (cw) => (cw.stockBySize[filters.size!] ?? 0) > 0,
        );
        if (!hasSizeInStock) return false;
      }

      if (filters.colorHex) {
        const target = filters.colorHex.toLowerCase();
        const matchesColor = product.colorways.some(
          (cw) =>
            cw.hex.toLowerCase() === target ||
            cw.secondaryHex?.toLowerCase() === target ||
            cw.name.toLowerCase().includes(target),
        );
        if (!matchesColor) return false;
      }

      if (filters.minPrice !== undefined && product.priceETB < filters.minPrice) {
        return false;
      }

      if (filters.maxPrice !== undefined && product.priceETB > filters.maxPrice) {
        return false;
      }

      if (filters.inStockOnly) {
        const total = product.colorways.reduce(
          (acc, cw) => acc + Object.values(cw.stockBySize).reduce((s, v) => s + v, 0),
          0,
        );
        if (total <= 0) return false;
      }

      if (filters.onSaleOnly) {
        if (!product.isOnSale && !product.compareAtPriceETB) return false;
      }

      return true;
    });

    const sorted = [...filtered];
    switch (filters.sortBy) {
      case "price_low":
        sorted.sort((a, b) => a.priceETB - b.priceETB);
        break;
      case "price_high":
        sorted.sort((a, b) => b.priceETB - a.priceETB);
        break;
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
        break;
      case "newest":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "best_selling":
        sorted.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      default:
        sorted.sort((a, b) => Number(Boolean(b.featuredTrending)) - Number(Boolean(a.featuredTrending)));
    }

    return sorted;
  },

  async getProductBySlug(slug: string): Promise<ShoeProduct | null> {
    const products = useCatalogStore.getState().products;
    return products.find((p) => p.slug === slug || p.id === slug) ?? null;
  },

  async listCategories(): Promise<ShoeCategory[]> {
    return useCatalogStore.getState().categories.filter((c) => c.active);
  },

  async listOrders(): Promise<OrderRecord[]> {
    return useCatalogStore.getState().orders;
  },

  async getOrderById(id: string): Promise<OrderRecord | null> {
    const normalized = id.replace(/^#/, "").trim().toUpperCase();
    return (
      useCatalogStore
        .getState()
        .orders.find((o) => o.id.toUpperCase() === normalized) ?? null
    );
  },
};

