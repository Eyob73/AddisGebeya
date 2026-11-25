import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { couponService } from "./coupon.service.js";

export const couponController = {
  listCoupons: asyncHandler(async (_req: Request, res: Response) => {
    const coupons = await couponService.listCoupons();
    sendSuccess(res, coupons, "Coupons retrieved");
  }),

  validateCoupon: asyncHandler(async (req: Request, res: Response) => {
    const { code, subtotalETB } = req.body;
    const result = await couponService.validateCoupon(code, Number(subtotalETB ?? 0));
    sendSuccess(res, result, "Promo code applied successfully");
  }),
};

