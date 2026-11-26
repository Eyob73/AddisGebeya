export interface PaymentFormatOption {
  id: string;
  status: string;
  label: string;
  inputs: string[];
  accountDigits?: number;
  responseType?: string;
  supported: boolean;
}

export interface PaymentProviderInfo {
  id: string;
  name: string;
  swift?: string;
  type: "bank" | "mobile" | "wallet" | string;
  status: "live" | "in-development" | string;
  beta?: boolean;
  requiresAccount: boolean;
  accountDigits?: number;
  requiresPhone: boolean;
  supportsQr: boolean;
  supportsLink: boolean;
  color: string;
  initials: string;
  formats: PaymentFormatOption[];
  healthStatus: "reachable" | "unreachable" | "geo-blocked" | "unknown" | string;
  receivingAccountName: string;
  receivingAccountNumber: string;
  instructions?: string | null;
}

export interface PaymentVerificationLogDto {
  id: string;
  paymentId: string;
  orderId: string;
  provider: string;
  submittedReference?: string | null;
  verificationStatus: string;
  errorMessage?: string | null;
  chekiHttpStatus?: number | null;
  attemptedAt: string;
  actorType: string;
  actorId?: string | null;
  reason?: string | null;
}

export interface PaymentVerificationResponse {
  verified: boolean;
  alreadyPaid?: boolean;
  paymentStatus: string;
  orderStatus: string;
  orderNumber: string;
  provider: string;
  reference: string;
  officialReceiptUrl?: string | null;
  cbeReceiptToken?: string | null;
  officialReceiptReason?: string | null;
  amountETB: number;
  currency: string;
  verifiedAt?: string | null;
  message: string;
  code?: string;
}

export type PaymentReceiptStatus =
  | "Pending"
  | "Processing"
  | "Verified"
  | "Rejected"
  | "Manual Review"
  | "Approved";

export type VerificationSource = "pending" | "provider_api" | "admin_manual";

export type ReceiptCaptureMethod = "upload" | "camera";

export interface ReceiptOcrExtractionDto {
  extractedReference: string | null;
  extractedQrData: string | null;
  extractedOfficialReceiptUrl?: string | null;
  extractedCbeToken?: string | null;
  extractedAmountETB: number | null;
  extractedDate: string | null;
  extractedSenderName: string | null;
  extractedSenderAccount: string | null;
  extractedReceiverName: string | null;
  extractedReceiverAccount: string | null;
  extractedStatus: string | null;
  detectedProvider: string | null;
  confidence: number;
  extractionSucceeded: boolean;
  message: string;
  rawTextPreview?: string | null;
}

export interface PaymentReceiptDto {
  id: string;
  paymentId: string;
  orderId: string;
  orderNumber: string;
  userId: string | null;
  customerName?: string;
  provider: string;
  transactionReference?: string | null;
  officialReceiptUrl?: string | null;
  cbeReceiptToken?: string | null;
  officialReceiptReason?: string | null;
  extractedReference?: string | null;
  extractedQrData?: string | null;
  extractedAmountETB?: number | null;
  extractedDate?: string | null;
  extractedSenderName?: string | null;
  extractedSenderAccount?: string | null;
  extractedReceiverName?: string | null;
  extractedReceiverAccount?: string | null;
  extractedStatus?: string | null;
  detectedProvider?: string | null;
  ocrConfidence?: number | null;
  ocrCompletedAt?: string | null;
  verifiedAmountETB?: number | null;
  verifiedCurrency?: string | null;
  verificationSource: VerificationSource | string;
  failureReason?: string | null;
  providerResponse?: Record<string, unknown> | null;
  verifiedAt?: string | null;
  imageUrl: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
  width?: number | null;
  height?: number | null;
  captureMethod: ReceiptCaptureMethod | string;
  status: PaymentReceiptStatus;
  rejectionReason?: string | null;
  resubmissionRequested: boolean;
  reviewedByAdminId?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
}

export interface SubmitPaymentReceiptResponse {
  receipt: PaymentReceiptDto;
  verified: boolean;
  verificationStatus: PaymentReceiptStatus;
  verificationSource: VerificationSource | string;
  paymentStatus: string;
  orderStatus: string;
  orderNumber: string;
  officialReceiptUrl?: string | null;
  cbeReceiptToken?: string | null;
  message: string;
  failureReason?: string | null;
}

export interface ReceiptAccessUrlResponse {
  accessUrl: string;
  mimeType: string;
  fileName: string;
  expiresInSeconds: number;
}

export interface PaymentStatusResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentId?: string;
  provider: string;
  paymentStatus: string;
  verificationStatus?: PaymentReceiptStatus | null;
  verificationSource?: VerificationSource | string;
  transactionReference: string;
  officialReceiptUrl?: string | null;
  cbeReceiptToken?: string | null;
  officialReceiptReason?: string | null;
  extractedReference?: string | null;
  amountETB: number;
  extractedAmountETB?: number | null;
  verifiedAmountETB?: number | null;
  currency: string;
  verifiedAt?: string | null;
  receivingAccountName?: string;
  receivingAccountNumber?: string;
  reviewReason?: string | null;
  failureReason?: string | null;
  receiptStatus?: PaymentReceiptStatus | null;
  latestReceipt?: PaymentReceiptDto | null;
  receipts?: PaymentReceiptDto[];
}

export interface AdminPaymentRecordDto {
  id: string;
  orderId: string;
  orderNumber: string;
  userId?: string | null;
  customerName: string;
  customerEmail: string;
  provider: string;
  paymentMethod: string;
  transactionReference: string;
  verifiedReference?: string | null;
  officialReceiptUrl?: string | null;
  cbeReceiptToken?: string | null;
  officialReceiptReason?: string | null;
  extractedReference?: string | null;
  amountETB: number;
  extractedAmountETB?: number | null;
  verifiedAmountETB?: number | null;
  expectedOrderTotalETB: number;
  currency: string;
  paymentStatus: string;
  verificationSource?: VerificationSource | string;
  failureReason?: string | null;
  orderStatus: string;
  senderName?: string | null;
  senderAccount?: string | null;
  receiverName?: string | null;
  receiverAccount?: string | null;
  transactionDate?: string | null;
  sourceUrl?: string | null;
  verifiedAt?: string | null;
  reviewedByAdminId?: string | null;
  reviewReason?: string | null;
  reviewedAt?: string | null;
  verificationResponse?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  isDuplicateReference: boolean;
  receiptStatus?: PaymentReceiptStatus | null;
  latestReceipt?: PaymentReceiptDto | null;
  receipts: PaymentReceiptDto[];
  logs: PaymentVerificationLogDto[];
}

export interface PaymentProviderConfigDto {
  id: string;
  providerCode: string;
  displayName: string;
  receivingAccountName: string;
  receivingAccountNumber: string;
  accountSuffixDigits?: number | null;
  instructions?: string | null;
  isEnabled: boolean;
  maxPaymentAgeDays: number;
  updatedAt: string;
}

