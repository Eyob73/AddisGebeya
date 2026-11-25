import { create } from "zustand";
import { apiClient } from "@/lib/api-client";
import type {
  CustomerRecord,
  OrderRecord,
  OrderStatus,
  PaymentSlipRecord,
  PaymentStatus,
  ShoeCategory,
  ShoeProduct,
  ShoeReview,
  StoreSettings,
} from "@/types/store.types";

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "AddisGebeya Shoes",
  tagline: "Authentic Footwear Vault Addis Ababa",
  showroomAddress: "Bole, Addis Ababa, Ethiopia",
  phone: "+251 911 234 567",
  whatsapp: "+251 911 234 567",
  telegramHandle: "@AddisGebeyaHQ",
  email: "contact@addisgebeyashoes.et",
  showroomHours: "Mon - Sat: 8:30 AM - 8:00 PM | Sun: 10:00 AM - 6:00 PM",
  freeDeliveryThresholdETB: 0,
  standardAddisDeliveryFeeETB: 0,
  vipTwoHourDeliveryFeeETB: 450,
  regionalCargoFeeETB: 600,
  vatPercent: 15,
  paymentMethods: {
    telebirr: true,
    cbeBirr: true,
    bankTransfer: true,
    cod: true,
  },
  announcementBarText:
    "🎉 Free Addis Ababa Delivery on All Orders • 15% off performance marathon runners with code ADDISRUN",
  dispatchRibbonText: "Addis Ababa Central Hub Active • Live Rider Dispatch",
  heroImageUrl: null,
  heroBadgeText: "Addis Stock Ready",
  heroCardSubtitle: "New Arrival • Track Spec",
  heroCardTitle: "Addis Velocity Pro Nitro",
  heroCardPriceText: "5,850 ETB",
  heroCardHref: "/products/addis-velocity-pro-nitro",
};

interface CatalogState {
  products: ShoeProduct[];
  categories: ShoeCategory[];
  orders: OrderRecord[];
  customers: CustomerRecord[];
  reviews: ShoeReview[];
  paymentSlips: PaymentSlipRecord[];
  settings: StoreSettings;
  isSyncing: boolean;
  isInitialized: boolean;

  // Backend Sync
  syncFromBackend: () => Promise<void>;

  // Product actions
  addProduct: (product: ShoeProduct) => Promise<void>;
  updateProduct: (id: string, patch: Partial<ShoeProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Inventory actions
  updateSizeStock: (productId: string, colorwayId: string, size: number, quantity: number) => Promise<void>;
  bulkRestockProduct: (
    productId: string,
    colorwayId: string,
    stockBySize: Record<number, number>,
  ) => Promise<void>;
  decrementStockForOrder: (
    items: Array<{ productId: string; colorwayId: string; size: number; quantity: number }>,
  ) => void;

  // Category actions
  addCategory: (category: ShoeCategory) => Promise<void>;
  updateCategory: (id: string, patch: Partial<ShoeCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Order actions
  createOrder: (order: OrderRecord) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus, courierName?: string) => Promise<void>;
  verifyOrderPayment: (orderId: string, reference: string, paymentStatus?: PaymentStatus) => Promise<void>;
  attachSlipToOrder: (slipId: string, orderId: string) => Promise<void>;

  // Review actions
  addReview: (review: ShoeReview) => Promise<void>;
  markReviewHelpful: (reviewId: string) => Promise<void>;

  // Settings actions
  updateSettings: (patch: Partial<StoreSettings>) => Promise<void>;
}

export const useCatalogStore = create<CatalogState>()((set, get) => ({
  products: [],
  categories: [],
  orders: [],
  customers: [],
  reviews: [],
  paymentSlips: [],
  settings: DEFAULT_STORE_SETTINGS,
  isSyncing: false,
  isInitialized: false,

  syncFromBackend: async () => {
    if (get().isSyncing) return;
    set({ isSyncing: true });
    try {
      const [products, categories, orders, settings, slips, customers, reviews] =
        await Promise.allSettled([
          apiClient.get<ShoeProduct[]>("/products"),
          apiClient.get<ShoeCategory[]>("/categories"),
          apiClient.get<OrderRecord[]>("/orders"),
          apiClient.get<StoreSettings>("/settings"),
          apiClient.get<PaymentSlipRecord[]>("/payments/slips"),
          apiClient.get<CustomerRecord[]>("/admin/customers"),
          apiClient.get<ShoeReview[]>("/reviews"),
        ]);

      set({
        products: products.status === "fulfilled" ? products.value : get().products,
        categories: categories.status === "fulfilled" ? categories.value : get().categories,
        orders: orders.status === "fulfilled" ? orders.value : get().orders,
        settings: settings.status === "fulfilled" ? settings.value : get().settings,
        paymentSlips: slips.status === "fulfilled" ? slips.value : get().paymentSlips,
        customers: customers.status === "fulfilled" ? customers.value : get().customers,
        reviews: reviews.status === "fulfilled" ? reviews.value : get().reviews,
        isInitialized: true,
      });
    } catch {
      // Retain existing in-memory state on transient errors
    } finally {
      set({ isSyncing: false });
    }
  },

  addProduct: async (product) => {
    set({ products: [product, ...get().products.filter((p) => p.id !== product.id)] });
  },

  updateProduct: async (id, patch) => {
    set({
      products: get().products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  },

  deleteProduct: async (id) => {
    set({
      products: get().products.filter((p) => p.id !== id),
    });
  },

  updateSizeStock: async (productId, colorwayId, size, quantity) => {
    set({
      products: get().products.map((product) => {
        if (product.id !== productId) return product;
        return {
          ...product,
          colorways: product.colorways.map((cw) => {
            if (cw.id !== colorwayId) return cw;
            return {
              ...cw,
              stockBySize: {
                ...cw.stockBySize,
                [size]: Math.max(0, Math.floor(quantity)),
              },
            };
          }),
        };
      }),
    });

    await apiClient
      .patch(`/products/${productId}/stock`, {
        colorwayId,
        size,
        quantity,
      })
      .catch(() => { });
  },

  bulkRestockProduct: async (productId, colorwayId, stockBySize) => {
    set({
      products: get().products.map((product) => {
        if (product.id !== productId) return product;
        return {
          ...product,
          colorways: product.colorways.map((cw) =>
            cw.id === colorwayId ? { ...cw, stockBySize: { ...stockBySize } } : cw,
          ),
        };
      }),
    });

    await apiClient
      .post(`/products/${productId}/restock`, {
        colorwayId,
        stockBySize,
      })
      .catch(() => { });
  },

  decrementStockForOrder: (orderItems) =>
    set({
      products: get().products.map((product) => {
        const matching = orderItems.filter((i) => i.productId === product.id);
        if (matching.length === 0) return product;
        return {
          ...product,
          colorways: product.colorways.map((cw) => {
            const cwMatches = matching.filter((m) => m.colorwayId === cw.id);
            if (cwMatches.length === 0) return cw;
            const nextStock = { ...cw.stockBySize };
            for (const m of cwMatches) {
              nextStock[m.size] = Math.max(0, (nextStock[m.size] ?? 0) - m.quantity);
            }
            return { ...cw, stockBySize: nextStock };
          }),
        };
      }),
    }),

  addCategory: async (category) => {
    set({ categories: [...get().categories, category] });
    await apiClient.post("/categories", category).catch(() => { });
  },

  updateCategory: async (id, patch) => {
    set({
      categories: get().categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
    await apiClient.patch(`/categories/${id}`, patch).catch(() => { });
  },

  deleteCategory: async (id) => {
    set({
      categories: get().categories.filter((c) => c.id !== id),
    });
    await apiClient.delete(`/categories/${id}`).catch(() => { });
  },

  createOrder: (order) => {
    set({
      orders: [order, ...get().orders],
    });
  },

  updateOrderStatus: async (orderId, status, courierName) => {
    set({
      orders: get().orders.map((o) =>
        o.id === orderId
          ? {
            ...o,
            status,
            courierName: courierName ?? o.courierName,
          }
          : o,
      ),
    });
    await apiClient
      .patch(`/orders/${orderId}/status`, {
        status,
        courierName,
      })
      .catch(() => { });
  },

  verifyOrderPayment: async (orderId, reference, paymentStatus = "verified") => {
    set({
      orders: get().orders.map((o) =>
        o.id === orderId
          ? {
            ...o,
            paymentStatus,
            paymentReference: reference,
          }
          : o,
      ),
    });
    await apiClient
      .patch(`/orders/${orderId}/verify-payment`, {
        reference,
        paymentStatus,
      })
      .catch(() => { });
  },

  attachSlipToOrder: async (slipId, orderId) => {
    set({
      paymentSlips: get().paymentSlips.map((s) =>
        s.id === slipId ? { ...s, matchedOrderId: orderId } : s,
      ),
    });
    await apiClient.post("/payments/slips/attach", { slipId, orderId }).catch(() => { });
  },

  addReview: async (review) => {
    set({ reviews: [review, ...get().reviews] });
    await apiClient.post("/reviews", review).catch(() => { });
  },

  markReviewHelpful: async (reviewId) => {
    set({
      reviews: get().reviews.map((r) =>
        r.id === reviewId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r,
      ),
    });
    await apiClient.post(`/reviews/${reviewId}/helpful`).catch(() => { });
  },

  updateSettings: async (patch) => {
    set({
      settings: { ...get().settings, ...patch },
    });
    await apiClient.patch("/settings", patch).catch(() => { });
  },
}));
