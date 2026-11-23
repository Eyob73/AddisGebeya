import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistState {
  productIds: string[];
  toggle: (productId: string) => boolean;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: ["prod-bole-court", "prod-velocity-nitro", "prod-chelsea-boot"],
      toggle: (productId) => {
        const exists = get().productIds.includes(productId);
        if (exists) {
          set({ productIds: get().productIds.filter((id) => id !== productId) });
          return false;
        }
        set({ productIds: [...get().productIds, productId] });
        return true;
      },
      remove: (productId) =>
        set({ productIds: get().productIds.filter((id) => id !== productId) }),
      has: (productId) => get().productIds.includes(productId),
      clear: () => set({ productIds: [] }),
    }),
    {
      name: "addisgebeya-wishlist-v1",
    },
  ),
);

