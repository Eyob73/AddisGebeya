import { HTTP_STATUS } from "@addisgebeya/shared";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";

export class CouponService {
  async listCoupons() {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
    });

    return coupons.map((c) => ({
      code: c.code,
      type: c.discountType as "fixed" | "percent",
      value: Number(c.discountValue),
      minSubtotalETB: Number(c.minimumOrderAmount),
      description: c.description ?? "",
      isActive: c.isActive,
      usageCount: c.usedCount,
    }));
  }

  async validateCoupon(code: string, subtotalETB: number) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
      throw new AppError({
        message: `Promo code "${code}" is invalid or has expired.`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_COUPON",
      });
    }

    if (subtotalETB < Number(coupon.minimumOrderAmount)) {
      throw new AppError({
        message: `Promo code "${coupon.code}" requires a minimum order of ${Number(coupon.minimumOrderAmount).toLocaleString()} ETB.`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "MIN_ORDER_NOT_MET",
      });
    }

    let discountETB = 0;
    if (coupon.discountType === "percent") {
      discountETB = Math.round((subtotalETB * Number(coupon.discountValue)) / 100);
    } else {
      discountETB = Number(coupon.discountValue);
    }

    if (coupon.maximumDiscount) {
      discountETB = Math.min(discountETB, Number(coupon.maximumDiscount));
    }

    return {
      ok: true,
      code: coupon.code,
      type: coupon.discountType as "fixed" | "percent",
      value: Number(coupon.discountValue),
      minSubtotalETB: Number(coupon.minimumOrderAmount),
      description: coupon.description ?? "",
      discountETB,
    };
  }
}

export const couponService = new CouponService();

