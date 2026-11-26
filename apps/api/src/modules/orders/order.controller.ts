import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { guestTrackOrderSchema } from "@addisgebeya/validation";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getOrCreateGuestSessionId,
  getVerifiedGuestSessionId,
} from "../../utils/guest-session.js";
import { orderService } from "./order.service.js";

const strParam = (p: unknown): string => (Array.isArray(p) ? String(p[0] ?? "") : String(p ?? ""));

export const orderController = {
  listOrders: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required to view orders",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const isAdmin = req.user.role === "ADMIN";
    const userId = isAdmin ? undefined : req.user.id;
    const orders = await orderService.listOrders(userId, isAdmin);
    sendSuccess(res, orders, "Orders retrieved successfully");
  }),

  getOrderById: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const guestSessionId = req.user ? null : getVerifiedGuestSessionId(req);
    const order = await orderService.getOrderByIdForActor(id, {
      userId: req.user?.id,
      userEmail: req.user?.email,
      guestSessionId,
      role: req.user?.role,
    });

    sendSuccess(res, order, "Order details retrieved successfully");
  }),

  trackGuestOrder: asyncHandler(async (req: Request, res: Response) => {
    const parsed = guestTrackOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError({
        message: parsed.error.issues[0]?.message || "Order number and email are required.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_TRACK_ORDER_QUERY",
      });
    }

    const order = await orderService.trackGuestOrder(
      parsed.data.orderNumber,
      parsed.data.email,
    );
    sendSuccess(res, order, "Order tracking retrieved successfully");
  }),

  calculate: asyncHandler(async (req: Request, res: Response) => {
    const { items, deliverySpeed, promoCode } = req.body;
    const result = await orderService.calculate(items ?? [], deliverySpeed, promoCode);
    sendSuccess(res, result, "Order totals calculated");
  }),

  createOrder: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const guestSessionId = userId ? undefined : getOrCreateGuestSessionId(req, res);
    const order = await orderService.createOrder(userId, req.body, guestSessionId);
    sendSuccess(res, order, "Order placed successfully", HTTP_STATUS.CREATED);
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const { status, courierName } = req.body;
    const updated = await orderService.updateOrderStatus(id, status, courierName);
    sendSuccess(res, updated, "Order status updated");
  }),

  cancelOrder: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required to cancel an order",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const id = strParam(req.params.id);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined;
    const updated = await orderService.cancelOrder(
      id,
      { userId: req.user.id, role: req.user.role },
      reason,
    );
    sendSuccess(res, updated, "Order cancelled successfully");
  }),

  verifyPayment: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const { reference, paymentStatus } = req.body;
    const updated = await orderService.verifyPayment(id, reference, paymentStatus);
    sendSuccess(res, updated, "Order payment verified");
  }),
};
