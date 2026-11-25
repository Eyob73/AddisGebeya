import type { Prisma } from "@prisma/client";

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    colorways: {
      include: {
        variants: true;
      };
    };
  };
}>;

interface RawProductImage {
  id: string;
  imageUrl: string;
  publicId?: string | null;
  colorwayId?: string | null;
  isPrimary?: boolean;
  displayOrder?: number;
}

export function mapProductToShoeProduct(product: ProductWithRelations) {
  const rawImages = ((product as unknown as { images?: RawProductImage[] }).images ?? []).map(
    (img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      publicId: img.publicId ?? "",
      colorwayId: img.colorwayId ?? undefined,
      isPrimary: Boolean(img.isPrimary),
      displayOrder: img.displayOrder ?? 0,
    }),
  );

  const generalImages = rawImages.filter((img) => !img.colorwayId);

  const colorways = product.colorways.map((cw, index) => {
    const stockBySize: Record<number, number> = {};
    let lowStockThreshold = 2;

    for (const v of cw.variants) {
      stockBySize[v.size] = v.stockQuantity;
      if (v.lowStockThreshold) {
        lowStockThreshold = v.lowStockThreshold;
      }
    }

    const cwImages = rawImages.filter((img) => img.colorwayId === cw.id);
    let resolvedImages = cw.images;
    if (cwImages.length > 0) {
      resolvedImages = cwImages.map((i) => i.imageUrl);
    } else if (index === 0 && generalImages.length > 0) {
      resolvedImages = generalImages.map((i) => i.imageUrl);
    }

    return {
      id: cw.id,
      name: cw.name,
      hex: cw.hex,
      secondaryHex: cw.secondaryHex ?? undefined,
      soleHex: cw.soleHex ?? undefined,
      images: resolvedImages,
      stockBySize,
      lowStockThreshold,
    };
  });

  const defaultSpecs = {
    upperMesh: "Jacquard Air-Flow & Ethiopian Leather",
    cushioning: "NitroPro Supercritical Foam",
    outsoleGrip: "Entoto Multi-Terrain Rubber Grip",
    weightGrams: 265,
    heelDropMm: 8,
    fitAdvice: "Fits true to size. Order your standard European size.",
    materials: ["78% Recycled Poly Yarn", "Ethiopian Calfskin", "High-Traction Rubber"],
  };

  const specs =
    product.specs && typeof product.specs === "object"
      ? { ...defaultSpecs, ...(product.specs as Record<string, unknown>) }
      : defaultSpecs;

  const material =
    product.material && product.material.trim().length > 0
      ? product.material
      : Array.isArray(specs.materials) && specs.materials.length > 0
        ? specs.materials.join(", ")
        : "";

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    categorySlug: product.category.slug,
    categoryName: product.category.name,
    gender: product.gender as "Men" | "Women" | "Unisex" | "Kids",
    shoeType: product.shoeType || "Sneakers",
    material,
    tagline: product.tagline ?? "",
    description: product.description,
    priceETB: Number(product.priceETB),
    compareAtPriceETB: product.compareAtPriceETB ? Number(product.compareAtPriceETB) : undefined,
    cogsETB: product.cogsETB ? Number(product.cogsETB) : undefined,
    rating: product.rating,
    reviewCount: product.reviewCount,
    badges: product.badges,
    status: product.status as "active" | "draft" | "archived",
    featuredTrending: product.featuredTrending,
    featuredNewDrop: product.featuredNewDrop,
    isOnSale: product.isOnSale,
    freeAddisDelivery: product.freeAddisDelivery,
    reserveShowroomPairs: product.reserveShowroomPairs,
    dispatchDepot: product.dispatchDepot ?? "Bole Medhanialem Flagship Hub",
    colorways,
    productImages: rawImages,
    specs,
    createdAt: product.createdAt.toISOString(),
  };
}
