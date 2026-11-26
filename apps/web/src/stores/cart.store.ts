import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartMergeResponse } from "@addisgebeya/types";
import { apiClient } from "@/lib/api-client";
import { storeService } from "@/services/store.service";
import type { AccessoryItem, CartItem, PromoCode, ShoeProduct } from "@/types/store.types";

export interface CartMergeResult {
  warnings: string[];
  mergedCount: number;
}

let inFlightCartMergePromise: Promise<CartMergeResult> | null = null;

interface CartState {
  items: CartItem[];
  appliedPromoCode: string | null;
  activePromo: PromoCode | null;
  deliverySpeed: "standard" | "vip";
  isSyncing: boolean;
  syncFromBackend: () => Promise<void>;
  mergeWithBackend: () => Promise<CartMergeResult>;
  addItem: (
    product: ShoeProduct,
    colorwayId: string,
    size: number,
    quantity?: number,
    maxStock?: number,
  ) => { ok: boolean; message: string };
  addAccessory: (accessory: AccessoryItem) => void;
  updateQuantity: (cartItemId: string, quantity: number, maxStock?: number) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
  applyPromo: (code: string) => Promise<{ ok: boolean; message: string; promo?: PromoCode }>;
  removePromo: () => void;
  setDeliverySpeed: (speed: "standard" | "vip") => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      appliedPromoCode: null,
      activePromo: null,
      deliverySpeed: "standard",
      isSyncing: false,

      syncFromBackend: async () => {
        if (get().isSyncing) return;
        set({ isSyncing: true });
        try {
          const res = await apiClient.get<{ id: string; items: CartItem[] }>("/cart");
          const localAccessories = get().items.filter((i) => Boolean(i.isAccessory));
          if (res?.items && Array.isArray(res.items) && res.items.length > 0) {
            set({ items: [...res.items, ...localAccessories] });
          }
        } catch {
          // Retain local bag on network glitch
        } finally {
          set({ isSyncing: false });
        }
      },

      mergeWithBackend: async () => {
        if (inFlightCartMergePromise) {
          return inFlightCartMergePromise;
        }

        inFlightCartMergePromise = (async () => {
          set({ isSyncing: true });
          try {
            const currentItems = get().items;
            const localAccessories = currentItems.filter((i) => Boolean(i.isAccessory));
            const localShoeItems = currentItems
              .filter((i) => !i.isAccessory && i.productId && i.colorwayId && i.size > 0)
              .map((i) => ({
                productId: i.productId,
                colorwayId: i.colorwayId,
                size: i.size,
                quantity: i.quantity,
              }));

            const res = await apiClient.post<CartMergeResponse>("/cart/merge", {
              items: localShoeItems,
            });

            if (res && Array.isArray(res.items)) {
              const mergedShoes = res.items as unknown as CartItem[];
              set({ items: [...mergedShoes, ...localAccessories] });
              return {
                warnings: Array.isArray(res.warnings) ? res.warnings : [],
                mergedCount: typeof res.mergedCount === "number" ? res.mergedCount : 0,
              };
            }
            return { warnings: [], mergedCount: 0 };
          } catch {
            // Preserve local cart progress if merge request cannot reach server
            return { warnings: [], mergedCount: 0 };
          } finally {
            set({ isSyncing: false });
            inFlightCartMergePromise = null;
          }
        })();

        return inFlightCartMergePromise;
      },

      addItem: (product, colorwayId, size, quantity = 1, maxStock) => {
        const colorway =
          product.colorways.find((cw) => cw.id === colorwayId) ?? product.colorways[0];
        if (!colorway) {
          return { ok: false, message: "Colorway unavailable." };
        }
        const availableStock = maxStock ?? colorway.stockBySize[size] ?? 0;
        if (availableStock <= 0) {
          return {
            ok: false,
            message: `Size EU ${size} in ${colorway.name} is currently out of stock.`,
          };
        }

        const itemId = `${product.id}__${colorway.id}__${size}`;
        const existing = get().items.find((i) => i.id === itemId);
        const targetQty = Math.min(availableStock, 5, (existing?.quantity ?? 0) + quantity);

        if (existing && targetQty === existing.quantity) {
          return {
            ok: false,
            message: `Maximum available pairs (${availableStock}) for EU ${size} already in bag.`,
          };
        }

        if (existing) {
          set({
            items: get().items.map((item) =>
              item.id === itemId ? { ...item, quantity: targetQty } : item,
            ),
          });
        } else {
          set({
            items: [
              ...get().items,
              {
                id: itemId,
                productId: product.id,
                productSlug: product.slug,
                productName: product.name,
                categoryName: product.categoryName,
                brand: product.brand,
                colorwayId: colorway.id,
                colorwayName: colorway.name,
                colorHex: colorway.hex,
                size,
                unitPriceETB: product.priceETB,
                compareAtPriceETB: product.compareAtPriceETB,
                quantity: targetQty,
                image: colorway.images[0] ?? "",
                badge: product.badges[0],
              },
            ],
          });
        }

        // Sync with backend /cart in background
        apiClient
          .post("/cart/items", {
            productId: product.id,
            colorwayId: colorway.id,
            size,
            quantity,
          })
          .catch(() => {});

        return {
          ok: true,
          message: `${product.name} (EU ${size}) added to your shopping bag.`,
        };
      },

      addAccessory: (accessory) => {
        const itemId = `acc__${accessory.id}`;
        const existing = get().items.find((i) => i.id === itemId);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.id === itemId ? { ...i, quantity: Math.min(5, i.quantity + 1) } : i,
            ),
          });
        } else {
          set({
            items: [
              ...get().items,
              {
                id: itemId,
                productId: accessory.id,
                productSlug: "shop",
                productName: accessory.name,
                categoryName: accessory.category,
                brand: "AddisGebeya Care",
                colorwayId: "standard",
                colorwayName: "Standard Edition",
                colorHex: "#14284B",
                size: 0,
                unitPriceETB: accessory.priceETB,
                quantity: 1,
                image: accessory.image,
                badge: accessory.badge,
                isAccessory: true,
              },
            ],
          });
        }
      },

      updateQuantity: (cartItemId, quantity, maxStock) => {
        if (quantity <= 0) {
          set({ items: get().items.filter((i) => i.id !== cartItemId) });
          apiClient.delete(`/cart/items/${cartItemId}`).catch(() => {});
          return;
        }
        const cap = maxStock !== undefined ? Math.min(5, maxStock) : 5;
        const clamped = Math.max(1, Math.min(cap, quantity));
        set({
          items: get().items.map((i) => (i.id === cartItemId ? { ...i, quantity: clamped } : i)),
        });

        // Sync with backend /cart in background
        apiClient.patch(`/cart/items/${cartItemId}`, { quantity: clamped }).catch(() => {});
      },

      removeItem: (cartItemId) => {
        set({ items: get().items.filter((i) => i.id !== cartItemId) });
        apiClient.delete(`/cart/items/${cartItemId}`).catch(() => {});
      },

      clearCart: () => {
        set({ items: [], appliedPromoCode: null, activePromo: null, deliverySpeed: "standard" });
        apiClient.delete("/cart").catch(() => {});
      },

      applyPromo: async (rawCode) => {
        const subtotal = get().items.reduce((sum, i) => sum + i.unitPriceETB * i.quantity, 0);
        const result = await storeService.validateCoupon(rawCode, subtotal);
        if (result.ok && result.promo) {
          set({ appliedPromoCode: result.promo.code, activePromo: result.promo });
        }
        return result;
      },

      removePromo: () => set({ appliedPromoCode: null, activePromo: null }),

      setDeliverySpeed: (deliverySpeed) => set({ deliverySpeed }),
    }),
    {
      name: "addisgebeya-cart-v2",
    },
  ),
);

export function computeCartTotals(
  items: CartItem[],
  appliedPromoCode: string | null,
  deliverySpeed: "standard" | "vip",
  freeThreshold = 0,
  standardFee = 0,
  vipFee = 450,
  activePromo?: PromoCode | null,
) {
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalETB = items.reduce((sum, i) => sum + i.unitPriceETB * i.quantity, 0);

  let discountETB = 0;
  if (activePromo && appliedPromoCode) {
    if (subtotalETB >= activePromo.minSubtotalETB) {
      if (activePromo.type === "percent") {
        discountETB = Math.round((subtotalETB * activePromo.value) / 100);
      } else {
        discountETB = activePromo.value;
      }
    }
  } else if (appliedPromoCode) {
    const code = appliedPromoCode.toUpperCase();
    if (code === "ADDISRUN" && subtotalETB >= 3000) {
      discountETB = Math.round(subtotalETB * 0.15);
    } else if (code === "WELCOME10") {
      discountETB = Math.round(subtotalETB * 0.1);
    } else if (code === "BOLEVIP" && subtotalETB >= 4000) {
      discountETB = Math.round(subtotalETB * 0.2);
    } else if (code === "FAST500" && subtotalETB >= 2500) {
      discountETB = 500;
    }
  }

  const deliveryFeeETB =
    itemCount === 0
      ? 0
      : deliverySpeed === "vip"
        ? vipFee
        : standardFee;

  const totalETB =
    itemCount === 0 ? 0 : Math.max(0, subtotalETB - discountETB + deliveryFeeETB);

  return {
    itemCount,
    subtotalETB,
    discountETB,
    deliveryFeeETB,
    totalETB,
    isFreeDelivery: deliveryFeeETB === 0,
    freeDeliveryThresholdRemaining: Math.max(0, freeThreshold - subtotalETB),
  };
}
