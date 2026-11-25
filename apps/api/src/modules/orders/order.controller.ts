import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
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
    const order = await orderService.getOrderById(id);

    // SECURITY: Ensure customer can only view their own order
    if (req.user?.role !== "ADMIN") {
      if (!req.user) {
        throw new AppError({
          message: "Authentication required to view order details",
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          code: "UNAUTHORIZED",
        });
      }

      const isOwner =
        order.customerId === req.user.id ||
        order.customerEmail.toLowerCase() === req.user.email.toLowerCase();

      if (!isOwner) {
        throw new AppError({
          message: "You do not have permission to access this order",
          statusCode: HTTP_STATUS.FORBIDDEN,
          code: "FORBIDDEN",
        });
      }
    }

    sendSuccess(res, order, "Order details retrieved successfully");
  }),

  calculate: asyncHandler(async (req: Request, res: Response) => {
    const { items, deliverySpeed, promoCode } = req.body;
    const result = await orderService.calculate(items ?? [], deliverySpeed, promoCode);
    sendSuccess(res, result, "Order totals calculated");
  }),

  createOrder: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const order = await orderService.createOrder(userId, req.body);
    sendSuccess(res, order, "Order placed successfully", HTTP_STATUS.CREATED);
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const { status, courierName } = req.body;
    const updated = await orderService.updateOrderStatus(id, status, courierName);
    sendSuccess(res, updated, "Order status updated");
  }),

  verifyPayment: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const { reference, paymentStatus } = req.body;
    const updated = await orderService.verifyPayment(id, reference, paymentStatus);
    sendSuccess(res, updated, "Order payment verified");
  }),
};
