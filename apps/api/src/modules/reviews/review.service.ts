import { prisma } from "../../config/database.js";

export class ReviewService {
  async listAllReviews(limit = 12) {
    const reviews = await prisma.review.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true, slug: true } },
      },
    });

    return reviews.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.product?.name ?? "Footwear",
      authorName: r.authorName,
      authorInitials: r.authorInitials,
      location: r.location,
      purchasedSize: r.purchasedSize,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      dateLabel: r.dateLabel,
      verified: r.verified,
      helpfulCount: r.helpfulCount,
      photoUrl: r.photoUrl ?? undefined,
      tag: r.tag ?? undefined,
    }));
  }

  async listProductReviews(productId: string) {
    const reviews = await prisma.review.findMany({
      where: {
        OR: [{ productId }, { product: { slug: productId } }],
      },
      orderBy: { createdAt: "desc" },
    });

    return reviews.map((r) => ({
      id: r.id,
      productId: r.productId,
      authorName: r.authorName,
      authorInitials: r.authorInitials,
      location: r.location,
      purchasedSize: r.purchasedSize,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      dateLabel: r.dateLabel,
      verified: r.verified,
      helpfulCount: r.helpfulCount,
      photoUrl: r.photoUrl ?? undefined,
      tag: r.tag ?? undefined,
    }));
  }

  async addReview(data: {
    productId: string;
    authorName: string;
    location?: string;
    purchasedSize?: number;
    rating: number;
    title: string;
    comment: string;
  }) {
    const product = await prisma.product.findFirst({
      where: {
        OR: [{ id: data.productId }, { slug: data.productId }],
      },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    const initials = data.authorName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const created = await prisma.review.create({
      data: {
        productId: product.id,
        authorName: data.authorName,
        authorInitials: initials || "AG",
        location: data.location ?? "Addis Ababa",
        purchasedSize: data.purchasedSize ?? 42,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
        dateLabel: "Just now",
        verified: true,
      },
    });

    // Update product rating and review count
    const allReviews = await prisma.review.findMany({
      where: { productId: product.id },
      select: { rating: true },
    });
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await prisma.product.update({
      where: { id: product.id },
      data: {
        rating: Number(avg.toFixed(1)),
        reviewCount: allReviews.length,
      },
    });

    return created;
  }

  async markHelpful(reviewId: string) {
    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: 1 } },
    });
    return updated;
  }
}

export const reviewService = new ReviewService();

