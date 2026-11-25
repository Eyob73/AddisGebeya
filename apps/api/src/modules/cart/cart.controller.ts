import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { cartService } from "./cart.service.js";

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

export const cartController = {
  getCart: asyncHandler(async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    const cart = await cartService.getCart(userId);
    sendSuccess(res, cart, "Cart retrieved successfully");
  }),

  addItem: asyncHandler(async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    const cart = await cartService.addItem(userId, req.body);
    sendSuccess(res, cart, "Item added to cart", HTTP_STATUS.CREATED);
  }),

  updateQuantity: asyncHandler(async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    const id = strParam(req.params.id);
    const { quantity } = req.body;
    const cart = await cartService.updateQuantity(userId, id, Number(quantity));
    sendSuccess(res, cart, "Cart updated");
  }),

  removeItem: asyncHandler(async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    const id = strParam(req.params.id);
    const cart = await cartService.removeItem(userId, id);
    sendSuccess(res, cart, "Item removed from cart");
  }),

  clearCart: asyncHandler(async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    const cart = await cartService.clearCart(userId);
    sendSuccess(res, cart, "Cart cleared");
  }),
};
