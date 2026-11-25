import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { wishlistService } from "./wishlist.service.js";

const strParam = (p: unknown): string => (Array.isArray(p) ? String(p[0] ?? "") : String(p ?? ""));

function getSessionUserId(req: Request): string {
  if (req.user?.id) {
    return req.user.id;
  }
  const guestId = (req.headers["x-guest-id"] as string | undefined) || (req.cookies?.guestId as string | undefined);
  if (guestId && guestId.trim()) {
    return `guest_${guestId.trim()}`;
  }
  return "guest_session";
}

export const wishlistController = {
  getWishlist: asyncHandler(async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    const productIds = await wishlistService.getWishlist(userId);
    sendSuccess(res, { productIds }, "Wishlist retrieved");
  }),

  toggleWishlist: asyncHandler(async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    const { productId } = req.body;
    const result = await wishlistService.toggleWishlist(userId, productId);
    sendSuccess(res, result, result.added ? "Added to wishlist" : "Removed from wishlist");
  }),

  removeItem: asyncHandler(async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    const productId = strParam(req.params.productId);
    const productIds = await wishlistService.removeItem(userId, productId);
    sendSuccess(res, { productIds }, "Removed from wishlist");
  }),

  clearWishlist: asyncHandler(async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    const productIds = await wishlistService.clearWishlist(userId);
    sendSuccess(res, { productIds }, "Wishlist cleared");
  }),
};
