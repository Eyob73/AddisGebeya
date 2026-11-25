import { prisma } from "../../config/database.js";

export class WishlistService {
  private async getOrCreateWishlist(userId: string) {
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: true,
      },
    });

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId },
        include: { items: true },
      });
    }

    return wishlist;
  }

  async getWishlist(userId: string): Promise<string[]> {
    const wishlist = await this.getOrCreateWishlist(userId);
    return wishlist.items.map((i) => i.productId);
  }

  async toggleWishlist(userId: string, productId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);
    const existing = await prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId,
        },
      },
    });

    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      const current = await this.getWishlist(userId);
      return { added: false, productIds: current };
    } else {
      await prisma.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId,
        },
      });
      const current = await this.getWishlist(userId);
      return { added: true, productIds: current };
    }
  }

  async removeItem(userId: string, productId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);
    await prisma.wishlistItem.deleteMany({
      where: {
        wishlistId: wishlist.id,
        productId,
      },
    });
    return this.getWishlist(userId);
  }

  async clearWishlist(userId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);
    await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id },
    });
    return [];
  }
}

export const wishlistService = new WishlistService();

