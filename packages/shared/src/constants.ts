export const APP_NAME = "AddisGebeya" as const;

export const API_VERSION = "v1" as const;

export const API_PREFIX = `/api/${API_VERSION}` as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const PAYMENT_STATUSES = [
  "Pending",
  "VerificationPending",
  "Paid",
  "Failed",
  "ReviewRequired",
  "Refunded",
] as const;
export type CanonicalPaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_RECEIPT_STATUSES = [
  "Pending",
  "Processing",
  "Verified",
  "Rejected",
  "Manual Review",
] as const;
export type CanonicalPaymentReceiptStatus = (typeof PAYMENT_RECEIPT_STATUSES)[number];

export const VERIFICATION_SOURCES = [
  "pending",
  "provider_api",
  "admin_manual",
] as const;
export type VerificationSource = (typeof VERIFICATION_SOURCES)[number];

export const ORDER_STATUSES = [
  "PendingPayment",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
] as const;
export type CanonicalOrderStatus = (typeof ORDER_STATUSES)[number];

export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

export const SHOE_GENDERS = ["Men", "Women", "Unisex", "Kids"] as const;
export type ShoeGender = (typeof SHOE_GENDERS)[number];

export const SHOE_TYPES = [
  "Sneakers",
  "Running",
  "Casual",
  "Formal",
  "Sports",
  "Boots",
  "Sandals",
  "Loafers",
] as const;
export type ShoeType = (typeof SHOE_TYPES)[number];

export const ADULT_EU_SIZES = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47] as const;
export const DEFAULT_EU_SIZES = [38, 39, 40, 41, 42, 43, 44, 45, 46] as const;
export const KIDS_EU_SIZES = [28, 29, 30, 31, 32, 33, 34, 35, 36] as const;
