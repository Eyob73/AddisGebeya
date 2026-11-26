import { HTTP_STATUS } from "@addisgebeya/shared";
import type { CartMergeItemDto, CartMergeResponse } from "@addisgebeya/types";
import type { MergeCartItemInput } from "@addisgebeya/validation";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";

export type CartOwner = { userId: string; guestSessionId?: undefined } | { userId?: undefined; guestSessionId: string };

const MAX_ITEM_QUANTITY_PER_LINE = 10;

const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      product: {
        include: {
          category: true,
          images: {
            orderBy: [{ isPrimary: "desc" as const }, { displayOrder: "asc" as const }],
          },
          colorways: {
            include: { variants: true },
          },
        },
      },
    },
  },
};

export class CartService {
  private async findOrCreateCart(owner: CartOwner, createIfMissing = true) {
    const where = owner.userId
      ? { userId: owner.userId }
      : { guestSessionId: owner.guestSessionId };

    let cart = await prisma.cart.findUnique({
      where,
      include: CART_INCLUDE,
    });

    if (!cart && createIfMissing) {
      cart = await prisma.cart.create({
        data: owner.userId
          ? { userId: owner.userId }
          : { guestSessionId: owner.guestSessionId },
        include: CART_INCLUDE,
      });
    }

    return cart;
  }

  private mapCartToResponse(
    cart: NonNullable<Awaited<ReturnType<CartService["findOrCreateCart"]>>>,
  ): { id: string; items: CartMergeItemDto[]; itemCount: number; subtotalETB: number } {
    const items: CartMergeItemDto[] = cart.items.map((item) => {
      const colorway =
        item.product.colorways.find((cw) => cw.id === item.colorwayId) ??
        item.product.colorways[0];
      const variant = colorway?.variants.find((v) => v.size === item.size);

      const colorwayImage =
        item.product.images.find((img) => img.colorwayId === item.colorwayId)?.imageUrl ??
        colorway?.images[0] ??
        item.product.images[0]?.imageUrl ??
        item.product.category.imageUrl;

      // Always recalculate live authoritative unit price from PostgreSQL catalog
      const liveUnitPriceETB =
        Number(item.product.priceETB) + Number(variant?.priceAdjustment ?? 0);

      return {
        id: `${item.productId}__${item.colorwayId}__${item.size}`,
        dbItemId: item.id,
        productId: item.productId,
        productSlug: item.product.slug,
        productName: item.product.name,
        categoryName: item.product.category.name,
        brand: item.product.brand,
        colorwayId: item.colorwayId,
        colorwayName: colorway?.name ?? "Standard",
        colorHex: colorway?.hex ?? "#000000",
        size: item.size,
        unitPriceETB: liveUnitPriceETB,
        compareAtPriceETB: item.product.compareAtPriceETB
          ? Number(item.product.compareAtPriceETB)
          : undefined,
        quantity: item.quantity,
        image: colorwayImage,
        badge: item.product.badges[0] ?? undefined,
        maxStock: variant?.stockQuantity ?? 0,
      };
    });

    return {
      id: cart.id,
      items,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotalETB: items.reduce((sum, i) => sum + i.unitPriceETB * i.quantity, 0),
    };
  }

  async getCart(owner: CartOwner) {
    const cart = await this.findOrCreateCart(owner, true);
    return this.mapCartToResponse(cart!);
  }

  async addItem(
    owner: CartOwner,
    input: {
      productId: string;
      colorwayId: string;
      size: number;
      quantity?: number;
    },
  ) {
    const cart = (await this.findOrCreateCart(owner, true))!;
    const qty = Math.max(1, Math.min(MAX_ITEM_QUANTITY_PER_LINE, input.quantity ?? 1));

    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      include: {
        colorways: {
          include: { variants: true },
        },
      },
    });

    if (!product) {
      throw new AppError({
        message: "Product not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PRODUCT_NOT_FOUND",
      });
    }

    const colorway = product.colorways.find((cw) => cw.id === input.colorwayId);
    const variant = colorway?.variants.find((v) => v.size === input.size);
    const availableStock = variant?.stockQuantity ?? 0;

    if (!colorway || !variant) {
      throw new AppError({
        message: `Selected size EU ${input.size} or colorway is unavailable`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "VARIANT_NOT_FOUND",
      });
    }

    if (availableStock <= 0) {
      throw new AppError({
        message: `Size EU ${input.size} is currently out of stock`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "OUT_OF_STOCK",
      });
    }

    const authoritativePrice = Number(product.priceETB) + Number(variant.priceAdjustment ?? 0);

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: input.productId,
        colorwayId: input.colorwayId,
        size: input.size,
      },
    });

    if (existingItem) {
      const newQty = Math.min(availableStock, MAX_ITEM_QUANTITY_PER_LINE, existingItem.quantity + qty);
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQty,
          unitPriceETB: authoritativePrice,
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: input.productId,
          colorwayId: input.colorwayId,
          variantId: variant.id,
          size: input.size,
          quantity: Math.min(availableStock, MAX_ITEM_QUANTITY_PER_LINE, qty),
          unitPriceETB: authoritativePrice,
        },
      });
    }

    return this.getCart(owner);
  }

  async updateQuantity(owner: CartOwner, cartItemId: string, quantity: number) {
    const cart = (await this.findOrCreateCart(owner, true))!;

    const parts = cartItemId.split("__");
    const item =
      parts.length === 3
        ? await prisma.cartItem.findFirst({
            where: {
              cartId: cart.id,
              productId: parts[0],
              colorwayId: parts[1],
              size: Number(parts[2]),
            },
          })
        : await prisma.cartItem.findFirst({
            where: { id: cartItemId, cartId: cart.id },
          });

    if (!item) {
      return this.getCart(owner);
    }

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      const variant = item.variantId
        ? await prisma.productVariant.findUnique({ where: { id: item.variantId } })
        : await prisma.productVariant.findFirst({
            where: {
              productId: item.productId,
              colorwayId: item.colorwayId,
              size: item.size,
            },
          });

      if (!variant || variant.stockQuantity <= 0) {
        await prisma.cartItem.delete({ where: { id: item.id } });
      } else {
        const clampedQty = Math.min(variant.stockQuantity, MAX_ITEM_QUANTITY_PER_LINE, quantity);
        await prisma.cartItem.update({
          where: { id: item.id },
          data: { quantity: clampedQty },
        });
      }
    }

    return this.getCart(owner);
  }

  async removeItem(owner: CartOwner, cartItemId: string) {
    return this.updateQuantity(owner, cartItemId, 0);
  }

  async clearCart(owner: CartOwner) {
    const cart = await this.findOrCreateCart(owner, false);
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return this.getCart(owner);
  }

  /**
   * Merges guest DB cart items + client guest bag items into the authenticated user's cart
   * transactionally, deduplicating items, clamping to live PostgreSQL stock, and recalculating prices.
   */
  async mergeGuestCart(
    userId: string,
    guestSessionIds: Array<string | null | undefined>,
    clientItems: MergeCartItemInput[] = [],
  ): Promise<CartMergeResponse> {
    const warnings: string[] = [];
    let mergedCount = 0;

    const validGuestIds = Array.from(
      new Set(
        guestSessionIds
          .map((id) => id?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    );

    await prisma.$transaction(async (tx) => {
      let userCart = await tx.cart.findUnique({
        where: { userId },
        include: { items: true },
      });

      if (!userCart) {
        userCart = await tx.cart.create({
          data: { userId },
          include: { items: true },
        });
      }

      const guestCarts =
        validGuestIds.length > 0
          ? await tx.cart.findMany({
              where: { guestSessionId: { in: validGuestIds } },
              include: { items: true },
            })
          : [];

      // Deduplicate guest DB items and client items before combining with authenticated user's DB cart.
      // Using max between guest DB cart and client bag prevents 2x inflation when both mirrored the same add.
      const guestDbByKey = new Map<string, { productId: string; colorwayId: string; size: number; quantity: number }>();
      for (const guestCart of guestCarts) {
        for (const gi of guestCart.items) {
          const key = `${gi.productId}__${gi.colorwayId}__${gi.size}`;
          const prev = guestDbByKey.get(key);
          guestDbByKey.set(key, {
            productId: gi.productId,
            colorwayId: gi.colorwayId,
            size: gi.size,
            quantity: Math.max(prev?.quantity ?? 0, gi.quantity),
          });
        }
      }

      const clientByKey = new Map<string, MergeCartItemInput>();
      for (const ci of clientItems) {
        const key = `${ci.productId}__${ci.colorwayId}__${ci.size}`;
        const prev = clientByKey.get(key);
        clientByKey.set(key, {
          productId: ci.productId,
          colorwayId: ci.colorwayId,
          size: ci.size,
          quantity: (prev?.quantity ?? 0) + ci.quantity,
        });
      }

      const consolidatedGuest = new Map<string, MergeCartItemInput>();
      for (const [key, item] of guestDbByKey.entries()) {
        const clientMatch = clientByKey.get(key);
        consolidatedGuest.set(key, {
          productId: item.productId,
          colorwayId: item.colorwayId,
          size: item.size,
          quantity: Math.max(item.quantity, clientMatch?.quantity ?? 0),
        });
      }
      for (const [key, item] of clientByKey.entries()) {
        if (!consolidatedGuest.has(key)) {
          consolidatedGuest.set(key, item);
        }
      }

      // Re-validate and refresh existing user cart items against live DB prices & stock
      const existingByKey = new Map<string, (typeof userCart.items)[number]>();
      for (const existing of userCart.items) {
        existingByKey.set(`${existing.productId}__${existing.colorwayId}__${existing.size}`, existing);
      }

      for (const existing of userCart.items) {
        const key = `${existing.productId}__${existing.colorwayId}__${existing.size}`;
        if (consolidatedGuest.has(key)) {
          continue; // Handled below in merged pass
        }

        const product = await tx.product.findUnique({
          where: { id: existing.productId },
          include: { colorways: { include: { variants: true } } },
        });
        const colorway = product?.colorways.find((c) => c.id === existing.colorwayId);
        const variant = colorway?.variants.find((v) => v.size === existing.size);

        if (!product || !variant || variant.stockQuantity <= 0) {
          await tx.cartItem.delete({ where: { id: existing.id } });
          warnings.push(`Removed unavailable saved item (EU ${existing.size}) from your bag.`);
          continue;
        }

        const livePrice = Number(product.priceETB) + Number(variant.priceAdjustment ?? 0);
        const validQty = Math.min(variant.stockQuantity, MAX_ITEM_QUANTITY_PER_LINE, existing.quantity);
        if (validQty < existing.quantity) {
          warnings.push(`${product.name} (EU ${existing.size}) was adjusted to available stock (${validQty}).`);
        }

        await tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: validQty,
            unitPriceETB: livePrice,
            variantId: variant.id,
          },
        });
      }

      // Merge consolidated guest items into user's cart
      for (const [key, guestItem] of consolidatedGuest.entries()) {
        const product = await tx.product.findUnique({
          where: { id: guestItem.productId },
          include: {
            colorways: {
              include: { variants: true },
            },
          },
        });

        const colorway = product?.colorways.find((c) => c.id === guestItem.colorwayId);
        const variant = colorway?.variants.find((v) => v.size === guestItem.size);

        if (!product || !colorway || !variant) {
          warnings.push("An unavailable item in your guest bag was skipped.");
          continue;
        }

        if (variant.stockQuantity <= 0) {
          const staleExisting = existingByKey.get(key);
          if (staleExisting) {
            await tx.cartItem.delete({ where: { id: staleExisting.id } });
          }
          warnings.push(`${product.name} (EU ${guestItem.size}) is now out of stock and was removed.`);
          continue;
        }

        const liveUnitPrice = Number(product.priceETB) + Number(variant.priceAdjustment ?? 0);
        const existingUserItem = existingByKey.get(key);
        const desiredQty = (existingUserItem?.quantity ?? 0) + guestItem.quantity;
        const clampedQty = Math.min(variant.stockQuantity, MAX_ITEM_QUANTITY_PER_LINE, desiredQty);

        if (clampedQty < desiredQty) {
          warnings.push(
            `${product.name} (EU ${guestItem.size}) quantity was capped at ${clampedQty} due to stock limits.`,
          );
        }

        if (existingUserItem) {
          await tx.cartItem.update({
            where: { id: existingUserItem.id },
            data: {
              quantity: clampedQty,
              unitPriceETB: liveUnitPrice,
              variantId: variant.id,
            },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: guestItem.productId,
              colorwayId: guestItem.colorwayId,
              variantId: variant.id,
              size: guestItem.size,
              quantity: clampedQty,
              unitPriceETB: liveUnitPrice,
            },
          });
        }
        mergedCount += 1;
      }

      if (guestCarts.length > 0) {
        await tx.cart.deleteMany({
          where: { id: { in: guestCarts.map((c) => c.id) } },
        });
      }
    });

    const latestCart = await this.getCart({ userId });
    return {
      ...latestCart,
      mergedCount,
      warnings,
    };
  }
}

export const cartService = new CartService();
