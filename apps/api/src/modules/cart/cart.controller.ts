import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { mergeCartRequestSchema } from "@addisgebeya/validation";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getVerifiedGuestSessionId, resolveGuestCartId } from "../../utils/guest-session.js";
import { cartService, type CartOwner } from "./cart.service.js";

const strParam = (p: unknown): string => (Array.isArray(p) ? String(p[0] ?? "") : String(p ?? ""));

function resolveCartOwner(req: Request, res: Response, createGuestIfMissing: boolean): CartOwner {
  if (req.user?.id) {
    return { userId: req.user.id };
  }
  const guestSessionId =
    resolveGuestCartId(req, res, createGuestIfMissing) ?? "guest_ephemeral";
  return { guestSessionId };
}

export const cartController = {
  getCart: asyncHandler(async (req: Request, res: Response) => {
    const owner = resolveCartOwner(req, res, false);
    const cart = await cartService.getCart(owner);
    sendSuccess(res, cart, "Cart retrieved successfully");
  }),

  addItem: asyncHandler(async (req: Request, res: Response) => {
    const owner = resolveCartOwner(req, res, true);
    const cart = await cartService.addItem(owner, req.body);
    sendSuccess(res, cart, "Item added to cart", HTTP_STATUS.CREATED);
  }),

  updateQuantity: asyncHandler(async (req: Request, res: Response) => {
    const owner = resolveCartOwner(req, res, false);
    const id = strParam(req.params.id);
    const { quantity } = req.body;
    const cart = await cartService.updateQuantity(owner, id, Number(quantity));
    sendSuccess(res, cart, "Cart updated");
  }),

  removeItem: asyncHandler(async (req: Request, res: Response) => {
    const owner = resolveCartOwner(req, res, false);
    const id = strParam(req.params.id);
    const cart = await cartService.removeItem(owner, id);
    sendSuccess(res, cart, "Item removed from cart");
  }),

  clearCart: asyncHandler(async (req: Request, res: Response) => {
    const owner = resolveCartOwner(req, res, false);
    const cart = await cartService.clearCart(owner);
    sendSuccess(res, cart, "Cart cleared");
  }),

  mergeCart: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const parsed = mergeCartRequestSchema.parse(req.body ?? {});
    const cookieGuestId = getVerifiedGuestSessionId(req);
    const headerGuestId =
      typeof req.headers["x-guest-id"] === "string" && req.headers["x-guest-id"].trim()
        ? `hdr_${req.headers["x-guest-id"].trim()}`
        : null;

    const result = await cartService.mergeGuestCart(
      userId,
      [cookieGuestId, headerGuestId],
      parsed.items,
    );
    sendSuccess(res, result, "Cart merged successfully", HTTP_STATUS.OK);
  }),
};
