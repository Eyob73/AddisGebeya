import { Router } from "express";
import { optionalAuth, requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { createRateLimiter } from "../../middlewares/rate-limit.middleware.js";
import { uploadReceiptMedia } from "../media/media.middleware.js";
import { paymentController } from "./payment.controller.js";

const paymentVerifyRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyPrefix: "payment-verify",
  message: "Too many payment verification attempts. Please wait a minute and try again.",
});

const receiptUploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  keyPrefix: "receipt-upload",
  message: "Too many receipt upload attempts. Please wait a minute and try again.",
});

const paymentRouter: Router = Router();

// Cheki provider discovery & bank verification flow
paymentRouter.get("/providers", paymentController.getProviders);
paymentRouter.post(
  "/verify",
  optionalAuth,
  paymentVerifyRateLimiter,
  paymentController.verifyPayment,
);
paymentRouter.get("/status/:orderId", optionalAuth, paymentController.getPaymentStatus);

// Payment receipt OCR preview, upload/auto-verification, listing & authorized image/PDF retrieval
paymentRouter.post(
  "/receipts/extract",
  optionalAuth,
  receiptUploadRateLimiter,
  uploadReceiptMedia.single("receipt"),
  paymentController.extractReceiptOcr,
);
paymentRouter.post(
  "/receipts",
  optionalAuth,
  receiptUploadRateLimiter,
  uploadReceiptMedia.single("receipt"),
  paymentController.submitReceipt,
);
paymentRouter.post(
  "/receipts/:receiptId/verify",
  optionalAuth,
  paymentVerifyRateLimiter,
  paymentController.verifyReceiptById,
);
paymentRouter.get("/receipts/order/:orderId", optionalAuth, paymentController.getOrderReceipts);
paymentRouter.post(
  "/receipts/:receiptId/access",
  optionalAuth,
  paymentController.createReceiptAccessUrl,
);
paymentRouter.get(
  "/receipts/:receiptId/file",
  optionalAuth,
  paymentController.streamReceiptFile,
);

// Protected legacy payment initialization and admin slip operations
paymentRouter.post("/callback", requireAuth, requireRole("ADMIN"), paymentController.handleCallback);
paymentRouter.post("/initialize", optionalAuth, paymentController.initializePayment);
paymentRouter.get("/history", requireAuth, paymentController.listUserPayments);
paymentRouter.get("/slips", requireAuth, requireRole("ADMIN"), paymentController.listSlips);
paymentRouter.post("/slips/attach", requireAuth, requireRole("ADMIN"), paymentController.attachSlip);

export { paymentRouter };
