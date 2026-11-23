import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PROMO_CODES } from "@/data/mock-footwear";
import type { AccessoryItem, CartItem, PromoCode, ShoeProduct } from "@/types/store.types";

const INITIAL_CART_ITEMS: CartItem[] = [
  {
    id: "prod-velocity-nitro__cw-vn-teal__42",
    productId: "prod-velocity-nitro",
    productSlug: "addis-velocity-pro-nitro",
    productName: "Addis Velocity Pro Nitro 2.0",
    categoryName: "Road Running / Performance",
    brand: "Addis Performance Lab",
    colorwayId: "cw-vn-teal",
    colorwayName: "Highland Forest Teal / Sunset Clay",
    colorHex: "#0E5A6B",
    size: 42,
    unitPriceETB: 5850,
    compareAtPriceETB: 6900,
    quantity: 1,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAnX2Ac09Qjbv2Q6v87-MUoBmOkIOWFc23JeLu4nVp53yHvWTT4dUCtpqV9M-PYpv-Y6JjDy67sXay4HwAsbCqXvfISYR20LotiQmX-ttGjZt4oGkzcWMx3bJUFYOxIp4YzBs63IOfgUSIIzzVUwZhwmq1C36lANxk0IcWdnASse1Pt6VwUbvVce0UGbGGJ52gVso8-loWMNNPAEjC97ci5RY8--BjzYiRJ4sDBrg",
    badge: "New Drop",
  },
  {
    id: "prod-bole-court__cw-bc-chalk__41",
    productId: "prod-bole-court",
    productSlug: "bole-court-vintage-sneaker",
    productName: "Bole Court Vintage Sneaker",
    categoryName: "Lifestyle Heritage",
    brand: "Bole Heritage Series",
    colorwayId: "cw-bc-chalk",
    colorwayName: "Chalk White / Burnt Orange",
    colorHex: "#FFFFFF",
    size: 41,
    unitPriceETB: 4200,
    compareAtPriceETB: 4800,
    quantity: 1,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBBDvIcAZs_SRRtPiH1MTJRm7HXiR9aow2XQVgq_GK43lmFyFsLh48W6FBI2uLDbV8_vX3lotwSbJwD9V3kJvSpRhqvyBJynwcnHR5JDRyamqloVAvI8ZiDnDIkCLk2ulNAHDeGVSF6VfcmvxWsYlcbGeSQGJlNwJ7hdQ90fgTwKOH75nhLFRTxf20nic-MgCU2qWXsbYkt9T-KjzthnyDsgV0RHF82CxIsEZespA",
    badge: "Sale -12%",
  },
];

interface CartState {
  items: CartItem[];
  appliedPromoCode: string | null;
  deliverySpeed: "standard" | "vip";
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
  applyPromo: (code: string) => { ok: boolean; message: string; promo?: PromoCode };
  removePromo: () => void;
  setDeliverySpeed: (speed: "standard" | "vip") => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: INITIAL_CART_ITEMS,
      appliedPromoCode: "ADDISRUN",
      deliverySpeed: "standard",

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
          const newItem: CartItem = {
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
          };
          set({ items: [...get().items, newItem] });
        }

        return {
          ok: true,
          message: `Added ${product.name} (EU ${size}) to your bag.`,
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
                colorHex: "#0E5A6B",
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
          return;
        }
        const cap = maxStock !== undefined ? Math.min(5, maxStock) : 5;
        const clamped = Math.max(1, Math.min(cap, quantity));
        set({
          items: get().items.map((i) => (i.id === cartItemId ? { ...i, quantity: clamped } : i)),
        });
      },

      removeItem: (cartItemId) => {
        set({ items: get().items.filter((i) => i.id !== cartItemId) });
      },

      clearCart: () => set({ items: [], appliedPromoCode: null, deliverySpeed: "standard" }),

      applyPromo: (rawCode) => {
        const normalized = rawCode.trim().toUpperCase();
        const promo = PROMO_CODES.find((p) => p.code === normalized);
        if (!promo) {
          return {
            ok: false,
            message: "Invalid voucher code. Try ADDISRUN, WELCOME10, or VIP15.",
          };
        }
        const subtotal = get().items.reduce((sum, i) => sum + i.unitPriceETB * i.quantity, 0);
        if (subtotal < promo.minSubtotalETB) {
          return {
            ok: false,
            message: `Code ${promo.code} requires a minimum subtotal of ${promo.minSubtotalETB.toLocaleString()} ETB.`,
          };
        }
        set({ appliedPromoCode: promo.code });
        return { ok: true, message: `Coupon ${promo.code} applied: ${promo.description}!`, promo };
      },

      removePromo: () => set({ appliedPromoCode: null }),

      setDeliverySpeed: (deliverySpeed) => set({ deliverySpeed }),
    }),
    {
      name: "addisgebeya-cart-v1",
    },
  ),
);

export function computeCartTotals(
  items: CartItem[],
  appliedPromoCode: string | null,
  deliverySpeed: "standard" | "vip",
  freeThreshold = 3500,
  standardFee = 200,
  vipFee = 250,
) {
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalETB = items.reduce((sum, i) => sum + i.unitPriceETB * i.quantity, 0);

  let discountETB = 0;
  const activePromo = appliedPromoCode
    ? PROMO_CODES.find((p) => p.code === appliedPromoCode)
    : undefined;

  if (activePromo && subtotalETB >= activePromo.minSubtotalETB) {
    discountETB =
      activePromo.type === "fixed"
        ? activePromo.value
        : Math.round((subtotalETB * activePromo.value) / 100);
  }

  const afterDiscount = Math.max(0, subtotalETB - discountETB);
  const qualifiesForFreeDelivery = subtotalETB >= freeThreshold;
  const deliveryFeeETB =
    itemCount === 0
      ? 0
      : deliverySpeed === "vip"
        ? vipFee
        : qualifiesForFreeDelivery
          ? 0
          : standardFee;

  const totalETB = afterDiscount + deliveryFeeETB;
  const amountToFreeDelivery = Math.max(0, freeThreshold - subtotalETB);
  const freeDeliveryProgress = Math.min(100, Math.round((subtotalETB / freeThreshold) * 100));

  return {
    itemCount,
    subtotalETB,
    discountETB,
    activePromo,
    deliveryFeeETB,
    totalETB,
    qualifiesForFreeDelivery,
    amountToFreeDelivery,
    freeDeliveryProgress,
  };
}

