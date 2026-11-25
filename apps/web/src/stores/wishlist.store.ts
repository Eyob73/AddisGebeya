import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "@/lib/api-client";

interface WishlistState {
  productIds: string[];
  isSyncing: boolean;
  syncFromBackend: () => Promise<void>;
  toggle: (productId: string) => boolean;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],
      isSyncing: false,

      syncFromBackend: async () => {
        if (get().isSyncing) return;
        set({ isSyncing: true });
        try {
          const res = await apiClient.get<{ productIds: string[] }>("/wishlist");
          if (res?.productIds && Array.isArray(res.productIds)) {
            // Merge with local productIds to avoid losing unsaved items
            const merged = Array.from(new Set([...get().productIds, ...res.productIds]));
            set({ productIds: merged });
          }
        } catch {
          // Keep local wishlist if offline
        } finally {
          set({ isSyncing: false });
        }
      },

      toggle: (productId) => {
        const exists = get().productIds.includes(productId);
        if (exists) {
          const updated = get().productIds.filter((id) => id !== productId);
          set({ productIds: updated });
          apiClient
            .post<{ added: boolean; productIds: string[] }>("/wishlist/toggle", { productId })
            .catch(() => {});
          return false;
        } else {
          const updated = [...get().productIds, productId];
          set({ productIds: updated });
          apiClient
            .post<{ added: boolean; productIds: string[] }>("/wishlist/toggle", { productId })
            .then((res) => {
              if (res?.productIds) {
                set({ productIds: res.productIds });
              }
            })
            .catch(() => {});
          return true;
        }
      },

      remove: (productId) => {
        set({ productIds: get().productIds.filter((id) => id !== productId) });
        apiClient.delete(`/wishlist/${productId}`).catch(() => {});
      },

      has: (productId) => get().productIds.includes(productId),

      clear: () => {
        set({ productIds: [] });
        apiClient.delete("/wishlist").catch(() => {});
      },
    }),
    {
      name: "addisgebeya-wishlist-v2",
    },
  ),
);
