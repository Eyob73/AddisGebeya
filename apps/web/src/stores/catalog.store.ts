import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  COMMUNITY_REVIEWS,
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_ORDERS,
  INITIAL_PAYMENT_SLIPS,
  INITIAL_PRODUCTS,
  INITIAL_STORE_SETTINGS,
} from "@/data/mock-footwear";
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

interface CatalogState {
  products: ShoeProduct[];
  categories: ShoeCategory[];
  orders: OrderRecord[];
  customers: CustomerRecord[];
  reviews: ShoeReview[];
  paymentSlips: PaymentSlipRecord[];
  settings: StoreSettings;

  // Product actions
  addProduct: (product: ShoeProduct) => void;
  updateProduct: (id: string, patch: Partial<ShoeProduct>) => void;
  deleteProduct: (id: string) => void;

  // Inventory actions (size-specific & color-specific)
  updateSizeStock: (productId: string, colorwayId: string, size: number, quantity: number) => void;
  bulkRestockProduct: (productId: string, colorwayId: string, stockBySize: Record<number, number>) => void;
  decrementStockForOrder: (
    items: Array<{ productId: string; colorwayId: string; size: number; quantity: number }>,
  ) => void;

  // Category actions
  addCategory: (category: ShoeCategory) => void;
  updateCategory: (id: string, patch: Partial<ShoeCategory>) => void;
  deleteCategory: (id: string) => void;

  // Order actions
  createOrder: (order: OrderRecord) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus, courierName?: string) => void;
  verifyOrderPayment: (orderId: string, reference: string, paymentStatus?: PaymentStatus) => void;
  attachSlipToOrder: (slipId: string, orderId: string) => void;

  // Review actions
  addReview: (review: ShoeReview) => void;
  markReviewHelpful: (reviewId: string) => void;

  // Settings actions
  updateSettings: (patch: Partial<StoreSettings>) => void;
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      products: INITIAL_PRODUCTS,
      categories: INITIAL_CATEGORIES,
      orders: INITIAL_ORDERS,
      customers: INITIAL_CUSTOMERS,
      reviews: COMMUNITY_REVIEWS,
      paymentSlips: INITIAL_PAYMENT_SLIPS,
      settings: INITIAL_STORE_SETTINGS,

      addProduct: (product) => set({ products: [product, ...get().products] }),

      updateProduct: (id, patch) =>
        set({
          products: get().products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }),

      deleteProduct: (id) =>
        set({
          products: get().products.filter((p) => p.id !== id),
        }),

      updateSizeStock: (productId, colorwayId, size, quantity) =>
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
        }),

      bulkRestockProduct: (productId, colorwayId, stockBySize) =>
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
        }),

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

      addCategory: (category) => set({ categories: [...get().categories, category] }),

      updateCategory: (id, patch) =>
        set({
          categories: get().categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }),

      deleteCategory: (id) =>
        set({
          categories: get().categories.filter((c) => c.id !== id),
        }),

      createOrder: (order) => {
        const existingCustomer = get().customers.find(
          (c) => c.email.toLowerCase() === order.customerEmail.toLowerCase(),
        );
        const updatedCustomers = existingCustomer
          ? get().customers.map((c) =>
              c.id === existingCustomer.id
                ? {
                    ...c,
                    totalOrders: c.totalOrders + 1,
                    totalSpentETB: c.totalSpentETB + order.totalETB,
                    tier:
                      c.totalOrders + 1 >= 4
                        ? ("VIP Runner" as const)
                        : ("Repeat Buyer" as const),
                  }
                : c,
            )
          : [
              {
                id: order.customerId,
                name: order.customerName,
                email: order.customerEmail,
                phone: order.customerPhone,
                city: order.city,
                subCity: order.subCity,
                preferredSize: order.items[0]?.size || 42,
                totalOrders: 1,
                totalSpentETB: order.totalETB,
                tier: "Member" as const,
                joinedAt: order.createdAt,
              },
              ...get().customers,
            ];

        set({
          orders: [order, ...get().orders],
          customers: updatedCustomers,
        });
      },

      updateOrderStatus: (orderId, status, courierName) =>
        set({
          orders: get().orders.map((order) => {
            if (order.id !== orderId) return order;
            const statusLabels: Record<OrderStatus, string> = {
              pending: "Order Pending Confirmation",
              confirmed: "Order Confirmed by Bole HQ",
              packed: "Packed & Quality Checked",
              out_for_delivery: courierName
                ? `Out with ${courierName}`
                : "Out with Addis Ababa Courier",
              shipped_regional: "Shipped via Regional Express Cargo",
              delivered: "Delivered & Fit Verified",
              cancelled: "Order Cancelled",
            };
            const nowLabel = new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const nextEvents = [
              ...order.trackingEvents.map((ev) => ({ ...ev, current: false })),
              {
                step: statusLabels[status],
                description: `Status updated by Store Owner Console at ${nowLabel}.`,
                timestamp: `Today, ${nowLabel}`,
                completed: true,
                current: true,
              },
            ];
            return {
              ...order,
              status,
              courierName: courierName ?? order.courierName,
              trackingEvents: nextEvents,
            };
          }),
        }),

      verifyOrderPayment: (orderId, reference, paymentStatus = "verified") =>
        set({
          orders: get().orders.map((o) =>
            o.id === orderId ? { ...o, paymentReference: reference, paymentStatus } : o,
          ),
        }),

      attachSlipToOrder: (slipId, orderId) => {
        const slip = get().paymentSlips.find((s) => s.id === slipId);
        if (!slip) return;
        set({
          paymentSlips: get().paymentSlips.filter((s) => s.id !== slipId),
          orders: get().orders.map((o) =>
            o.id === orderId
              ? { ...o, paymentStatus: "verified", paymentReference: slip.reference }
              : o,
          ),
        });
      },

      addReview: (review) =>
        set({
          reviews: [review, ...get().reviews],
          products: get().products.map((p) => {
            if (p.id !== review.productId) return p;
            const nextCount = p.reviewCount + 1;
            const nextRating = Number(
              ((p.rating * p.reviewCount + review.rating) / nextCount).toFixed(1),
            );
            return { ...p, reviewCount: nextCount, rating: nextRating };
          }),
        }),

      markReviewHelpful: (reviewId) =>
        set({
          reviews: get().reviews.map((r) =>
            r.id === reviewId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r,
          ),
        }),

      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
    }),
    {
      name: "addisgebeya-catalog-v1",
    },
  ),
);

