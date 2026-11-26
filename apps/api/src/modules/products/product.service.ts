import { HTTP_STATUS } from "@addisgebeya/shared";
import { createProductSchema, updateProductSchema } from "@addisgebeya/validation";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { mapProductToShoeProduct } from "./product.mapper.js";
import { cloudinaryService } from "../media/cloudinary.service.js";
import { notificationService } from "../notifications/notification.service.js";

export interface ProductFilters {
  search?: string;
  categorySlug?: string;
  gender?: string;
  shoeType?: string;
  status?: string;
  brand?: string;
  size?: number;
  colorHex?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  sortBy?: "featured" | "newest" | "best_selling" | "price_low" | "price_high" | "rating";
}

function inferShoeTypeFromCategory(categorySlug?: string): string {
  switch (categorySlug) {
    case "running":
      return "Running";
    case "formal-leather":
    case "ethiopian-leather":
      return "Formal";
    case "casual-loafers":
      return "Casual";
    case "boots":
      return "Boots";
    case "sandals":
      return "Sandals";
    case "court":
      return "Sports";
    default:
      return "Sneakers";
  }
}

export class ProductService {
  async listProducts(filters: ProductFilters = {}) {
    const products = await prisma.product.findMany({
      where:
        filters.status === "all"
          ? {}
          : {
              status: filters.status || "active",
            },
      include: {
        category: true,
        images: {
          orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
        },
        colorways: {
          orderBy: { createdAt: "asc" },
          include: {
            variants: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let mapped = products.map(mapProductToShoeProduct);

    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      mapped = mapped.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.shoeType.toLowerCase().includes(q) ||
          p.material.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      );
    }

    if (filters.categorySlug && filters.categorySlug !== "all") {
      if (filters.categorySlug === "men") {
        mapped = mapped.filter((p) => p.gender === "Men" || p.gender === "Unisex");
      } else if (filters.categorySlug === "women") {
        mapped = mapped.filter((p) => p.gender === "Women" || p.gender === "Unisex");
      } else if (filters.categorySlug === "kids") {
        mapped = mapped.filter((p) => p.gender === "Kids");
      } else if (filters.categorySlug === "new-arrivals") {
        mapped = mapped.filter((p) => Boolean(p.featuredNewDrop));
      } else if (filters.categorySlug === "sale") {
        mapped = mapped.filter((p) => Boolean(p.isOnSale || p.compareAtPriceETB));
      } else {
        mapped = mapped.filter((p) => p.categorySlug === filters.categorySlug);
      }
    }

    if (filters.gender && filters.gender !== "All") {
      if (filters.gender === "Kids") {
        mapped = mapped.filter((p) => p.gender === "Kids");
      } else if (filters.gender === "Unisex") {
        mapped = mapped.filter((p) => p.gender === "Unisex");
      } else {
        mapped = mapped.filter((p) => p.gender === filters.gender || p.gender === "Unisex");
      }
    }

    if (filters.shoeType && filters.shoeType !== "All") {
      const targetType = filters.shoeType.trim().toLowerCase();
      mapped = mapped.filter((p) => p.shoeType.toLowerCase() === targetType);
    }

    if (filters.brand && filters.brand !== "All") {
      mapped = mapped.filter((p) => p.brand === filters.brand);
    }

    if (filters.size) {
      mapped = mapped.filter((p) =>
        p.colorways.some((cw) => (cw.stockBySize[filters.size!] ?? 0) > 0),
      );
    }

    if (filters.colorHex) {
      const target = filters.colorHex.toLowerCase();
      mapped = mapped.filter((p) =>
        p.colorways.some(
          (cw) =>
            cw.hex.toLowerCase() === target ||
            cw.secondaryHex?.toLowerCase() === target ||
            cw.name.toLowerCase().includes(target),
        ),
      );
    }

    if (filters.minPrice !== undefined) {
      mapped = mapped.filter((p) => p.priceETB >= filters.minPrice!);
    }

    if (filters.maxPrice !== undefined) {
      mapped = mapped.filter((p) => p.priceETB <= filters.maxPrice!);
    }

    if (filters.inStockOnly) {
      mapped = mapped.filter((p) => {
        const total = p.colorways.reduce(
          (acc, cw) => acc + Object.values(cw.stockBySize).reduce((s, v) => s + v, 0),
          0,
        );
        return total > 0;
      });
    }

    if (filters.onSaleOnly) {
      mapped = mapped.filter((p) => Boolean(p.isOnSale || p.compareAtPriceETB));
    }

    switch (filters.sortBy) {
      case "price_low":
        mapped.sort((a, b) => a.priceETB - b.priceETB);
        break;
      case "price_high":
        mapped.sort((a, b) => b.priceETB - a.priceETB);
        break;
      case "rating":
        mapped.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
        break;
      case "newest":
        mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "best_selling":
        mapped.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      default:
        mapped.sort(
          (a, b) => Number(Boolean(b.featuredTrending)) - Number(Boolean(a.featuredTrending)),
        );
    }

    return mapped;
  }

  async getProductBySlug(slug: string) {
    const product = await prisma.product.findFirst({
      where: {
        OR: [{ slug }, { id: slug }],
      },
      include: {
        category: true,
        images: {
          orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
        },
        colorways: {
          orderBy: { createdAt: "asc" },
          include: {
            variants: true,
          },
        },
      },
    });

    if (!product) {
      throw new AppError({
        message: `Product not found with slug or ID "${slug}"`,
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PRODUCT_NOT_FOUND",
      });
    }

    return mapProductToShoeProduct(product);
  }

  async createProduct(rawData: Record<string, unknown>) {
    const data = createProductSchema.parse(rawData);

    let categoryId = data.categoryId;
    let resolvedCategorySlug = data.categorySlug;
    if (!categoryId && data.categorySlug) {
      const cat = await prisma.category.findUnique({ where: { slug: data.categorySlug } });
      if (cat) {
        categoryId = cat.id;
        resolvedCategorySlug = cat.slug;
      }
    }
    if (!categoryId) {
      const firstCat = await prisma.category.findFirst();
      categoryId = firstCat?.id;
      resolvedCategorySlug = firstCat?.slug;
    }

    if (!categoryId) {
      throw new AppError({
        message: "No category found to associate with the footwear model.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_CATEGORY",
      });
    }

    const productId = data.id || `prod-${Date.now()}`;
    let slug =
      data.slug ||
      `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "shoe"}-${Date.now()}`;
    let sku = data.sku || `AG-SKU-${Math.floor(1000 + Math.random() * 9000)}`;

    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const existingSku = await prisma.product.findUnique({ where: { sku } });
    if (existingSku) {
      sku = `${sku}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const compareAt =
      data.compareAtPriceETB && Number(data.compareAtPriceETB) > Number(data.priceETB)
        ? Number(data.compareAtPriceETB)
        : null;
    const isOnSale = Boolean(data.isOnSale || (compareAt && compareAt > Number(data.priceETB)));

    const specsRecord =
      data.specs && typeof data.specs === "object"
        ? { ...(data.specs as Record<string, unknown>) }
        : {};
    const materialValue = data.material?.trim() || "";
    if (materialValue && (!Array.isArray(specsRecord.materials) || specsRecord.materials.length === 0)) {
      specsRecord.materials = materialValue
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
    }

    const resolvedShoeType =
      data.shoeType?.trim() || inferShoeTypeFromCategory(resolvedCategorySlug);

    const created = await prisma.product.create({
      data: {
        id: productId,
        slug,
        sku,
        name: data.name,
        brand: data.brand || "AddisGebeya",
        categoryId,
        gender: data.gender || "Unisex",
        shoeType: resolvedShoeType,
        material: materialValue || null,
        tagline: data.tagline || "",
        description: data.description || "",
        priceETB: Number(data.priceETB),
        compareAtPriceETB: compareAt,
        cogsETB: data.cogsETB ? Number(data.cogsETB) : null,
        rating: Number(rawData.rating) || 5.0,
        reviewCount: Number(rawData.reviewCount) || 0,
        badges: Array.isArray(data.badges) ? data.badges : [],
        status: data.status || "active",
        featuredTrending: Boolean(data.featuredTrending),
        featuredNewDrop: Boolean(data.featuredNewDrop),
        isOnSale,
        freeAddisDelivery:
          data.freeAddisDelivery !== undefined ? Boolean(data.freeAddisDelivery) : true,
        reserveShowroomPairs:
          data.reserveShowroomPairs !== undefined ? Boolean(data.reserveShowroomPairs) : true,
        dispatchDepot: data.dispatchDepot || "Bole Medhanialem Flagship Hub (Primary)",
        specs: Object.keys(specsRecord).length > 0 ? (specsRecord as object) : undefined,
        colorways: {
          create: data.colorways.map((cw, index) => {
            const colorwayId = cw.id || `cw-${Date.now()}-${index}`;
            return {
              id: colorwayId,
              name: cw.name || "Standard Colorway",
              hex: cw.hex || "#000000",
              secondaryHex: cw.secondaryHex || null,
              soleHex: cw.soleHex || null,
              images: Array.isArray(cw.images) ? cw.images : [],
              variants: {
                create: Object.entries(cw.stockBySize || {}).map(([size, qty]) => ({
                  productId,
                  size: Number(size),
                  stockQuantity: Math.max(0, Math.floor(Number(qty) || 0)),
                  lowStockThreshold: Number(cw.lowStockThreshold) || 2,
                  sku: `${sku}-${index + 1}-${size}`,
                })),
              },
            };
          }),
        },
      },
      include: {
        category: true,
        images: {
          orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
        },
        colorways: {
          orderBy: { createdAt: "asc" },
          include: {
            variants: true,
          },
        },
      },
    });

    return mapProductToShoeProduct(created);
  }

  async updateSizeStock(productId: string, colorwayId: string, size: number, quantity: number) {
    const nextStock = Math.max(0, Math.floor(quantity));

    const variant = await prisma.$transaction(async (tx) => {
      const existingVariant = await tx.productVariant.findUnique({
        where: {
          colorwayId_size: {
            colorwayId,
            size,
          },
        },
        include: {
          product: { select: { name: true, sku: true } },
          colorway: { select: { name: true } },
        },
      });

      const updated = await tx.productVariant.upsert({
        where: {
          colorwayId_size: {
            colorwayId,
            size,
          },
        },
        update: {
          stockQuantity: nextStock,
        },
        create: {
          productId,
          colorwayId,
          size,
          stockQuantity: nextStock,
        },
        include: {
          product: { select: { name: true, sku: true } },
          colorway: { select: { name: true } },
        },
      });

      const prevStock = existingVariant?.stockQuantity ?? null;
      const threshold = updated.lowStockThreshold;
      const productName = updated.product?.name ?? "Product";
      const colorwayName = updated.colorway?.name ?? "Colorway";
      const sku = updated.sku ?? updated.product?.sku ?? productId;

      if (nextStock === 0 && (prevStock === null || prevStock > 0)) {
        await notificationService.notifyAdmins(
          {
            title: `Out of Stock — ${productName}`,
            message: `${productName} (${colorwayName}, EU ${size}) is now out of stock (0 pairs remaining).`,
            type: "admin_inventory_out_of_stock",
            relatedEntityId: productId,
            relatedEntityType: "product",
            metadata: {
              productId,
              variantId: updated.id,
              sku,
              colorwayName,
              size,
              stockQuantity: 0,
              lowStockThreshold: threshold,
            },
            idempotencyKey: `admin-inventory-oos:${updated.id}:${updated.updatedAt.getTime()}`,
          },
          tx,
        );
      } else if (
        nextStock > 0 &&
        nextStock <= threshold &&
        (prevStock === null || prevStock > threshold)
      ) {
        await notificationService.notifyAdmins(
          {
            title: `Low Stock Alert — ${productName}`,
            message: `${productName} (${colorwayName}, EU ${size}) reached low-stock threshold (${nextStock} pair(s) remaining; threshold: ${threshold}).`,
            type: "admin_inventory_low_stock",
            relatedEntityId: productId,
            relatedEntityType: "product",
            metadata: {
              productId,
              variantId: updated.id,
              sku,
              colorwayName,
              size,
              stockQuantity: nextStock,
              lowStockThreshold: threshold,
            },
            idempotencyKey: `admin-inventory-low:${updated.id}:${updated.updatedAt.getTime()}`,
          },
          tx,
        );
      }

      return updated;
    });

    void notificationService.flushOutbox();

    return variant;
  }

  async bulkRestock(productId: string, colorwayId: string, stockBySize: Record<number, number>) {
    for (const [sizeStr, qty] of Object.entries(stockBySize)) {
      const size = Number(sizeStr);
      await this.updateSizeStock(productId, colorwayId, size, qty);
    }
    return { success: true };
  }

  async updateProduct(id: string, rawPatch: Record<string, unknown>) {
    const patch = updateProductSchema.parse(rawPatch);

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { colorways: true },
    });

    if (!existingProduct) {
      throw new AppError({
        message: "Product not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PRODUCT_NOT_FOUND",
      });
    }

    const effectivePrice =
      patch.priceETB !== undefined ? Number(patch.priceETB) : Number(existingProduct.priceETB);
    if (
      patch.compareAtPriceETB !== undefined &&
      patch.compareAtPriceETB !== null &&
      Number(patch.compareAtPriceETB) > 0 &&
      Number(patch.compareAtPriceETB) < effectivePrice
    ) {
      throw new AppError({
        message: "Original / compare-at price must be greater than or equal to the selling price",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_DISCOUNT_PRICE",
      });
    }

    let categoryId: string | undefined;
    if (patch.categoryId) {
      categoryId = patch.categoryId;
    } else if (patch.categorySlug) {
      const cat = await prisma.category.findUnique({ where: { slug: patch.categorySlug } });
      if (cat) categoryId = cat.id;
    }

    const specsRecord =
      patch.specs && typeof patch.specs === "object"
        ? { ...(patch.specs as Record<string, unknown>) }
        : undefined;
    if (
      patch.material !== undefined &&
      patch.material !== null &&
      specsRecord &&
      (!Array.isArray(specsRecord.materials) || specsRecord.materials.length === 0)
    ) {
      specsRecord.materials = patch.material
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(patch.colorways) && patch.colorways.length > 0) {
        const existingCwMap = new Map(existingProduct.colorways.map((cw) => [cw.id, cw]));
        const retainedIds = new Set<string>();

        for (const cw of patch.colorways) {
          if (cw.id && existingCwMap.has(cw.id)) {
            retainedIds.add(cw.id);
          }
        }

        // Remove colorways that were deleted in the admin form
        const toDeleteIds = existingProduct.colorways
          .filter((cw) => !retainedIds.has(cw.id))
          .map((cw) => cw.id);

        if (toDeleteIds.length > 0) {
          await tx.productColorway.deleteMany({
            where: {
              productId: id,
              id: { in: toDeleteIds },
            },
          });
        }

        const effectiveSku = patch.sku ?? existingProduct.sku;

        for (let idx = 0; idx < patch.colorways.length; idx++) {
          const cw = patch.colorways[idx]!;
          const sizeEntries = Object.entries(cw.stockBySize || {});
          const incomingSizes = sizeEntries.map(([s]) => Number(s)).filter((s) => Number.isFinite(s));

          if (cw.id && existingCwMap.has(cw.id)) {
            await tx.productColorway.update({
              where: { id: cw.id },
              data: {
                name: cw.name ?? undefined,
                hex: cw.hex ?? undefined,
                secondaryHex:
                  cw.secondaryHex !== undefined ? cw.secondaryHex || null : undefined,
                soleHex: cw.soleHex !== undefined ? cw.soleHex || null : undefined,
                images: Array.isArray(cw.images) ? cw.images : undefined,
              },
            });

            // Remove sizes no longer configured for this colorway
            await tx.productVariant.deleteMany({
              where: {
                colorwayId: cw.id,
                size: { notIn: incomingSizes },
              },
            });

            for (const [sizeStr, qty] of sizeEntries) {
              const sizeNum = Number(sizeStr);
              const nextStock = Math.max(0, Math.floor(Number(qty) || 0));
              const nextThreshold = cw.lowStockThreshold ?? 2;
              const prevVariant = await tx.productVariant.findUnique({
                where: {
                  colorwayId_size: {
                    colorwayId: cw.id,
                    size: sizeNum,
                  },
                },
                select: { id: true, stockQuantity: true, lowStockThreshold: true, sku: true },
              });

              const upsertedVariant = await tx.productVariant.upsert({
                where: {
                  colorwayId_size: {
                    colorwayId: cw.id,
                    size: sizeNum,
                  },
                },
                update: {
                  stockQuantity: nextStock,
                  lowStockThreshold: nextThreshold,
                },
                create: {
                  productId: id,
                  colorwayId: cw.id,
                  size: sizeNum,
                  stockQuantity: nextStock,
                  lowStockThreshold: nextThreshold,
                  sku: `${effectiveSku}-${idx + 1}-${sizeNum}`,
                },
              });

              const prevStock = prevVariant?.stockQuantity ?? null;
              const effectiveName = patch.name ?? existingProduct.name;
              const effectiveCwName = cw.name || "Colorway";
              if (nextStock === 0 && (prevStock === null || prevStock > 0)) {
                await notificationService.notifyAdmins(
                  {
                    title: `Out of Stock — ${effectiveName}`,
                    message: `${effectiveName} (${effectiveCwName}, EU ${sizeNum}) is now out of stock (0 pairs remaining).`,
                    type: "admin_inventory_out_of_stock",
                    relatedEntityId: id,
                    relatedEntityType: "product",
                    metadata: {
                      productId: id,
                      variantId: upsertedVariant.id,
                      sku: upsertedVariant.sku ?? effectiveSku,
                      colorwayName: effectiveCwName,
                      size: sizeNum,
                      stockQuantity: 0,
                      lowStockThreshold: nextThreshold,
                    },
                    idempotencyKey: `admin-inventory-oos:${upsertedVariant.id}:${upsertedVariant.updatedAt.getTime()}`,
                  },
                  tx,
                );
              } else if (
                nextStock > 0 &&
                nextStock <= nextThreshold &&
                (prevStock === null || prevStock > nextThreshold)
              ) {
                await notificationService.notifyAdmins(
                  {
                    title: `Low Stock Alert — ${effectiveName}`,
                    message: `${effectiveName} (${effectiveCwName}, EU ${sizeNum}) reached low-stock threshold (${nextStock} pair(s) remaining; threshold: ${nextThreshold}).`,
                    type: "admin_inventory_low_stock",
                    relatedEntityId: id,
                    relatedEntityType: "product",
                    metadata: {
                      productId: id,
                      variantId: upsertedVariant.id,
                      sku: upsertedVariant.sku ?? effectiveSku,
                      colorwayName: effectiveCwName,
                      size: sizeNum,
                      stockQuantity: nextStock,
                      lowStockThreshold: nextThreshold,
                    },
                    idempotencyKey: `admin-inventory-low:${upsertedVariant.id}:${upsertedVariant.updatedAt.getTime()}`,
                  },
                  tx,
                );
              }
            }
          } else {
            const newColorwayId =
              cw.id && !cw.id.startsWith("tmp-") ? cw.id : `cw-${Date.now()}-${idx}`;
            await tx.productColorway.create({
              data: {
                id: newColorwayId,
                productId: id,
                name: cw.name || "Standard Colorway",
                hex: cw.hex || "#000000",
                secondaryHex: cw.secondaryHex || null,
                soleHex: cw.soleHex || null,
                images: Array.isArray(cw.images) ? cw.images : [],
                variants: {
                  create: sizeEntries.map(([sizeStr, qty]) => ({
                    productId: id,
                    size: Number(sizeStr),
                    stockQuantity: Math.max(0, Math.floor(Number(qty) || 0)),
                    lowStockThreshold: cw.lowStockThreshold ?? 2,
                    sku: `${effectiveSku}-${idx + 1}-${sizeStr}`,
                  })),
                },
              },
            });
          }
        }
      }

      const nextCompare =
        patch.compareAtPriceETB !== undefined
          ? patch.compareAtPriceETB && Number(patch.compareAtPriceETB) > effectivePrice
            ? Number(patch.compareAtPriceETB)
            : null
          : undefined;

      const nextIsOnSale =
        patch.isOnSale !== undefined
          ? Boolean(patch.isOnSale)
          : nextCompare !== undefined
            ? Boolean(nextCompare && nextCompare > effectivePrice)
            : undefined;

      return tx.product.update({
        where: { id },
        data: {
          name: patch.name,
          sku: patch.sku,
          brand: patch.brand,
          gender: patch.gender,
          shoeType: patch.shoeType,
          material:
            patch.material !== undefined ? patch.material?.trim() || null : undefined,
          categoryId: categoryId ?? undefined,
          priceETB: patch.priceETB !== undefined ? Number(patch.priceETB) : undefined,
          compareAtPriceETB: nextCompare,
          cogsETB:
            patch.cogsETB !== undefined
              ? patch.cogsETB
                ? Number(patch.cogsETB)
                : null
              : undefined,
          tagline: patch.tagline,
          description: patch.description,
          badges: Array.isArray(patch.badges) ? patch.badges : undefined,
          status: patch.status,
          featuredTrending:
            patch.featuredTrending !== undefined ? Boolean(patch.featuredTrending) : undefined,
          featuredNewDrop:
            patch.featuredNewDrop !== undefined ? Boolean(patch.featuredNewDrop) : undefined,
          isOnSale: nextIsOnSale,
          freeAddisDelivery:
            patch.freeAddisDelivery !== undefined ? Boolean(patch.freeAddisDelivery) : undefined,
          reserveShowroomPairs:
            patch.reserveShowroomPairs !== undefined
              ? Boolean(patch.reserveShowroomPairs)
              : undefined,
          dispatchDepot: patch.dispatchDepot,
          specs: specsRecord ? (specsRecord as object) : undefined,
        },
        include: {
          category: true,
          images: {
            orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
          },
          colorways: {
            orderBy: { createdAt: "asc" },
            include: {
              variants: true,
            },
          },
        },
      });
    });

    void notificationService.flushOutbox();

    return mapProductToShoeProduct(updated);
  }

  async deleteProduct(id: string) {
    const images = await prisma.productImage.findMany({ where: { productId: id } });
    for (const img of images) {
      if (img.publicId) {
        await cloudinaryService.deleteImage(img.publicId).catch(() => {});
      }
    }
    await prisma.product.delete({ where: { id } });
    return { deleted: true };
  }

  async getProductImages(productId: string) {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: productId }, { slug: productId }] },
    });
    if (!product) {
      throw new AppError({
        message: "Product not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PRODUCT_NOT_FOUND",
      });
    }

    const images = await prisma.productImage.findMany({
      where: { productId: product.id },
      orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
    });

    return images.map((img) => ({
      id: img.id,
      productId: img.productId,
      colorwayId: img.colorwayId ?? undefined,
      imageUrl: img.imageUrl,
      publicId: img.publicId ?? "",
      isPrimary: img.isPrimary,
      altText: img.altText,
      displayOrder: img.displayOrder,
      createdAt: img.createdAt,
    }));
  }

  async uploadProductImages(
    productId: string,
    files: Array<{ buffer: Buffer; originalname: string }>,
    isPrimary?: boolean,
    primaryIndex?: number,
    colorwayId?: string,
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { colorways: true },
    });
    if (!product) {
      throw new AppError({
        message: "Product not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PRODUCT_NOT_FOUND",
      });
    }

    let validColorwayId: string | null = null;
    if (colorwayId) {
      const cw = product.colorways.find((c) => c.id === colorwayId);
      if (!cw) {
        throw new AppError({
          message: "Selected colorway does not belong to this product",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "INVALID_COLORWAY",
        });
      }
      validColorwayId = cw.id;
    }

    const existingImages = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { displayOrder: "desc" },
    });

    if (existingImages.length + files.length > 8) {
      throw new AppError({
        message: `Maximum 8 images allowed per product. Currently has ${existingImages.length} images; cannot add ${files.length} more.`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "MAX_IMAGES_EXCEEDED",
      });
    }

    let maxOrder =
      existingImages.length > 0 && existingImages[0] ? existingImages[0].displayOrder : -1;
    const hasPrimary = existingImages.some((img) => img.isPrimary);

    const uploaded = await cloudinaryService.uploadMultiple(
      files,
      "addisgebeya/products",
      `prod_${productId.slice(0, 8)}`,
    );

    const targetPrimaryIdx =
      primaryIndex !== undefined && primaryIndex >= 0 && primaryIndex < uploaded.length
        ? primaryIndex
        : 0;

    const createdImages = [];
    for (let i = 0; i < uploaded.length; i++) {
      const asset = uploaded[i];
      if (!asset) continue;
      const shouldBePrimary =
        primaryIndex !== undefined
          ? i === targetPrimaryIdx
          : isPrimary
            ? i === 0
            : !hasPrimary && i === 0;

      if (shouldBePrimary) {
        await prisma.productImage.updateMany({
          where: { productId },
          data: { isPrimary: false },
        });
      }

      maxOrder += 1;
      const img = await prisma.productImage.create({
        data: {
          productId,
          colorwayId: validColorwayId,
          imageUrl: asset.secureUrl,
          publicId: asset.publicId,
          isPrimary: shouldBePrimary,
          altText: `${product.name} studio angle ${maxOrder + 1}`,
          displayOrder: maxOrder,
        },
      });
      createdImages.push({
        ...img,
        colorwayId: img.colorwayId ?? undefined,
      });
    }

    await this.syncColorwayImages(productId);

    return createdImages;
  }

  async replaceProductImage(
    productId: string,
    imageId: string,
    file: { buffer: Buffer; originalname: string },
  ) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError({
        message: "Product not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PRODUCT_NOT_FOUND",
      });
    }

    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== productId) {
      throw new AppError({
        message: "Image not found for this product",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "IMAGE_NOT_FOUND",
      });
    }

    const replaced = await cloudinaryService.replaceImage(
      image.publicId,
      file.buffer,
      "addisgebeya/products",
      `prod_replace_${productId.slice(0, 8)}`,
    );

    const updated = await prisma.productImage.update({
      where: { id: imageId },
      data: {
        imageUrl: replaced.secureUrl,
        publicId: replaced.publicId,
      },
    });

    await this.syncColorwayImages(productId);
    return {
      ...updated,
      colorwayId: updated.colorwayId ?? undefined,
    };
  }

  async assignImageColorway(productId: string, imageId: string, colorwayId: string | null) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { colorways: true },
    });
    if (!product) {
      throw new AppError({
        message: "Product not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PRODUCT_NOT_FOUND",
      });
    }

    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== productId) {
      throw new AppError({
        message: "Image not found for this product",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "IMAGE_NOT_FOUND",
      });
    }

    if (colorwayId && !product.colorways.some((cw) => cw.id === colorwayId)) {
      throw new AppError({
        message: "Selected colorway does not belong to this product",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_COLORWAY",
      });
    }

    const updated = await prisma.productImage.update({
      where: { id: imageId },
      data: { colorwayId },
    });

    await this.syncColorwayImages(productId);
    return {
      ...updated,
      colorwayId: updated.colorwayId ?? undefined,
    };
  }

  async deleteProductImage(productId: string, imageId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError({
        message: "Product not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PRODUCT_NOT_FOUND",
      });
    }

    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== productId) {
      throw new AppError({
        message: "Image not found for this product",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "IMAGE_NOT_FOUND",
      });
    }

    if (image.publicId) {
      await cloudinaryService.deleteImage(image.publicId);
    }

    await prisma.productImage.delete({ where: { id: imageId } });

    if (image.isPrimary) {
      const remaining = await prisma.productImage.findFirst({
        where: { productId },
        orderBy: { displayOrder: "asc" },
      });
      if (remaining) {
        await prisma.productImage.update({
          where: { id: remaining.id },
          data: { isPrimary: true },
        });
      }
    }

    await this.syncColorwayImages(productId);
    return { success: true, deletedId: imageId };
  }

  async setPrimaryProductImage(productId: string, imageId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError({
        message: "Product not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PRODUCT_NOT_FOUND",
      });
    }

    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== productId) {
      throw new AppError({
        message: "Image not found for this product",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "IMAGE_NOT_FOUND",
      });
    }

    await prisma.productImage.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });

    const updated = await prisma.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });

    await this.syncColorwayImages(productId);
    return {
      ...updated,
      colorwayId: updated.colorwayId ?? undefined,
    };
  }

  async reorderProductImages(
    productId: string,
    imageOrders: Array<{ id: string; displayOrder: number }>,
  ) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError({
        message: "Product not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PRODUCT_NOT_FOUND",
      });
    }

    const existing = await prisma.productImage.findMany({
      where: { productId },
    });
    const existingIds = new Set(existing.map((img) => img.id));
    for (const item of imageOrders) {
      if (!existingIds.has(item.id)) {
        throw new AppError({
          message: `Image ID ${item.id} does not belong to this product`,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "INVALID_IMAGE_ID",
        });
      }
    }

    await prisma.$transaction(
      imageOrders.map((item) =>
        prisma.productImage.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );

    await this.syncColorwayImages(productId);

    return this.getProductImages(productId);
  }

  private async syncColorwayImages(productId: string) {
    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
    });

    const colorways = await prisma.productColorway.findMany({
      where: { productId },
      orderBy: { createdAt: "asc" },
    });

    const generalUrls = images.filter((img) => !img.colorwayId).map((img) => img.imageUrl);

    for (let i = 0; i < colorways.length; i++) {
      const cw = colorways[i]!;
      const cwUrls = images.filter((img) => img.colorwayId === cw.id).map((img) => img.imageUrl);

      if (cwUrls.length > 0) {
        await prisma.productColorway.update({
          where: { id: cw.id },
          data: { images: cwUrls },
        });
      } else if (i === 0) {
        await prisma.productColorway.update({
          where: { id: cw.id },
          data: { images: generalUrls },
        });
      }
    }
  }
}

export const productService = new ProductService();
