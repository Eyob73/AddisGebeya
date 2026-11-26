import { z } from "zod";

export const verifyPaymentRequestSchema = z
  .object({
    orderId: z.string().trim().min(1, "Order ID or order number is required"),
    provider: z
      .string()
      .trim()
      .min(1, "Payment provider is required")
      .max(64, "Invalid payment provider"),
    reference: z.string().trim().max(512).optional(),
    accountNumber: z.string().trim().max(64).optional(),
    qrData: z.string().trim().max(4096).optional(),
    phoneNumber: z.string().trim().max(32).optional(),
    cbeReceiptToken: z.string().trim().max(256).optional(),
    officialReceiptUrl: z.string().trim().max(512).optional(),
  })
  .refine((data) => Boolean(data.reference?.trim() || data.qrData?.trim()), {
    message: "Transaction reference, receipt link, or QR payload is required",
    path: ["reference"],
  });

export type VerifyPaymentRequestInput = z.infer<typeof verifyPaymentRequestSchema>;

export const extractReceiptOcrSchema = z.object({
  orderId: z.string().trim().max(128).optional(),
  provider: z.string().trim().max(64).optional(),
});

export type ExtractReceiptOcrInput = z.infer<typeof extractReceiptOcrSchema>;

export const submitPaymentReceiptSchema = z.object({
  orderId: z.string().trim().min(1, "Order ID or order number is required"),
  provider: z
    .string()
    .trim()
    .min(1, "Payment provider is required")
    .max(64, "Invalid payment provider")
    .optional(),
  transactionReference: z.string().trim().max(512, "Transaction reference is too long").optional(),
  qrData: z.string().trim().max(4096).optional(),
  accountNumber: z.string().trim().max(64).optional(),
  phoneNumber: z.string().trim().max(32).optional(),
  cbeReceiptToken: z.string().trim().max(256).optional(),
  officialReceiptUrl: z.string().trim().max(512).optional(),
  captureMethod: z.enum(["upload", "camera"]).default("upload"),
  autoVerify: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => (v === undefined ? true : v === true || v === "true")),
});

export type SubmitPaymentReceiptInput = z.infer<typeof submitPaymentReceiptSchema>;

export const verifyReceiptByIdSchema = z.object({
  provider: z.string().trim().max(64).optional(),
  transactionReference: z.string().trim().max(512).optional(),
  qrData: z.string().trim().max(4096).optional(),
  accountNumber: z.string().trim().max(64).optional(),
  phoneNumber: z.string().trim().max(32).optional(),
  cbeReceiptToken: z.string().trim().max(256).optional(),
  officialReceiptUrl: z.string().trim().max(512).optional(),
});

export type VerifyReceiptByIdInput = z.infer<typeof verifyReceiptByIdSchema>;

export const adminReviewPaymentSchema = z.object({
  decision: z.enum(["approve", "reject", "request_new_receipt"]),
  reason: z
    .string()
    .trim()
    .min(5, "Administrator review reason must be at least 5 characters")
    .max(500, "Reason cannot exceed 500 characters"),
  reference: z.string().trim().max(255).optional(),
  cbeReceiptToken: z.string().trim().max(256).optional(),
  officialReceiptUrl: z.string().trim().max(512).optional(),
  requestNewReceipt: z.boolean().optional(),
});

export type AdminReviewPaymentInput = z.infer<typeof adminReviewPaymentSchema>;

export const adminPaymentFilterQuerySchema = z.object({
  status: z.string().trim().optional(),
  receiptStatus: z.string().trim().optional(),
  provider: z.string().trim().optional(),
  search: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type AdminPaymentFilterQuery = z.infer<typeof adminPaymentFilterQuerySchema>;

export const updatePaymentProviderConfigSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  receivingAccountName: z.string().trim().min(2, "Account holder name is required").max(160),
  receivingAccountNumber: z.string().trim().min(3, "Receiving account number is required").max(80),
  accountSuffixDigits: z.coerce.number().int().min(4).max(16).nullable().optional(),
  instructions: z.string().trim().max(500).nullable().optional(),
  isEnabled: z.boolean().optional(),
  maxPaymentAgeDays: z.coerce.number().int().min(1).max(180).optional(),
});

export type UpdatePaymentProviderConfigInput = z.infer<typeof updatePaymentProviderConfigSchema>;

export const adminRefundPaymentSchema = z.object({
  stage: z.enum(["initiated", "completed"]).default("completed"),
  reason: z
    .string()
    .trim()
    .min(5, "Refund reason must be at least 5 characters")
    .max(500, "Refund reason cannot exceed 500 characters"),
});

export type AdminRefundPaymentInput = z.infer<typeof adminRefundPaymentSchema>;

