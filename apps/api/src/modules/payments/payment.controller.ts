import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getVerifiedGuestSessionId } from "../../utils/guest-session.js";
import { verifyReceiptAccessToken } from "../../utils/jwt.js";
import { paymentService } from "./payment.service.js";
import {
  paymentVerificationService,
  type PaymentActor,
} from "./payment-verification.service.js";

const strParam = (p: unknown): string => (Array.isArray(p) ? String(p[0] ?? "") : String(p ?? ""));

function resolvePaymentActor(req: Request, unauthorizedMessage: string): PaymentActor {
  if (req.user) {
    return { userId: req.user.id, role: req.user.role };
  }

  const guestSessionId = getVerifiedGuestSessionId(req);
  if (guestSessionId) {
    return { userId: null, guestSessionId, role: "CUSTOMER" };
  }

  throw new AppError({
    message: unauthorizedMessage,
    statusCode: HTTP_STATUS.UNAUTHORIZED,
    code: "UNAUTHORIZED",
  });
}

export const paymentController = {
  getProviders: asyncHandler(async (_req: Request, res: Response) => {
    const providers = await paymentVerificationService.getSupportedProviders();
    sendSuccess(res, { providers }, "Supported Ethiopian payment providers retrieved");
  }),

  verifyPayment: asyncHandler(async (req: Request, res: Response) => {
    const actor = resolvePaymentActor(req, "Authentication required to verify payments");
    const result = await paymentVerificationService.verifyPayment(req.body, actor);
    sendSuccess(res, result, result.message);
  }),

  getPaymentStatus: asyncHandler(async (req: Request, res: Response) => {
    const actor = resolvePaymentActor(req, "Authentication required to check payment status");
    const orderId = strParam(req.params.orderId);
    const status = await paymentVerificationService.getPaymentStatus(orderId, actor);
    sendSuccess(res, status, "Payment status retrieved successfully");
  }),

  extractReceiptOcr: asyncHandler(async (req: Request, res: Response) => {
    const actor = resolvePaymentActor(
      req,
      "Authentication required to extract payment receipt details",
    );

    const file = req.file
      ? {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        }
      : undefined;

    const result = await paymentVerificationService.extractReceiptOcr(req.body, file, actor);
    sendSuccess(res, result, result.message);
  }),

  submitReceipt: asyncHandler(async (req: Request, res: Response) => {
    const actor = resolvePaymentActor(req, "Authentication required to submit payment receipts");

    const file = req.file
      ? {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        }
      : undefined;

    const result = await paymentVerificationService.submitReceipt(req.body, file, actor);
    sendSuccess(res, result, result.message, HTTP_STATUS.CREATED);
  }),

  verifyReceiptById: asyncHandler(async (req: Request, res: Response) => {
    const actor = resolvePaymentActor(req, "Authentication required to verify payment receipts");
    const receiptId = strParam(req.params.receiptId);
    const result = await paymentVerificationService.verifyReceiptById(
      receiptId,
      req.body,
      actor,
    );
    sendSuccess(res, result, result.message);
  }),

  getOrderReceipts: asyncHandler(async (req: Request, res: Response) => {
    const actor = resolvePaymentActor(req, "Authentication required to view payment receipts");
    const orderId = strParam(req.params.orderId);
    const receipts = await paymentVerificationService.getOrderReceipts(orderId, actor);
    sendSuccess(res, { receipts }, "Order payment receipts retrieved successfully");
  }),

  createReceiptAccessUrl: asyncHandler(async (req: Request, res: Response) => {
    const actor = resolvePaymentActor(req, "Authentication required to access payment receipts");
    const receiptId = strParam(req.params.receiptId);
    const access = await paymentVerificationService.createAuthorizedReceiptAccess(receiptId, actor);
    sendSuccess(res, access, "Time-limited receipt access link created");
  }),

  streamReceiptFile: asyncHandler(async (req: Request, res: Response) => {
    const receiptId = strParam(req.params.receiptId);
    let actor: PaymentActor | null = req.user
      ? { userId: req.user.id, role: req.user.role }
      : null;

    if (!actor) {
      const accessToken =
        typeof req.query.access === "string" ? req.query.access.trim() : "";

      if (accessToken) {
        const decoded = verifyReceiptAccessToken(accessToken);
        if (decoded.receiptId !== receiptId) {
          throw new AppError({
            message: "Access token does not match the requested receipt.",
            statusCode: HTTP_STATUS.FORBIDDEN,
            code: "FORBIDDEN",
          });
        }

        if (decoded.sub.startsWith("guest:")) {
          actor = {
            userId: null,
            guestSessionId: decoded.sub.slice(6),
            role: "CUSTOMER",
          };
        } else {
          const tokenUser = await prisma.user.findUnique({
            where: { id: decoded.sub },
            select: { id: true, role: true, isActive: true },
          });
          if (!tokenUser || !tokenUser.isActive) {
            throw new AppError({
              message: "User account not found or deactivated",
              statusCode: HTTP_STATUS.UNAUTHORIZED,
              code: "ACCOUNT_DEACTIVATED",
            });
          }

          actor = {
            userId: tokenUser.id,
            role: tokenUser.role as "CUSTOMER" | "ADMIN",
          };
        }
      } else {
        const guestSessionId = getVerifiedGuestSessionId(req);
        if (!guestSessionId) {
          throw new AppError({
            message: "Authentication required to view receipt files",
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            code: "UNAUTHORIZED",
          });
        }
        actor = { userId: null, guestSessionId, role: "CUSTOMER" };
      }
    }

    const file = await paymentVerificationService.getAuthorizedReceiptFile(receiptId, actor);

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(HTTP_STATUS.OK).send(file.buffer);
  }),

  initializePayment: asyncHandler(async (req: Request, res: Response) => {
    const { orderIdOrNumber, paymentMethod, phone, returnUrl } = req.body;

    if (!orderIdOrNumber || !paymentMethod) {
      throw new AppError({
        message: "orderIdOrNumber and paymentMethod are required",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_PAYMENT_INIT_PAYLOAD",
      });
    }

    const result = await paymentService.initializePayment(
      { orderIdOrNumber, paymentMethod, phone, returnUrl },
      req.user?.id,
    );
    sendSuccess(res, result, "Payment initialized successfully");
  }),

  handleCallback: asyncHandler(async (req: Request, res: Response) => {
    const { reference, status, providerMeta } = req.body;

    if (!reference || !status) {
      throw new AppError({
        message: "Transaction reference and status are required for payment verification callback",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_CALLBACK_PAYLOAD",
      });
    }

    const result = await paymentService.processCallback(reference, status, providerMeta);
    sendSuccess(res, result, "Payment callback processed successfully");
  }),

  listUserPayments: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError({
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: "UNAUTHORIZED",
      });
    }

    const payments = await paymentService.listUserPayments(req.user.id);
    sendSuccess(res, payments, "Payment history retrieved successfully");
  }),

  listSlips: asyncHandler(async (_req: Request, res: Response) => {
    const slips = await paymentService.listPaymentSlips();
    sendSuccess(res, slips, "Payment slips retrieved successfully");
  }),

  attachSlip: asyncHandler(async (req: Request, res: Response) => {
    const { slipId, orderId } = req.body;
    if (!slipId || !orderId) {
      throw new AppError({
        message: "slipId and orderId are required",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "MISSING_SLIP_ATTACHMENT_FIELDS",
      });
    }

    const result = await paymentService.attachSlipToOrder(slipId, orderId, req.user?.id);
    sendSuccess(res, result, "Payment slip attached and order verified successfully");
  }),
};
