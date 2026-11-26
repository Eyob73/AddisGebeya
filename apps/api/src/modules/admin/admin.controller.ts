import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { AppError } from "../../utils/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { paymentVerificationService } from "../payments/payment-verification.service.js";
import { adminService } from "./admin.service.js";

const strParam = (p: unknown): string => (Array.isArray(p) ? String(p[0] ?? "") : String(p ?? ""));

export const adminController = {
  getDashboard: asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.getDashboard();
    sendSuccess(res, data, "Admin dashboard statistics retrieved");
  }),

  listCustomers: asyncHandler(async (_req: Request, res: Response) => {
    const customers = await adminService.listCustomers();
    sendSuccess(res, customers, "Customer list retrieved");
  }),

  listInventory: asyncHandler(async (_req: Request, res: Response) => {
    const inventory = await adminService.listInventory();
    sendSuccess(res, inventory, "Inventory items retrieved");
  }),

  listPayments: asyncHandler(async (req: Request, res: Response) => {
    const payments = await paymentVerificationService.listAdminPayments(req.query);
    sendSuccess(res, payments, "Admin payments retrieved");
  }),

  reviewPayment: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Admin authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }
    const paymentId = strParam(req.params.paymentId);
    const updated = await paymentVerificationService.reviewPayment(
      paymentId,
      req.user.id,
      req.body,
    );
    sendSuccess(res, updated, "Payment review recorded successfully");
  }),

  refundPayment: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Admin authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }
    const paymentId = strParam(req.params.paymentId);
    const updated = await paymentVerificationService.processRefund(
      paymentId,
      req.user.id,
      req.body,
    );
    sendSuccess(res, updated, "Payment refund updated successfully");
  }),

  listPaymentProviderConfigs: asyncHandler(async (_req: Request, res: Response) => {
    const configs = await paymentVerificationService.listProviderConfigs();
    sendSuccess(res, configs, "Payment provider configurations retrieved");
  }),

  updatePaymentProviderConfig: asyncHandler(async (req: Request, res: Response) => {
    const providerCode = strParam(req.params.providerCode);
    const updated = await paymentVerificationService.updateProviderConfig(providerCode, req.body);
    sendSuccess(res, updated, "Payment provider configuration updated");
  }),
};

