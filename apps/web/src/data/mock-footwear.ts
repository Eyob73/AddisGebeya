import type { ShoeProduct } from "@/types/store.types";

/**
 * Domain constants and footwear utility helpers for AddisGebeya.
 * All mock data has been purged; application data is retrieved live
 * from the Express backend APIs and persistent PostgreSQL database.
 */

export const EU_SIZES = [38, 39, 40, 41, 42, 43, 44, 45, 46] as const;

export const ADULT_EU_SIZES = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46] as const;

export const KIDS_EU_SIZES = [28, 29, 30, 31, 32, 33, 34, 35, 36] as const;

export const ALL_STANDARD_EU_SIZES = [
  28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46,
] as const;

export const HERO_ASSETS = {
  heroSneaker:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBwLZr76xncKZxFahMFMVAwOOCST7v9CA4GOr0W2qrPXa83HuDJqZ8eUOIxcvQw4re4VCalcBTPFDu3lm2TDSiOCkBZr657Ien8MKMIbvJYcIvm_IHVxcim0BvZmOV8K_dM4L8AMlexH4ojgXxJUvrvfG0JEJItxQ5G3r1GCdJDRbQIAtnUhLerk-Tw8AlwsEDTgyjn1xZ0_0AMAIWh9SL-dI9nvve1S4Ori228EQ",
  runLabBanner:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD3Qh2gZfLpvwAj8sp9pcwYbN21s9rPPBFnp0W0kMTJmzAgSYKegzPNLiK0FGGxGzOWAKA2gTy5up8Pcr2a6ypGVHETzVfLFz45CWslCo32Bt3f0xkIR2Y1JmTAU65M96m8wBAQnie2yU4ti9rbNZ72M7ESZAGcMz9dNAJw4jnZoKGmgAjTL_drkZr4F0S8TuDKTVF7pcwXHQNZdUCG6Q7tUpe7j1DIqRYsOceJIQ",
  techExploded:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCmlsAsYJxRo0iQktlPxAVCQzLGUezxtGezaqUKUqk_NEtsuxEQO_2mxwIgzwGdcPr0Z_NhehKeMdwobuJYbGYiISRJzi86upMKKG-cYrxtV0dP3LTSkrxTanOxWcCBB3ruYatNK0MZk-eaRMCjs_rl38mxuu3e00X8306yT9IZ3dU0E1EUKWtSN6qdbPOTSMas4QmYr9Vyv0xGOomsGk-VENwWFWNyIi3EMhbKkg",
};

export const ETHIOPIAN_CITIES = [
  "Addis Ababa",
  "Hawassa",
  "Adama (Nazret)",
  "Bahir Dar",
  "Dire Dawa",
  "Mekelle",
  "Gondar",
] as const;

export const ADDIS_SUBCITIES = [
  "Bole (Rwanda / Edna / Japan / Atlas)",
  "Kirkos (Kazanchis / Meskel Sq)",
  "Yeka (Megenagna / CMC / Ayat)",
  "Arada (Piazza / 4 Kilo)",
  "Nifas Silk - Lafto (Sarbet / Saris / Jemo)",
  "Lideta (Mexico / Balcha)",
  "Akaky Kaliti",
  "Kolfe Keranio",
  "Gulele",
  "Lemi Kura",
] as const;

export function getColorwayTotalStock(stockBySize: Record<number, number>): number {
  return Object.values(stockBySize).reduce((sum, count) => sum + Math.max(0, count), 0);
}

export function getProductTotalStock(product: ShoeProduct): number {
  return product.colorways.reduce((sum, cw) => sum + getColorwayTotalStock(cw.stockBySize), 0);
}

export function getAvailableSizesForProduct(product: ShoeProduct): number[] {
  const sizes = new Set<number>();
  for (const cw of product.colorways) {
    for (const [sizeStr, qty] of Object.entries(cw.stockBySize)) {
      if (qty > 0) sizes.add(Number(sizeStr));
    }
  }
  return Array.from(sizes).sort((a, b) => a - b);
}

/**
 * Returns every configured EU size key across all colorways of a product,
 * including out-of-stock (0 quantity) sizes so customers can see unavailable slots as disabled.
 */
export function getConfiguredSizesForProduct(product: ShoeProduct): number[] {
  const sizes = new Set<number>();
  for (const cw of product.colorways) {
    for (const sizeStr of Object.keys(cw.stockBySize)) {
      const parsed = Number(sizeStr);
      if (Number.isFinite(parsed) && parsed > 0) {
        sizes.add(parsed);
      }
    }
  }
  if (sizes.size === 0) {
    return [...EU_SIZES];
  }
  return Array.from(sizes).sort((a, b) => a - b);
}

export function getConfiguredSizesForColorway(
  stockBySize: Record<number, number>,
  fallbackSizes: number[] = [...EU_SIZES],
): number[] {
  const sizes = Object.keys(stockBySize)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  return sizes.length > 0 ? sizes : fallbackSizes;
}
