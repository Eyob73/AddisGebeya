import { HTTP_STATUS } from "@addisgebeya/shared";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";

export class CartService {
  private async getOrCreateCart(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
                images: {
                  orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
                },
                colorways: {
                  include: { variants: true },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  images: {
                    orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
                  },
                  colorways: {
                    include: { variants: true },
                  },
                },
              },
            },
          },
        },
      });
    }

    return cart;
  }

  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const items = cart.items.map((item) => {
      const colorway =
        item.product.colorways.find((cw) => cw.id === item.colorwayId) ??
        item.product.colorways[0];
      const variant = colorway?.variants.find((v) => v.size === item.size);

      const colorwayImage =
        item.product.images.find((img) => img.colorwayId === item.colorwayId)?.imageUrl ??
        colorway?.images[0] ??
        item.product.images[0]?.imageUrl ??
        item.product.category.imageUrl;

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
        unitPriceETB: Number(item.unitPriceETB),
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

  async addItem(userId: string, input: {
    productId: string;
    colorwayId: string;
    size: number;
    quantity?: number;
  }) {
    const cart = await this.getOrCreateCart(userId);
    const qty = Math.max(1, input.quantity ?? 1);

    // Verify product and variant stock in database
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

    if (availableStock <= 0) {
      throw new AppError({
        message: `Size EU ${input.size} is currently out of stock`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "OUT_OF_STOCK",
      });
    }

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: input.productId,
        colorwayId: input.colorwayId,
        size: input.size,
      },
    });

    if (existingItem) {
      const newQty = Math.min(availableStock, existingItem.quantity + qty);
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: input.productId,
          colorwayId: input.colorwayId,
          variantId: variant?.id,
          size: input.size,
          quantity: Math.min(availableStock, qty),
          unitPriceETB: product.priceETB,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateQuantity(userId: string, cartItemId: string, quantity: number) {
    const cart = await this.getOrCreateCart(userId);

    // cartItemId could be db ID or composite key
    const parts = cartItemId.split("__");
    let item;
    if (parts.length === 3) {
      item = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: parts[0],
          colorwayId: parts[1],
          size: Number(parts[2]),
        },
      });
    } else {
      item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
    }

    if (!item) {
      return this.getCart(userId);
    }

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });
    }

    return this.getCart(userId);
  }

  async removeItem(userId: string, cartItemId: string) {
    return this.updateQuantity(userId, cartItemId, 0);
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }
}

export const cartService = new CartService();

