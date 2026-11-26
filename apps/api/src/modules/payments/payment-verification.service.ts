import {
  HTTP_STATUS,
  resolveOfficialReceiptLink,
  validateOfficialReceiptUrl,
} from "@addisgebeya/shared";
import type {
  AdminPaymentRecordDto,
  PaymentFormatOption,
  PaymentProviderConfigDto,
  PaymentProviderInfo,
  PaymentReceiptDto,
  PaymentReceiptStatus,
  PaymentStatusResponse,
  PaymentVerificationResponse,
  ReceiptAccessUrlResponse,
  ReceiptOcrExtractionDto,
  SubmitPaymentReceiptResponse,
} from "@addisgebeya/types";
import {
  adminPaymentFilterQuerySchema,
  adminRefundPaymentSchema,
  adminReviewPaymentSchema,
  extractReceiptOcrSchema,
  submitPaymentReceiptSchema,
  updatePaymentProviderConfigSchema,
  verifyPaymentRequestSchema,
  verifyReceiptByIdSchema,
} from "@addisgebeya/validation";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { signReceiptAccessToken } from "../../utils/jwt.js";
import { cloudinaryService } from "../media/cloudinary.service.js";
import { notificationService } from "../notifications/notification.service.js";
import {
  chekiClient,
  type ChekiBankMetadata,
  type ChekiClientAdapter,
  type ChekiHealthBankItem,
  type ChekiVerifyRequest,
  type ChekiVerifySuccessPayload,
} from "./cheki.client.js";
import {
  DEFAULT_PAYMENT_PROVIDER_CONFIGS,
  ensurePaymentProviderConfigsSeeded,
} from "./payment-providers.seed.js";
import { receiptOcrService } from "./receipt-ocr.service.js";

const PROVIDER_DISPLAY_PRIORITY = [
  "cbe",
  "telebirr",
  "boa",
  "dashen",
  "awash",
  "cbebirr",
  "mpesa",
  "siinqee",
  "wegagen",
  "bunna",
  "zamzam",
  "ebirr",
];

const FALLBACK_LIVE_BANKS: ChekiBankMetadata[] = DEFAULT_PAYMENT_PROVIDER_CONFIGS.map((cfg) => ({
  id: cfg.providerCode,
  name: cfg.displayName,
  type: cfg.providerCode === "telebirr" || cfg.providerCode === "mpesa" || cfg.providerCode === "ebirr"
    ? "mobile"
    : cfg.providerCode === "cbebirr"
      ? "wallet"
      : "bank",
  status: "live",
  requiresAccount: cfg.providerCode === "boa",
  accountDigits: cfg.accountSuffixDigits ?? undefined,
  requiresPhone: cfg.providerCode === "cbebirr",
  color: "#14284B",
  initials: cfg.providerCode.slice(0, 3).toUpperCase(),
  formats: [],
}));

const CASE_INSENSITIVE_PROVIDERS = new Set(["cbe", "boa", "telebirr", "mpesa", "dashen", "cbebirr"]);

/** Normalizes a transaction reference or receipt link for reliable duplicate detection. */
export function normalizePaymentReference(provider: string, rawRef: string): string {
  const trimmed = rawRef.trim();
  if (!trimmed) return "";

  const normalizedProvider = provider.trim().toLowerCase();

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return `${normalizedProvider}:${parsed.hostname.toLowerCase()}${parsed.pathname}${parsed.search}`;
    } catch {
      return `${normalizedProvider}:${trimmed}`;
    }
  }

  const isLegacyCbeFt = normalizedProvider === "cbe" && /^ft/i.test(trimmed);
  if (CASE_INSENSITIVE_PROVIDERS.has(normalizedProvider) && (normalizedProvider !== "cbe" || isLegacyCbeFt)) {
    return `${normalizedProvider}:${trimmed.replace(/[\s-]+/g, "").toUpperCase()}`;
  }

  return `${normalizedProvider}:${trimmed}`;
}

/** Decimal-safe monetary comparison using integer santims (1 ETB = 100 santims). */
export function amountsMatchInSantim(expectedETB: number, verifiedAmount: unknown): boolean {
  const num = typeof verifiedAmount === "number" ? verifiedAmount : Number(verifiedAmount);
  if (!Number.isFinite(expectedETB) || !Number.isFinite(num) || num <= 0 || expectedETB <= 0) {
    return false;
  }
  return Math.round(expectedETB * 100) === Math.round(num * 100);
}

/** Normalizes Ethiopian mobile account representations (09... vs 2519...). */
function expandAccountCandidates(accountNumber: string): string[] {
  const clean = accountNumber.replace(/[\s-]+/g, "");
  const variants = new Set<string>([clean]);
  if (clean.startsWith("251") && clean.length === 12) {
    variants.add(`0${clean.slice(3)}`);
    variants.add(clean.slice(3));
  } else if (clean.startsWith("0") && clean.length === 10) {
    variants.add(`251${clean.slice(1)}`);
    variants.add(clean.slice(1));
  }
  return Array.from(variants);
}

/** Matches a masked bank account (e.g. "1****6171") against a configured full account number. */
export function doesMaskedAccountMatch(
  bankMaskedAccount: string | null | undefined,
  configuredAccount: string | null | undefined,
): boolean {
  if (!bankMaskedAccount || !configuredAccount) return false;

  const maskedClean = bankMaskedAccount.replace(/[\s-]+/g, "").toUpperCase();
  const candidates = expandAccountCandidates(configuredAccount).map((c) => c.toUpperCase());

  if (!maskedClean.includes("*")) {
    return candidates.some(
      (cand) =>
        cand === maskedClean ||
        (cand.length >= 5 && maskedClean.length >= 5 && cand.endsWith(maskedClean)),
    );
  }

  const parts = maskedClean.split(/\*+/);
  const prefix = parts[0] ?? "";
  const suffix = parts[parts.length - 1] ?? "";

  if (suffix.length < 3 && prefix.length < 3) {
    return false;
  }

  return candidates.some((cand) => {
    const prefixOk = prefix ? cand.startsWith(prefix) : true;
    const suffixOk = suffix ? cand.endsWith(suffix) : true;
    return prefixOk && suffixOk;
  });
}

function doesReceiverNameMatch(
  bankReceiverName: string | null | undefined,
  configuredName: string | null | undefined,
): boolean {
  if (!bankReceiverName || !configuredName) return false;
  const normBank = bankReceiverName.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = configuredName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  if (tokens.length === 0) return false;
  const matchedTokens = tokens.filter((t) => normBank.includes(t));
  return matchedTokens.length >= Math.min(2, tokens.length);
}

export function doesBankMatchProvider(
  selectedProvider: string,
  responseBankCode?: string,
  responseBankName?: string,
  expectedProviderName?: string,
): boolean {
  const normSelected = selectedProvider.toLowerCase();
  if (responseBankCode) {
    const code = responseBankCode.toLowerCase();
    if (code === normSelected) return true;
    if (normSelected === "cbe" && code === "cbe-new") return true;
    return false;
  }
  if (responseBankName && expectedProviderName) {
    const resp = responseBankName.toLowerCase();
    const exp = expectedProviderName.toLowerCase();
    return resp.includes(exp.split(" ")[0] ?? exp) || exp.includes(resp.split(" ")[0] ?? resp);
  }
  return true;
}

/** Ensures verified transaction happened within the provider's configured maxPaymentAgeDays window. */
export function isTransactionWithinAcceptablePeriod(
  rawDate: unknown,
  _orderCreatedAt: Date,
  maxPaymentAgeDays: number,
  now: Date = new Date(),
): boolean {
  if (typeof rawDate !== "string" || !rawDate.trim()) {
    return false;
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const safeAgeDays =
    Number.isFinite(maxPaymentAgeDays) && maxPaymentAgeDays >= 1 ? maxPaymentAgeDays : 1;
  const oldestAllowedByAgeMs = now.getTime() - safeAgeDays * 24 * 60 * 60 * 1000;

  // Allow up to +24h forward skew for timezone differences across Ethiopian bank portals
  const maxAllowedMs = now.getTime() + 24 * 60 * 60 * 1000;

  return parsed.getTime() >= oldestAllowedByAgeMs && parsed.getTime() <= maxAllowedMs;
}

function sanitizeChekiPayload(data: ChekiVerifySuccessPayload): Prisma.InputJsonValue {
  return {
    success: Boolean(data.success),
    verified: Boolean(data.verified),
    decodedOnly: Boolean(data.decodedOnly),
    parsed: Boolean(data.parsed),
    bank: data.bank ?? null,
    bankCode: data.bankCode ?? null,
    reference: data.reference ?? null,
    amount: data.amount ?? null,
    currency: data.currency ?? null,
    senderName: data.senderName ?? null,
    senderAccount: data.senderAccount ?? null,
    receiverName: data.receiverName ?? null,
    receiverAccount: data.receiverAccount ?? null,
    date: data.date ?? null,
    sourceUrl: data.sourceUrl ?? null,
    cached: Boolean(data.cached),
    durationMs: data.durationMs ?? null,
  };
}

function buildVerifiedTrackingTimeline(
  existingEvents: unknown,
  providerLabel: string,
  reference: string,
): Prisma.InputJsonValue {
  const baseEvents = Array.isArray(existingEvents) ? [...existingEvents] : [];
  const nextEvent = {
    step: "Payment Verified & Order Confirmed",
    description: `Payment confirmed via ${providerLabel} (Ref: ${reference}). Preparing shoes for dispatch.`,
    timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    completed: true,
    current: true,
  };

  const cleared = baseEvents.map((ev) =>
    ev && typeof ev === "object" ? { ...(ev as Record<string, unknown>), current: false } : ev,
  );
  return [...cleared, nextEvent] as Prisma.InputJsonValue;
}

function buildReceiptSubmittedTrackingTimeline(
  existingEvents: unknown,
  providerLabel: string,
  captureMethod: string,
): Prisma.InputJsonValue {
  const baseEvents = Array.isArray(existingEvents) ? [...existingEvents] : [];
  const nextEvent = {
    step: "Payment Receipt Submitted",
    description: `Receipt (${captureMethod === "camera" ? "camera capture" : "uploaded file"}) submitted for ${providerLabel}. Waiting for administrator verification.`,
    timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    completed: true,
    current: true,
  };

  const cleared = baseEvents.map((ev) =>
    ev && typeof ev === "object" ? { ...(ev as Record<string, unknown>), current: false } : ev,
  );
  return [...cleared, nextEvent] as Prisma.InputJsonValue;
}

function assertValidSubmittedOfficialUrl(
  provider: string,
  rawUrl?: string | null,
): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;
  const validated = validateOfficialReceiptUrl(provider, trimmed);
  if (!validated) {
    throw new AppError({
      message:
        "Official receipt URL is invalid or does not match an authorized payment provider domain.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: "INVALID_OFFICIAL_RECEIPT_URL",
    });
  }
  return validated;
}

export interface PaymentActor {
  userId?: string | null;
  guestSessionId?: string | null;
  role: "CUSTOMER" | "ADMIN";
}

function canActorAccessOrder(
  order: { userId?: string | null; guestSessionId?: string | null },
  actor: PaymentActor,
  receiptUserId?: string | null,
): boolean {
  if (actor.role === "ADMIN") {
    return true;
  }
  if (actor.userId) {
    return (
      (Boolean(receiptUserId) && receiptUserId === actor.userId) ||
      (Boolean(order.userId) && order.userId === actor.userId)
    );
  }
  if (actor.guestSessionId) {
    return (
      !order.userId &&
      Boolean(order.guestSessionId) &&
      order.guestSessionId === actor.guestSessionId
    );
  }
  return false;
}

function mapReceiptRecordToDto(
  r: {
    id: string;
    paymentId: string;
    orderId: string;
    userId: string | null;
    provider: string;
    transactionReference: string | null;
    extractedReference: string | null;
    extractedQrData: string | null;
    officialReceiptUrl: string | null;
    cbeReceiptToken: string | null;
    extractedAmount: unknown;
    extractedDate: string | null;
    extractedSenderName: string | null;
    extractedSenderAccount: string | null;
    extractedReceiverName: string | null;
    extractedReceiverAccount: string | null;
    extractedStatus: string | null;
    detectedProvider: string | null;
    ocrConfidence: number | null;
    ocrCompletedAt: Date | null;
    verifiedAmount: unknown;
    verifiedCurrency: string | null;
    verificationSource: string;
    failureReason: string | null;
    providerResponse: unknown;
    verifiedAt: Date | null;
    imageUrl: string;
    publicId: string;
    mimeType: string;
    fileSizeBytes: number;
    width: number | null;
    height: number | null;
    captureMethod: string;
    status: string;
    rejectionReason: string | null;
    resubmissionRequested: boolean;
    reviewedByAdminId: string | null;
    reviewedAt: Date | null;
    submittedAt: Date;
  },
  orderNumber: string,
  customerName?: string,
): PaymentReceiptDto {
  let resolvedUrl = r.imageUrl;
  if (r.publicId) {
    try {
      const signed = cloudinaryService.getSignedAuthenticatedUrl(r.publicId, r.mimeType);
      if (signed) resolvedUrl = signed;
    } catch {
      resolvedUrl = r.imageUrl;
    }
  }

  const officialLink = resolveOfficialReceiptLink({
    provider: r.provider,
    transactionReference: r.transactionReference,
    extractedReference: r.extractedReference,
    officialReceiptUrl: r.officialReceiptUrl,
    cbeReceiptToken: r.cbeReceiptToken,
    qrData: r.extractedQrData,
  });

  return {
    id: r.id,
    paymentId: r.paymentId,
    orderId: r.orderId,
    orderNumber,
    userId: r.userId,
    customerName,
    provider: r.provider,
    transactionReference: r.transactionReference,
    extractedReference: r.extractedReference ?? null,
    extractedQrData: r.extractedQrData ?? null,
    officialReceiptUrl: officialLink.officialReceiptUrl,
    cbeReceiptToken: officialLink.cbeReceiptToken,
    officialReceiptReason: officialLink.reason ?? null,
    extractedAmountETB: r.extractedAmount != null ? Number(r.extractedAmount) : null,
    extractedDate: r.extractedDate ?? null,
    extractedSenderName: r.extractedSenderName ?? null,
    extractedSenderAccount: r.extractedSenderAccount ?? null,
    extractedReceiverName: r.extractedReceiverName ?? null,
    extractedReceiverAccount: r.extractedReceiverAccount ?? null,
    extractedStatus: r.extractedStatus ?? null,
    detectedProvider: r.detectedProvider ?? null,
    ocrConfidence: r.ocrConfidence ?? null,
    ocrCompletedAt: r.ocrCompletedAt?.toISOString() ?? null,
    verifiedAmountETB: r.verifiedAmount != null ? Number(r.verifiedAmount) : null,
    verifiedCurrency: r.verifiedCurrency ?? null,
    verificationSource: r.verificationSource || "pending",
    failureReason: r.failureReason ?? null,
    providerResponse:
      r.providerResponse && typeof r.providerResponse === "object"
        ? (r.providerResponse as Record<string, unknown>)
        : null,
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    imageUrl: resolvedUrl,
    fileUrl: `/payment/receipts/${r.id}/file`,
    mimeType: r.mimeType,
    fileSizeBytes: r.fileSizeBytes,
    width: r.width,
    height: r.height,
    captureMethod: r.captureMethod,
    status: (r.status as PaymentReceiptStatus) || "Pending",
    rejectionReason: r.rejectionReason,
    resubmissionRequested: r.resubmissionRequested,
    reviewedByAdminId: r.reviewedByAdminId,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    submittedAt: r.submittedAt.toISOString(),
  };
}

export class PaymentVerificationService {
  constructor(private readonly client: ChekiClientAdapter = chekiClient) {}

  async getSupportedProviders(): Promise<PaymentProviderInfo[]> {
    await ensurePaymentProviderConfigsSeeded();

    let chekiBanks: ChekiBankMetadata[] = [];
    let healthItems: ChekiHealthBankItem[] = [];

    try {
      [chekiBanks, healthItems] = await Promise.all([
        this.client.getBanks(),
        this.client.getHealth(),
      ]);
    } catch {
      chekiBanks = FALLBACK_LIVE_BANKS;
      healthItems = [];
    }

    const dbConfigs = await prisma.paymentProviderConfig.findMany({
      where: { isEnabled: true },
    });
    const configByCode = new Map(dbConfigs.map((c) => [c.providerCode.toLowerCase(), c]));
    const healthByCode = new Map(healthItems.map((h) => [h.id.toLowerCase(), h]));

    const providers: PaymentProviderInfo[] = [];

    for (const bank of chekiBanks) {
      const id = bank.id.toLowerCase();
      if (id === "cbe-new") continue;
      if (bank.status !== "live") continue;

      const supportedFormats: PaymentFormatOption[] = (bank.formats ?? [])
        .filter((f) => f.supported)
        .map((f) => ({
          id: f.id,
          status: f.status,
          label: f.label,
          inputs: f.inputs,
          accountDigits: f.accountDigits,
          responseType: f.responseType,
          supported: f.supported,
        }));

      if ((bank.formats?.length ?? 0) > 0 && supportedFormats.length === 0) {
        continue;
      }

      const dbConfig = configByCode.get(id);
      if (configByCode.size > 0 && !dbConfig) {
        // Admin explicitly disabled or unconfigured this bank
        continue;
      }

      const health = healthByCode.get(id);
      const allInputs = new Set(supportedFormats.flatMap((f) => f.inputs));

      providers.push({
        id,
        name: dbConfig?.displayName || bank.name,
        swift: bank.swift,
        type: bank.type,
        status: bank.status,
        beta: bank.beta,
        requiresAccount: Boolean(bank.requiresAccount || allInputs.has("account")),
        accountDigits: dbConfig?.accountSuffixDigits ?? bank.accountDigits,
        requiresPhone: Boolean(bank.requiresPhone || allInputs.has("phone")),
        supportsQr: allInputs.has("qr"),
        supportsLink: allInputs.has("link") || allInputs.has("receiptId"),
        color: bank.color || "#14284B",
        initials: bank.initials || id.slice(0, 3).toUpperCase(),
        formats: supportedFormats,
        healthStatus: health?.status ?? "unknown",
        receivingAccountName:
          dbConfig?.receivingAccountName || "AddisGebeya Footwear Trading PLC",
        receivingAccountNumber: dbConfig?.receivingAccountNumber || "",
        instructions: dbConfig?.instructions ?? null,
      });
    }

    providers.sort((a, b) => {
      const ia = PROVIDER_DISPLAY_PRIORITY.indexOf(a.id);
      const ib = PROVIDER_DISPLAY_PRIORITY.indexOf(b.id);
      const rankA = ia === -1 ? 999 : ia;
      const rankB = ib === -1 ? 999 : ib;
      return rankA - rankB || a.name.localeCompare(b.name);
    });

    return providers;
  }

  async verifyPayment(
    rawInput: unknown,
    actor: PaymentActor,
  ): Promise<PaymentVerificationResponse> {
    const input = verifyPaymentRequestSchema.parse(rawInput);
    const providerCode = input.provider.trim().toLowerCase();

    await ensurePaymentProviderConfigsSeeded();

    // 1. Find Order cleanly by ID or OrderNumber
    const normalizedOrderKey = input.orderId.replace(/^#/, "").trim();
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: normalizedOrderKey },
          { orderNumber: normalizedOrderKey },
          { orderNumber: `AG-${normalizedOrderKey}` },
        ],
      },
      include: { payment: true },
    });

    if (!order) {
      throw new AppError({
        message: `Order "${input.orderId}" not found`,
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ORDER_NOT_FOUND",
      });
    }

    // 2. Customer / verified guest session ownership check
    if (!canActorAccessOrder(order, actor)) {
      throw new AppError({
        message: "You do not have permission to verify payment for this order.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "FORBIDDEN",
      });
    }

    // 3. Validate provider is live and configured
    const providers = await this.getSupportedProviders();
    const matchedProvider = providers.find((p) => p.id === providerCode);
    const providerConfig = await prisma.paymentProviderConfig.findUnique({
      where: { providerCode },
    });

    if (!matchedProvider || !providerConfig || !providerConfig.isEnabled) {
      throw new AppError({
        message: `Payment provider "${input.provider}" is not currently supported for verification.`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "UNSUPPORTED_PAYMENT_PROVIDER",
      });
    }

    const submittedReference = input.reference?.trim() || "";
    const submittedQr = input.qrData?.trim() || "";
    const submittedPhone = input.phoneNumber?.trim() || "";
    const submittedOfficialReceiptUrl = assertValidSubmittedOfficialUrl(
      providerCode,
      input.officialReceiptUrl,
    );
    const submittedCbeToken = input.cbeReceiptToken?.trim() || "";
    const initialVerifyLink = resolveOfficialReceiptLink({
      provider: providerCode,
      transactionReference: submittedReference || null,
      officialReceiptUrl: submittedOfficialReceiptUrl,
      cbeReceiptToken: submittedCbeToken || null,
      qrData: submittedQr || null,
    });

    // 4. Ensure a Payment row exists for this order
    let payment = order.payment;
    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          provider: providerCode,
          paymentMethod: providerCode,
          transactionReference: submittedReference || `PENDING-${order.orderNumber}`,
          officialReceiptUrl: initialVerifyLink.officialReceiptUrl,
          cbeReceiptToken: initialVerifyLink.cbeReceiptToken,
          amount: order.totalETB,
          currency: "ETB",
          paymentStatus: "Pending",
        },
      });
    }

    // 5. Idempotency: if already Paid, return immediately without re-calling Cheki
    if (payment.paymentStatus === "Paid" || payment.paymentStatus === "verified") {
      const paidProvider = payment.provider || providerCode;
      const paidOfficialLink = resolveOfficialReceiptLink({
        provider: paidProvider,
        transactionReference: payment.transactionReference,
        verifiedReference: payment.verifiedReference,
        officialReceiptUrl:
          payment.officialReceiptUrl ??
          (paidProvider.toLowerCase() === providerCode ? submittedOfficialReceiptUrl : null),
        sourceUrl: payment.sourceUrl,
        cbeReceiptToken:
          payment.cbeReceiptToken ??
          (paidProvider.toLowerCase() === providerCode ? submittedCbeToken : null),
        qrData: submittedQr || null,
      });
      return {
        verified: true,
        alreadyPaid: true,
        paymentStatus: "Paid",
        orderStatus: order.status === "PendingPayment" ? "Confirmed" : order.status,
        orderNumber: order.orderNumber,
        provider: paidProvider,
        reference: payment.transactionReference,
        amountETB: Number(payment.amount),
        currency: payment.currency || "ETB",
        verifiedAt: (payment.verifiedAt ?? payment.paidAt)?.toISOString() ?? null,
        officialReceiptUrl: paidOfficialLink.officialReceiptUrl,
        cbeReceiptToken: paidOfficialLink.cbeReceiptToken,
        officialReceiptReason: paidOfficialLink.reason ?? null,
        message: "Payment successfully verified! Your AddisGebeya order has been confirmed.",
      };
    }

    // 6. Validate required conditional provider fields
    const isLinkInput = /^https?:\/\//i.test(submittedReference);
    const isLegacyCbeFt = providerCode === "cbe" && /^ft/i.test(submittedReference);

    if (matchedProvider.requiresPhone && !submittedPhone && !submittedQr) {
      throw new AppError({
        message: `${matchedProvider.name} requires your payer phone number unless submitting a QR payload.`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "PHONE_REQUIRED",
      });
    }

    // 7. Acquire atomic concurrency lock ("VerificationPending") to prevent double-submit races
    const lockResult = await prisma.payment.updateMany({
      where: {
        id: payment.id,
        paymentStatus: { notIn: ["VerificationPending", "Paid", "verified"] },
      },
      data: {
        paymentStatus: "VerificationPending",
        provider: providerCode,
        paymentMethod: providerCode,
      },
    });

    if (lockResult.count === 0) {
      const latest = await prisma.payment.findUnique({ where: { id: payment.id } });
      if (latest?.paymentStatus === "Paid") {
        const latestOfficialLink = resolveOfficialReceiptLink({
          provider: latest.provider,
          transactionReference: latest.transactionReference,
          verifiedReference: latest.verifiedReference,
          officialReceiptUrl: latest.officialReceiptUrl,
          sourceUrl: latest.sourceUrl,
          cbeReceiptToken: latest.cbeReceiptToken,
          qrData: submittedQr || null,
        });
        return {
          verified: true,
          alreadyPaid: true,
          paymentStatus: "Paid",
          orderStatus: "Confirmed",
          orderNumber: order.orderNumber,
          provider: latest.provider,
          reference: latest.transactionReference,
          amountETB: Number(latest.amount),
          currency: latest.currency,
          verifiedAt: latest.verifiedAt?.toISOString() ?? null,
          officialReceiptUrl: latestOfficialLink.officialReceiptUrl,
          cbeReceiptToken: latestOfficialLink.cbeReceiptToken,
          officialReceiptReason: latestOfficialLink.reason ?? null,
          message: "Payment successfully verified! Your AddisGebeya order has been confirmed.",
        };
      }
      throw new AppError({
        message: "Payment verification is already in progress for this order. Please wait a moment.",
        statusCode: HTTP_STATUS.CONFLICT,
        code: "VERIFICATION_IN_PROGRESS",
      });
    }

    const previousStatus = payment.paymentStatus || "Pending";

    try {
      // 8. Check duplicate reference BEFORE invoking Cheki
      const candidateNormalizedRef = submittedReference
        ? normalizePaymentReference(providerCode, submittedReference)
        : "";

      if (candidateNormalizedRef) {
        const duplicate = await prisma.payment.findFirst({
          where: {
            id: { not: payment.id },
            OR: [
              { verifiedReference: candidateNormalizedRef },
              {
                transactionReference: { equals: submittedReference, mode: "insensitive" },
                paymentStatus: { in: ["Paid", "ReviewRequired"] },
              },
            ],
          },
          select: { id: true, orderId: true },
        });

        if (duplicate) {
          await this.recordFailedOutcome(
            payment.id,
            order.id,
            actor.userId,
            providerCode,
            submittedReference,
            "Failed",
            "Duplicate transaction reference: this reference has already been used for another order.",
            HTTP_STATUS.CONFLICT,
            null,
          );
          throw new AppError({
            message:
              "This transaction reference has already been used for another order. Duplicate references are not permitted.",
            statusCode: HTTP_STATUS.CONFLICT,
            code: "DUPLICATE_TRANSACTION_REFERENCE",
          });
        }
      }

      // 9. Build Cheki request using configured store receiving account where required
      const chekiRequest: ChekiVerifyRequest = {
        bank: providerCode,
      };

      if (submittedQr) {
        chekiRequest.qrData = submittedQr;
      }
      if (submittedReference) {
        chekiRequest.reference = submittedReference;
      }
      if (submittedPhone) {
        chekiRequest.phoneNumber = submittedPhone;
      }

      if ((providerCode === "boa" || isLegacyCbeFt) && !submittedQr && !isLinkInput) {
        const suppliedAcc = input.accountNumber?.replace(/[\s-]+/g, "").trim();
        if (suppliedAcc) {
          const digits = providerConfig.accountSuffixDigits ?? (providerCode === "boa" ? 5 : 8);
          const expectedSuffix = providerConfig.receivingAccountNumber.slice(-digits);
          if (suppliedAcc.slice(-digits) !== expectedSuffix) {
            await this.recordFailedOutcome(
              payment.id,
              order.id,
              actor.userId,
              providerCode,
              submittedReference,
              "ReviewRequired",
              "Provided receiving account digits do not match AddisGebeya's configured receiving account.",
              HTTP_STATUS.UNPROCESSABLE_ENTITY,
              null,
            );
            throw new AppError({
              message:
                "The receiving account entered does not match AddisGebeya's configured bank account. Your payment has been flagged for administrator review.",
              statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
              code: "RECEIVING_ACCOUNT_MISMATCH",
            });
          }
        }
        chekiRequest.accountNumber = providerConfig.receivingAccountNumber;
      } else if (input.accountNumber?.trim()) {
        chekiRequest.accountNumber = input.accountNumber.trim();
      }

      // 10. Call Cheki API
      const chekiOutcome = await this.client.verifyReceipt(chekiRequest);

      if (chekiOutcome.outcome === "rate_limited") {
        await this.restorePendingAndLog(
          payment.id,
          order.id,
          actor.userId,
          providerCode,
          submittedReference || submittedQr,
          previousStatus === "VerificationPending" ? "Pending" : previousStatus,
          "RateLimited",
          chekiOutcome.error,
          429,
          null,
        );
        throw new AppError({
          message: `Verification service rate limit reached. Please retry in ${chekiOutcome.retryAfterSeconds} seconds.`,
          statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
          code: "CHEKI_RATE_LIMITED",
        });
      }

      if (chekiOutcome.outcome === "unavailable") {
        await this.restorePendingAndLog(
          payment.id,
          order.id,
          actor.userId,
          providerCode,
          submittedReference || submittedQr,
          "Pending",
          "ProviderUnavailable",
          chekiOutcome.error,
          chekiOutcome.httpStatus,
          null,
        );
        throw new AppError({
          message:
            "Your payment verification is currently unavailable. Your order remains pending until verification is completed.",
          statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
          code: "VERIFICATION_UNAVAILABLE",
        });
      }

      if (chekiOutcome.outcome === "rejected") {
        await this.recordFailedOutcome(
          payment.id,
          order.id,
          actor.userId,
          providerCode,
          submittedReference || submittedQr,
          "Failed",
          chekiOutcome.error,
          chekiOutcome.httpStatus,
          null,
        );
        throw new AppError({
          message:
            "We could not verify your transaction. Please check your transaction reference and try again.",
          statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: "VERIFICATION_FAILED",
        });
      }

      // 11. Strict Validation on Cheki 200 OK response
      const chekiData = chekiOutcome.data;
      const sanitizedResponse = sanitizeChekiPayload(chekiData);

      // Reject decodedOnly QR, parsed-only results, or unverified results
      if (
        chekiData.success !== true ||
        chekiData.verified !== true ||
        chekiData.decodedOnly === true ||
        chekiData.parsed === true
      ) {
        await this.recordFailedOutcome(
          payment.id,
          order.id,
          actor.userId,
          providerCode,
          submittedReference || submittedQr,
          "Failed",
          chekiData.decodedOnly
            ? "Decoded-only QR result cannot verify payment."
            : chekiData.parsed
              ? "Parsed-only receipt cannot verify payment."
              : chekiData.error || "Transaction not confirmed by financial institution.",
          200,
          sanitizedResponse,
        );
        throw new AppError({
          message:
            "We could not verify your transaction. Please check your transaction reference and try again.",
          statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: "VERIFICATION_FAILED",
        });
      }

      // Bank provider consistency check
      if (
        !doesBankMatchProvider(
          providerCode,
          chekiData.bankCode,
          chekiData.bank,
          matchedProvider.name,
        )
      ) {
        await this.flagForManualReview(
          payment.id,
          order.id,
          actor.userId,
          providerCode,
          chekiData.reference || submittedReference,
          `Bank mismatch: submitted for ${matchedProvider.name}, bank returned ${chekiData.bank || chekiData.bankCode}.`,
          sanitizedResponse,
          chekiData,
        );
        throw new AppError({
          message:
            "The verified receipt belongs to a different payment provider and has been flagged for administrator review.",
          statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: "PROVIDER_MISMATCH",
        });
      }

      // Currency check (strict ETB)
      if (!chekiData.currency || chekiData.currency.trim().toUpperCase() !== "ETB") {
        await this.flagForManualReview(
          payment.id,
          order.id,
          actor.userId,
          providerCode,
          chekiData.reference || submittedReference,
          `Currency mismatch: expected ETB, received "${chekiData.currency ?? "unknown"}".`,
          sanitizedResponse,
          chekiData,
        );
        throw new AppError({
          message: "Only ETB transactions are accepted. Transaction flagged for administrator review.",
          statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: "CURRENCY_MISMATCH",
        });
      }

      // Exact decimal-safe ETB amount check using backend order total
      const expectedTotalETB = Number(order.totalETB);
      if (!amountsMatchInSantim(expectedTotalETB, chekiData.amount)) {
        await this.flagForManualReview(
          payment.id,
          order.id,
          actor.userId,
          providerCode,
          chekiData.reference || submittedReference,
          `Amount mismatch: expected ${expectedTotalETB.toFixed(2)} ETB, bank shows ${chekiData.amount ?? "unknown"} ETB.`,
          sanitizedResponse,
          chekiData,
        );
        throw new AppError({
          message:
            "Verified transaction amount does not match the order total. Your payment has been flagged for administrator review.",
          statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: "AMOUNT_MISMATCH",
        });
      }

      // Receiving account verification against configured AddisGebeya account
      const accountVerified = chekiData.receiverAccount
        ? doesMaskedAccountMatch(chekiData.receiverAccount, providerConfig.receivingAccountNumber)
        : chekiData.receiverName
          ? doesReceiverNameMatch(chekiData.receiverName, providerConfig.receivingAccountName)
          : false;

      if (!accountVerified) {
        await this.flagForManualReview(
          payment.id,
          order.id,
          actor.userId,
          providerCode,
          chekiData.reference || submittedReference,
          `Receiving account mismatch: expected ${providerConfig.receivingAccountName} (${providerConfig.receivingAccountNumber}), receipt shows ${chekiData.receiverName ?? ""} ${chekiData.receiverAccount ?? ""}.`,
          sanitizedResponse,
          chekiData,
        );
        throw new AppError({
          message:
            "Transfer recipient does not match AddisGebeya's receiving account. Transaction flagged for administrator review.",
          statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: "RECEIVING_ACCOUNT_MISMATCH",
        });
      }

      // Acceptable payment period check
      if (
        !isTransactionWithinAcceptablePeriod(
          chekiData.date,
          order.createdAt,
          providerConfig.maxPaymentAgeDays,
        )
      ) {
        await this.flagForManualReview(
          payment.id,
          order.id,
          actor.userId,
          providerCode,
          chekiData.reference || submittedReference,
          `Expired or out-of-window transaction date: ${chekiData.date ?? "missing"}.`,
          sanitizedResponse,
          chekiData,
        );
        throw new AppError({
          message:
            "Transaction date is outside the acceptable payment period and requires administrator review.",
          statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: "TRANSACTION_EXPIRED",
        });
      }

      // 12. Canonical verified reference duplicate check & atomic order confirmation
      const canonicalBankRef = (chekiData.reference || submittedReference || submittedQr).trim();
      const canonicalVerifiedKey = normalizePaymentReference(providerCode, canonicalBankRef);
      const parsedTxDate = chekiData.date ? new Date(chekiData.date) : null;
      const validTxDate =
        parsedTxDate && !Number.isNaN(parsedTxDate.getTime()) ? parsedTxDate : null;
      const now = new Date();
      const sameProviderAsBefore = payment.provider?.toLowerCase() === providerCode;
      const verifiedLink = resolveOfficialReceiptLink({
        provider: providerCode,
        transactionReference: canonicalBankRef,
        verifiedReference: canonicalVerifiedKey,
        officialReceiptUrl:
          submittedOfficialReceiptUrl ??
          (sameProviderAsBefore ? payment.officialReceiptUrl : null),
        sourceUrl:
          chekiData.sourceUrl ?? (sameProviderAsBefore ? payment.sourceUrl : null),
        cbeReceiptToken:
          submittedCbeToken || (sameProviderAsBefore ? payment.cbeReceiptToken : null),
        qrData: submittedQr || null,
      });
      const validatedSourceUrl = validateOfficialReceiptUrl(
        providerCode,
        chekiData.sourceUrl,
      );

      try {
        await prisma.$transaction(async (tx) => {
          const [existingUsed, existingReceiptUsed] = await Promise.all([
            tx.payment.findFirst({
              where: {
                id: { not: payment.id },
                OR: [
                  { verifiedReference: canonicalVerifiedKey },
                  {
                    transactionReference: { equals: canonicalBankRef, mode: "insensitive" },
                    paymentStatus: { in: ["Paid", "ReviewRequired"] },
                  },
                ],
              },
              select: { id: true },
            }),
            tx.paymentReceipt.findFirst({
              where: {
                orderId: { not: order.id },
                normalizedVerifiedReference: canonicalVerifiedKey,
              },
              select: { id: true },
            }),
          ]);

          if (existingUsed || existingReceiptUsed) {
            throw new AppError({
              message: "This transaction reference has already been used for another order.",
              statusCode: HTTP_STATUS.CONFLICT,
              code: "DUPLICATE_TRANSACTION_REFERENCE",
            });
          }

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              userId: order.userId,
              provider: providerCode,
              paymentMethod: providerCode,
              transactionReference: canonicalBankRef,
              verifiedReference: canonicalVerifiedKey,
              amount: expectedTotalETB,
              currency: "ETB",
              paymentStatus: "Paid",
              verificationSource: "provider_api",
              failureReason: null,
              reviewReason: null,
              senderName: chekiData.senderName ?? null,
              senderAccount: chekiData.senderAccount ?? null,
              receiverName: chekiData.receiverName ?? null,
              receiverAccount: chekiData.receiverAccount ?? null,
              transactionDate: validTxDate,
              sourceUrl:
                validatedSourceUrl ??
                (sameProviderAsBefore ? payment.sourceUrl : null) ??
                null,
              officialReceiptUrl: verifiedLink.officialReceiptUrl,
              cbeReceiptToken: verifiedLink.cbeReceiptToken,
              verificationResponse: sanitizedResponse,
              verifiedAt: now,
              paidAt: now,
            },
          });

          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentMethod: providerCode,
              paymentStatus: "Paid",
              paymentReference: canonicalBankRef,
              status: "Confirmed",
              trackingEvents: buildVerifiedTrackingTimeline(
                order.trackingEvents,
                matchedProvider.name,
                canonicalBankRef,
              ),
            },
          });

          const latestActiveReceipt = await tx.paymentReceipt.findFirst({
            where: {
              paymentId: payment.id,
              status: { in: ["Pending", "Processing", "Manual Review"] },
            },
            orderBy: { submittedAt: "desc" },
            select: {
              id: true,
              provider: true,
              officialReceiptUrl: true,
              cbeReceiptToken: true,
              extractedQrData: true,
              extractedReference: true,
            },
          });

          if (latestActiveReceipt) {
            const receiptSameProvider =
              latestActiveReceipt.provider.toLowerCase() === providerCode;
            const receiptLink = resolveOfficialReceiptLink({
              provider: providerCode,
              transactionReference: canonicalBankRef,
              verifiedReference: canonicalVerifiedKey,
              extractedReference: latestActiveReceipt.extractedReference,
              officialReceiptUrl:
                verifiedLink.officialReceiptUrl ??
                (receiptSameProvider ? latestActiveReceipt.officialReceiptUrl : null),
              sourceUrl: validatedSourceUrl,
              cbeReceiptToken:
                verifiedLink.cbeReceiptToken ??
                (receiptSameProvider ? latestActiveReceipt.cbeReceiptToken : null),
              qrData: submittedQr || latestActiveReceipt.extractedQrData,
            });
            await tx.paymentReceipt.update({
              where: { id: latestActiveReceipt.id },
              data: {
                status: "Verified",
                provider: providerCode,
                transactionReference: canonicalBankRef,
                normalizedVerifiedReference: canonicalVerifiedKey,
                officialReceiptUrl: receiptLink.officialReceiptUrl,
                cbeReceiptToken: receiptLink.cbeReceiptToken,
                verifiedAmount: expectedTotalETB,
                verifiedCurrency: "ETB",
                verificationSource: "provider_api",
                failureReason: null,
                providerResponse: sanitizedResponse,
                verifiedAt: now,
                reviewedAt: now,
                rejectionReason: null,
                resubmissionRequested: false,
              },
            });
          }

          await tx.paymentVerificationLog.create({
            data: {
              paymentId: payment.id,
              orderId: order.id,
              userId: actor.userId ?? null,
              provider: providerCode,
              submittedReference: submittedReference || canonicalBankRef,
              verificationStatus: "Paid",
              chekiHttpStatus: 200,
              responseData: sanitizedResponse,
              actorType: actor.role === "ADMIN" ? "admin" : "customer",
              actorId: actor.userId ?? null,
            },
          });

          if (order.userId) {
            await notificationService.createNotification(
              {
                userId: order.userId,
                title: `Payment Verified — Order #${order.orderNumber}`,
                message: `Your payment of ${expectedTotalETB.toLocaleString()} ETB via ${matchedProvider.name} (Ref: ${canonicalBankRef}) has been verified and approved.`,
                type: "payment_verified",
                relatedEntityId: order.orderNumber,
                relatedEntityType: "payment",
                metadata: {
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  paymentId: payment.id,
                  provider: providerCode,
                  reference: canonicalBankRef,
                  amountETB: expectedTotalETB,
                },
                idempotencyKey: `payment-verified:${payment.id}:${canonicalBankRef}`,
              },
              tx,
            );

            if (order.status !== "Confirmed") {
              await notificationService.createNotification(
                {
                  userId: order.userId,
                  title: `Order Confirmed — #${order.orderNumber}`,
                  message: `Your order #${order.orderNumber} is now confirmed and queued for dispatch from AddisGebeya Bole hub.`,
                  type: "order_confirmed",
                  relatedEntityId: order.orderNumber,
                  relatedEntityType: "order",
                  metadata: {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                  },
                  idempotencyKey: `order-confirmed:${order.id}`,
                },
                tx,
              );
            }
          }

          await notificationService.notifyAdmins(
            {
              title: `Payment Verified — Order #${order.orderNumber}`,
              message: `${order.customerName}'s ${matchedProvider.name} payment of ${expectedTotalETB.toLocaleString()} ETB (Ref: ${canonicalBankRef}) for order #${order.orderNumber} was verified.`,
              type: "admin_payment_verified",
              relatedEntityId: order.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                paymentId: payment.id,
                customerName: order.customerName,
                provider: providerCode,
                reference: canonicalBankRef,
                amountETB: expectedTotalETB,
              },
              idempotencyKey: `admin-payment-verified:${payment.id}:${canonicalBankRef}`,
            },
            tx,
          );
        });

        void notificationService.flushOutbox();
      } catch (txErr: unknown) {
        if (
          txErr instanceof Prisma.PrismaClientKnownRequestError &&
          txErr.code === "P2002"
        ) {
          await this.recordFailedOutcome(
            payment.id,
            order.id,
            actor.userId,
            providerCode,
            canonicalBankRef,
            "Failed",
            "Unique constraint caught duplicate verified transaction reference.",
            HTTP_STATUS.CONFLICT,
            sanitizedResponse,
          );
          throw new AppError({
            message: "This transaction reference has already been used for another order.",
            statusCode: HTTP_STATUS.CONFLICT,
            code: "DUPLICATE_TRANSACTION_REFERENCE",
          });
        }
        throw txErr;
      }

      return {
        verified: true,
        alreadyPaid: false,
        paymentStatus: "Paid",
        orderStatus: "Confirmed",
        orderNumber: order.orderNumber,
        provider: providerCode,
        reference: canonicalBankRef,
        amountETB: expectedTotalETB,
        currency: "ETB",
        verifiedAt: now.toISOString(),
        officialReceiptUrl: verifiedLink.officialReceiptUrl,
        cbeReceiptToken: verifiedLink.cbeReceiptToken,
        officialReceiptReason: verifiedLink.reason ?? null,
        message: "Payment successfully verified! Your AddisGebeya order has been confirmed.",
      };
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      // Guarantee lock is never stuck in VerificationPending on unexpected failures
      await this.restorePendingAndLog(
        payment.id,
        order.id,
        actor.userId,
        providerCode,
        submittedReference || submittedQr,
        "Pending",
        "ProviderUnavailable",
        err instanceof Error ? err.message : "Unexpected verification error",
        500,
        null,
      );
      throw new AppError({
        message:
          "Your payment verification is currently unavailable. Your order remains pending until verification is completed.",
        statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
        code: "VERIFICATION_UNAVAILABLE",
      });
    }
  }

  private async restorePendingAndLog(
    paymentId: string,
    orderId: string,
    userId: string | null | undefined,
    provider: string,
    submittedReference: string,
    restorePaymentStatus: string,
    logStatus: string,
    errorMessage: string,
    httpStatus: number,
    responseData: Prisma.InputJsonValue | null,
  ): Promise<void> {
    const resolvedActorId = userId ?? null;
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: paymentId },
        data: {
          paymentStatus: restorePaymentStatus,
          provider,
          paymentMethod: provider,
          ...(submittedReference ? { transactionReference: submittedReference } : {}),
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: restorePaymentStatus,
          status: "PendingPayment",
        },
      }),
      prisma.paymentVerificationLog.create({
        data: {
          paymentId,
          orderId,
          userId: resolvedActorId,
          provider,
          submittedReference: submittedReference || null,
          verificationStatus: logStatus,
          errorMessage,
          chekiHttpStatus: httpStatus,
          responseData: responseData ?? Prisma.JsonNull,
          actorType: "customer",
          actorId: resolvedActorId,
        },
      }),
    ]);
  }

  private async recordFailedOutcome(
    paymentId: string,
    orderId: string,
    userId: string | null | undefined,
    provider: string,
    submittedReference: string,
    nextStatus: "Failed" | "ReviewRequired",
    errorMessage: string,
    httpStatus: number,
    responseData: Prisma.InputJsonValue | null,
  ): Promise<void> {
    const resolvedActorId = userId ?? null;
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          paymentStatus: nextStatus,
          provider,
          paymentMethod: provider,
          ...(submittedReference ? { transactionReference: submittedReference } : {}),
          ...(responseData ? { verificationResponse: responseData } : {}),
          failureReason: errorMessage,
        },
      });

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: nextStatus,
          status: "PendingPayment",
        },
        select: { id: true, orderNumber: true, userId: true, customerName: true },
      });

      await tx.paymentVerificationLog.create({
        data: {
          paymentId,
          orderId,
          userId: resolvedActorId,
          provider,
          submittedReference: submittedReference || null,
          verificationStatus: nextStatus,
          errorMessage,
          chekiHttpStatus: httpStatus,
          responseData: responseData ?? Prisma.JsonNull,
          actorType: "customer",
          actorId: resolvedActorId,
        },
      });

      const customerId = order.userId ?? resolvedActorId;
      const refTag = submittedReference || "none";
      const eventNonce = `${Date.now()}`;

      if (nextStatus === "Failed") {
        if (customerId) {
          await notificationService.createNotification(
            {
              userId: customerId,
              title: `Payment Rejected — Order #${order.orderNumber}`,
              message: `Payment verification failed for order #${order.orderNumber}. Reason: ${errorMessage}`,
              type: "payment_rejected",
              relatedEntityId: order.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                paymentId,
                provider,
                reference: refTag,
                reason: errorMessage,
              },
              idempotencyKey: `payment-rejected:${paymentId}:${refTag}:${eventNonce}`,
            },
            tx,
          );
        }

        await notificationService.notifyAdmins(
          {
            title: `Payment Rejected — Order #${order.orderNumber}`,
            message: `${order.customerName}'s ${provider.toUpperCase()} payment verification for order #${order.orderNumber} failed: ${errorMessage}`,
            type: "admin_payment_rejected",
            relatedEntityId: order.orderNumber,
            relatedEntityType: "payment",
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              paymentId,
              customerName: order.customerName,
              provider,
              reference: refTag,
              reason: errorMessage,
            },
            idempotencyKey: `admin-payment-rejected:${paymentId}:${refTag}:${eventNonce}`,
          },
          tx,
        );
      } else {
        if (customerId) {
          await notificationService.createNotification(
            {
              userId: customerId,
              title: `Payment Requires Manual Review — Order #${order.orderNumber}`,
              message: `Your payment for order #${order.orderNumber} requires administrator verification. Reason: ${errorMessage}`,
              type: "payment_manual_review",
              relatedEntityId: order.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                paymentId,
                provider,
                reason: errorMessage,
              },
              idempotencyKey: `payment-manual-review:${paymentId}:${refTag}:${eventNonce}`,
            },
            tx,
          );
        }

        await notificationService.notifyAdmins(
          {
            title: `Manual Payment Verification Required — #${order.orderNumber}`,
            message: `${order.customerName}'s ${provider.toUpperCase()} payment for order #${order.orderNumber} was flagged for manual review: ${errorMessage}`,
            type: "admin_payment_manual_review",
            relatedEntityId: order.orderNumber,
            relatedEntityType: "payment",
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              paymentId,
              customerName: order.customerName,
              provider,
              reason: errorMessage,
            },
            idempotencyKey: `admin-payment-manual-review:${paymentId}:${refTag}:${eventNonce}`,
          },
          tx,
        );
      }
    });

    void notificationService.flushOutbox();
  }

  private async flagForManualReview(
    paymentId: string,
    orderId: string,
    userId: string | null | undefined,
    provider: string,
    reference: string,
    reason: string,
    sanitizedResponse: Prisma.InputJsonValue,
    chekiData: ChekiVerifySuccessPayload,
    extra?: {
      submittedOfficialReceiptUrl?: string | null;
      submittedCbeToken?: string | null;
      qrData?: string | null;
    },
  ): Promise<void> {
    const resolvedActorId = userId ?? null;
    const parsedTxDate = chekiData.date ? new Date(chekiData.date) : null;
    const validTxDate =
      parsedTxDate && !Number.isNaN(parsedTxDate.getTime()) ? parsedTxDate : null;
    const manualLink = resolveOfficialReceiptLink({
      provider,
      transactionReference: reference || null,
      officialReceiptUrl: extra?.submittedOfficialReceiptUrl,
      sourceUrl: chekiData.sourceUrl ?? null,
      cbeReceiptToken: extra?.submittedCbeToken,
      qrData: extra?.qrData,
    });
    const validatedSourceUrl = validateOfficialReceiptUrl(provider, chekiData.sourceUrl);

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          paymentStatus: "ReviewRequired",
          provider,
          paymentMethod: provider,
          ...(reference ? { transactionReference: reference } : {}),
          senderName: chekiData.senderName ?? null,
          senderAccount: chekiData.senderAccount ?? null,
          receiverName: chekiData.receiverName ?? null,
          receiverAccount: chekiData.receiverAccount ?? null,
          transactionDate: validTxDate,
          sourceUrl: validatedSourceUrl ?? null,
          officialReceiptUrl: manualLink.officialReceiptUrl,
          cbeReceiptToken: manualLink.cbeReceiptToken,
          verificationResponse: sanitizedResponse,
          reviewReason: reason,
        },
      });

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "ReviewRequired",
          status: "PendingPayment",
        },
        select: { id: true, orderNumber: true, userId: true, customerName: true },
      });

      await tx.paymentVerificationLog.create({
        data: {
          paymentId,
          orderId,
          userId: resolvedActorId,
          provider,
          submittedReference: reference || null,
          verificationStatus: "ReviewRequired",
          errorMessage: reason,
          chekiHttpStatus: 200,
          responseData: sanitizedResponse,
          actorType: "system",
          actorId: resolvedActorId,
          reason,
        },
      });

      const customerId = order.userId ?? resolvedActorId;
      const refTag = reference || "none";
      const eventNonce = `${Date.now()}`;

      if (customerId) {
        await notificationService.createNotification(
          {
            userId: customerId,
            title: `Payment Requires Manual Verification — #${order.orderNumber}`,
            message: `Your payment for order #${order.orderNumber} was flagged for manual review. Reason: ${reason}`,
            type: "payment_manual_review",
            relatedEntityId: order.orderNumber,
            relatedEntityType: "payment",
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              paymentId,
              provider,
              reference: refTag,
              reason,
            },
            idempotencyKey: `payment-manual-review:${paymentId}:${refTag}:${eventNonce}`,
          },
          tx,
        );
      }

      await notificationService.notifyAdmins(
        {
          title: `Manual Payment Review Needed — #${order.orderNumber}`,
          message: `${order.customerName}'s ${provider.toUpperCase()} payment for order #${order.orderNumber} requires manual review: ${reason}`,
          type: "admin_payment_manual_review",
          relatedEntityId: order.orderNumber,
          relatedEntityType: "payment",
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            paymentId,
            customerName: order.customerName,
            provider,
            reference: refTag,
            reason,
          },
          idempotencyKey: `admin-payment-manual-review:${paymentId}:${refTag}:${eventNonce}`,
        },
        tx,
      );
    });

    void notificationService.flushOutbox();
  }

  async extractReceiptOcr(
    rawInput: unknown,
    file:
      | {
          buffer: Buffer;
          originalname: string;
          mimetype: string;
          size: number;
        }
      | undefined,
    actor: PaymentActor,
  ): Promise<ReceiptOcrExtractionDto> {
    const input = extractReceiptOcrSchema.parse(rawInput ?? {});

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new AppError({
        message: "Please select or capture a receipt image before running extraction.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "RECEIPT_IMAGE_REQUIRED",
      });
    }

    const validation = cloudinaryService.validateReceiptBuffer(file.buffer);
    if (!validation.valid || !validation.format) {
      throw new AppError({
        message:
          validation.error ||
          "Invalid file signature. Only real JPG, JPEG, PNG, WebP images and PDF documents are accepted.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_IMAGE_FILE",
      });
    }

    let hintProvider = input.provider?.trim().toLowerCase() || null;
    if (input.orderId) {
      const normalizedOrderKey = input.orderId.replace(/^#/, "").trim();
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: normalizedOrderKey },
            { orderNumber: normalizedOrderKey },
            { orderNumber: `AG-${normalizedOrderKey}` },
          ],
        },
        include: { payment: true },
      });

      if (!order) {
        throw new AppError({
          message: `Order "${input.orderId}" not found`,
          statusCode: HTTP_STATUS.NOT_FOUND,
          code: "ORDER_NOT_FOUND",
        });
      }

      if (!canActorAccessOrder(order, actor)) {
        throw new AppError({
          message: "You do not have permission to inspect receipts for this order.",
          statusCode: HTTP_STATUS.FORBIDDEN,
          code: "FORBIDDEN",
        });
      }

      if (!hintProvider) {
        hintProvider = order.payment?.provider || order.paymentMethod || null;
      }
    }

    return receiptOcrService.extractFromBuffer(file.buffer, hintProvider);
  }

  private async markReceiptVerificationOutcome(params: {
    receiptId: string;
    paymentId: string;
    orderId: string;
    actorUserId?: string | null;
    actorRole: "CUSTOMER" | "ADMIN";
    providerCode: string;
    reference: string;
    receiptStatus: "Rejected" | "Manual Review";
    paymentStatus: "Failed" | "ReviewRequired";
    orderPaymentStatus: "Failed" | "ReviewRequired";
    logStatus: string;
    reason: string;
    httpStatus?: number | null;
    providerResponse?: Prisma.InputJsonValue | null;
    verifiedAmount?: number | null;
    verifiedCurrency?: string | null;
    chekiData?: ChekiVerifySuccessPayload | null;
    resubmissionRequested?: boolean;
    officialReceiptUrl?: string | null;
    cbeReceiptToken?: string | null;
  }) {
    const parsedTxDate = params.chekiData?.date ? new Date(params.chekiData.date) : null;
    const validTxDate =
      parsedTxDate && !Number.isNaN(parsedTxDate.getTime()) ? parsedTxDate : null;

    const updatedReceipt = await prisma.$transaction(async (tx) => {
      const [existingReceipt, existingPayment] = await Promise.all([
        tx.paymentReceipt.findUnique({
          where: { id: params.receiptId },
          select: {
            provider: true,
            officialReceiptUrl: true,
            cbeReceiptToken: true,
            extractedReference: true,
            extractedQrData: true,
          },
        }),
        tx.payment.findUnique({
          where: { id: params.paymentId },
          select: {
            provider: true,
            officialReceiptUrl: true,
            sourceUrl: true,
            cbeReceiptToken: true,
          },
        }),
      ]);

      const receiptSameProvider =
        existingReceipt?.provider?.toLowerCase() === params.providerCode;
      const paymentSameProvider =
        existingPayment?.provider?.toLowerCase() === params.providerCode;
      const outcomeLink = resolveOfficialReceiptLink({
        provider: params.providerCode,
        transactionReference: params.reference || null,
        extractedReference: existingReceipt?.extractedReference,
        officialReceiptUrl:
          params.officialReceiptUrl ??
          (receiptSameProvider ? existingReceipt?.officialReceiptUrl : null) ??
          (paymentSameProvider ? existingPayment?.officialReceiptUrl : null),
        sourceUrl:
          params.chekiData?.sourceUrl ??
          (paymentSameProvider ? existingPayment?.sourceUrl : null),
        cbeReceiptToken:
          params.cbeReceiptToken ??
          (receiptSameProvider ? existingReceipt?.cbeReceiptToken : null) ??
          (paymentSameProvider ? existingPayment?.cbeReceiptToken : null),
        qrData: existingReceipt?.extractedQrData,
      });
      const validatedSourceUrl = validateOfficialReceiptUrl(
        params.providerCode,
        params.chekiData?.sourceUrl,
      );

      const receipt = await tx.paymentReceipt.update({
        where: { id: params.receiptId },
        data: {
          status: params.receiptStatus,
          provider: params.providerCode,
          ...(params.reference ? { transactionReference: params.reference } : {}),
          officialReceiptUrl: outcomeLink.officialReceiptUrl,
          cbeReceiptToken: outcomeLink.cbeReceiptToken,
          failureReason: params.reason,
          rejectionReason: params.receiptStatus === "Rejected" ? params.reason : null,
          resubmissionRequested: Boolean(params.resubmissionRequested),
          verificationSource: "pending",
          verifiedAmount:
            params.verifiedAmount != null && Number.isFinite(params.verifiedAmount)
              ? params.verifiedAmount
              : null,
          verifiedCurrency: params.verifiedCurrency ?? null,
          providerResponse: params.providerResponse ?? Prisma.JsonNull,
        },
      });

      await tx.payment.update({
        where: { id: params.paymentId },
        data: {
          paymentStatus: params.paymentStatus,
          provider: params.providerCode,
          paymentMethod: params.providerCode,
          ...(params.reference ? { transactionReference: params.reference } : {}),
          officialReceiptUrl: outcomeLink.officialReceiptUrl,
          cbeReceiptToken: outcomeLink.cbeReceiptToken,
          verificationSource: "pending",
          failureReason: params.reason,
          reviewReason: params.reason,
          ...(params.providerResponse ? { verificationResponse: params.providerResponse } : {}),
          ...(params.chekiData
            ? {
                senderName: params.chekiData.senderName ?? undefined,
                senderAccount: params.chekiData.senderAccount ?? undefined,
                receiverName: params.chekiData.receiverName ?? undefined,
                receiverAccount: params.chekiData.receiverAccount ?? undefined,
                transactionDate: validTxDate ?? undefined,
                ...(validatedSourceUrl ? { sourceUrl: validatedSourceUrl } : {}),
              }
            : {}),
        },
      });

      const order = await tx.order.update({
        where: { id: params.orderId },
        data: {
          paymentMethod: params.providerCode,
          paymentStatus: params.orderPaymentStatus,
          status: "PendingPayment",
          ...(params.reference ? { paymentReference: params.reference } : {}),
        },
        select: { id: true, orderNumber: true, userId: true, customerName: true },
      });

      await tx.paymentVerificationLog.create({
        data: {
          paymentId: params.paymentId,
          orderId: params.orderId,
          userId: params.actorUserId ?? null,
          provider: params.providerCode,
          submittedReference: params.reference || null,
          verificationStatus: params.logStatus,
          errorMessage: params.reason,
          chekiHttpStatus: params.httpStatus ?? null,
          responseData: params.providerResponse ?? Prisma.JsonNull,
          actorType: params.actorRole === "ADMIN" ? "admin" : "system",
          actorId: params.actorUserId ?? null,
          reason: params.reason,
        },
      });

      const customerId = order.userId ?? params.actorUserId ?? null;
      const isRejected = params.receiptStatus === "Rejected";

      if (customerId) {
        await notificationService.createNotification(
          {
            userId: customerId,
            title: isRejected
              ? `Payment Rejected — Order #${order.orderNumber}`
              : `Payment Requires Manual Verification — #${order.orderNumber}`,
            message: isRejected
              ? `Your payment receipt for order #${order.orderNumber} was rejected. Reason: ${params.reason}`
              : `Your payment receipt for order #${order.orderNumber} requires manual administrator review. ${params.reason}`,
            type: isRejected ? "payment_rejected" : "payment_manual_review",
            relatedEntityId: order.orderNumber,
            relatedEntityType: "payment",
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              paymentId: params.paymentId,
              receiptId: params.receiptId,
              provider: params.providerCode,
              reason: params.reason,
            },
            idempotencyKey: `${isRejected ? "payment-rejected" : "payment-manual-review"}:${params.receiptId}:${params.logStatus}`,
          },
          tx,
        );
      }

      await notificationService.notifyAdmins(
        {
          title: isRejected
            ? `Payment Rejected — Order #${order.orderNumber}`
            : `Manual Verification Required — #${order.orderNumber}`,
          message: isRejected
            ? `${order.customerName}'s ${params.providerCode.toUpperCase()} payment receipt for order #${order.orderNumber} was rejected: ${params.reason}`
            : `${order.customerName}'s ${params.providerCode.toUpperCase()} payment receipt for order #${order.orderNumber} requires manual verification: ${params.reason}`,
          type: isRejected ? "admin_payment_rejected" : "admin_payment_manual_review",
          relatedEntityId: order.orderNumber,
          relatedEntityType: "payment",
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            paymentId: params.paymentId,
            receiptId: params.receiptId,
            customerName: order.customerName,
            provider: params.providerCode,
            reason: params.reason,
          },
          idempotencyKey: `${isRejected ? "admin-payment-rejected" : "admin-payment-manual-review"}:${params.receiptId}:${params.logStatus}`,
        },
        tx,
      );

      return receipt;
    });

    void notificationService.flushOutbox();

    return updatedReceipt;
  }

  private async verifyReceiptAgainstProvider(params: {
    receiptId: string;
    paymentId: string;
    order: {
      id: string;
      orderNumber: string;
      customerName: string;
      totalETB: unknown;
      userId: string | null;
      status: string;
      trackingEvents: unknown;
      createdAt: Date;
    };
    providerCode: string;
    submittedReference: string;
    submittedQr: string;
    officialReceiptUrl?: string | null;
    cbeReceiptToken?: string | null;
    accountNumber?: string;
    phoneNumber?: string;
    actor: PaymentActor;
  }): Promise<SubmitPaymentReceiptResponse> {
    const {
      receiptId,
      paymentId,
      order,
      providerCode,
      submittedReference,
      submittedQr,
      officialReceiptUrl,
      cbeReceiptToken,
      accountNumber,
      phoneNumber,
      actor,
    } = params;

    await ensurePaymentProviderConfigsSeeded();
    const providers = await this.getSupportedProviders();
    const matchedProvider = providers.find((p) => p.id === providerCode);
    const providerConfig = await prisma.paymentProviderConfig.findUnique({
      where: { providerCode },
    });
    const providerLabel = providerConfig?.displayName || matchedProvider?.name || providerCode.toUpperCase();

    const lockResult = await prisma.payment.updateMany({
      where: {
        id: paymentId,
        paymentStatus: { notIn: ["VerificationPending", "Paid", "verified"] },
      },
      data: {
        paymentStatus: "VerificationPending",
        provider: providerCode,
        paymentMethod: providerCode,
      },
    });

    if (lockResult.count === 0) {
      await prisma.paymentReceipt.update({
        where: { id: receiptId },
        data: { status: "Manual Review", failureReason: "Concurrent verification lock active." },
      });
      throw new AppError({
        message: "Payment verification is already in progress for this order. Please wait a moment.",
        statusCode: HTTP_STATUS.CONFLICT,
        code: "VERIFICATION_IN_PROGRESS",
      });
    }

    try {
      const effectiveRef = submittedReference.trim();
      const effectiveQr = submittedQr.trim();

      if (!effectiveRef && !effectiveQr) {
        const reason =
          "OCR could not identify a transaction reference or QR code from the receipt image. You can enter the reference manually or wait for administrator review.";
        const updatedReceipt = await this.markReceiptVerificationOutcome({
          receiptId,
          paymentId,
          orderId: order.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          providerCode,
          reference: "",
          receiptStatus: "Manual Review",
          paymentStatus: "ReviewRequired",
          orderPaymentStatus: "ReviewRequired",
          logStatus: "ManualReviewRequired",
          reason,
        });
        return {
          receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
          verified: false,
          verificationStatus: "Manual Review",
          verificationSource: "pending",
          paymentStatus: "ReviewRequired",
          orderStatus: order.status,
          orderNumber: order.orderNumber,
          message: reason,
          failureReason: reason,
        };
      }

      if (effectiveRef) {
        const candidateKey = normalizePaymentReference(providerCode, effectiveRef);
        const [dupPayment, dupReceipt] = await Promise.all([
          prisma.payment.findFirst({
            where: {
              orderId: { not: order.id },
              OR: [
                { verifiedReference: candidateKey },
                {
                  transactionReference: { equals: effectiveRef, mode: "insensitive" },
                  paymentStatus: { in: ["Paid", "VerificationPending", "ReviewRequired"] },
                },
              ],
            },
            select: { id: true },
          }),
          prisma.paymentReceipt.findFirst({
            where: {
              orderId: { not: order.id },
              normalizedVerifiedReference: candidateKey,
            },
            select: { id: true },
          }),
        ]);

        if (dupPayment || dupReceipt) {
          const dupMsg =
            "This transaction reference has already been used for another order. Duplicate references are not permitted.";
          await this.markReceiptVerificationOutcome({
            receiptId,
            paymentId,
            orderId: order.id,
            actorUserId: actor.userId,
            actorRole: actor.role,
            providerCode,
            reference: effectiveRef,
            receiptStatus: "Rejected",
            paymentStatus: "Failed",
            orderPaymentStatus: "Failed",
            logStatus: "DuplicateReference",
            reason: dupMsg,
            httpStatus: HTTP_STATUS.CONFLICT,
            resubmissionRequested: true,
          });
          throw new AppError({
            message: dupMsg,
            statusCode: HTTP_STATUS.CONFLICT,
            code: "DUPLICATE_TRANSACTION_REFERENCE",
          });
        }
      }

      if (!matchedProvider || !providerConfig || !providerConfig.isEnabled) {
        const reason = `Payment provider "${providerCode}" is not configured for automated API verification and requires administrator review.`;
        const updatedReceipt = await this.markReceiptVerificationOutcome({
          receiptId,
          paymentId,
          orderId: order.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          providerCode,
          reference: effectiveRef,
          receiptStatus: "Manual Review",
          paymentStatus: "ReviewRequired",
          orderPaymentStatus: "ReviewRequired",
          logStatus: "ManualReviewRequired",
          reason,
        });
        return {
          receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
          verified: false,
          verificationStatus: "Manual Review",
          verificationSource: "pending",
          paymentStatus: "ReviewRequired",
          orderStatus: order.status,
          orderNumber: order.orderNumber,
          message: reason,
          failureReason: reason,
        };
      }

      if (matchedProvider.requiresPhone && !phoneNumber?.trim() && !effectiveQr) {
        const reason = `${matchedProvider.name} automatic API verification requires your payer phone number (or a readable QR code). Sent for manual review or add phone number to retry.`;
        const updatedReceipt = await this.markReceiptVerificationOutcome({
          receiptId,
          paymentId,
          orderId: order.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          providerCode,
          reference: effectiveRef,
          receiptStatus: "Manual Review",
          paymentStatus: "ReviewRequired",
          orderPaymentStatus: "ReviewRequired",
          logStatus: "ManualReviewRequired",
          reason,
        });
        return {
          receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
          verified: false,
          verificationStatus: "Manual Review",
          verificationSource: "pending",
          paymentStatus: "ReviewRequired",
          orderStatus: order.status,
          orderNumber: order.orderNumber,
          message: reason,
          failureReason: reason,
        };
      }

      const isLinkInput = /^https?:\/\//i.test(effectiveRef);
      const isLegacyCbeFt = providerCode === "cbe" && /^ft/i.test(effectiveRef);

      const chekiRequest: ChekiVerifyRequest = {
        bank: providerCode,
        ...(effectiveQr ? { qrData: effectiveQr } : {}),
        ...(effectiveRef ? { reference: effectiveRef } : {}),
        ...(phoneNumber?.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
      };

      if ((providerCode === "boa" || isLegacyCbeFt) && !effectiveQr && !isLinkInput) {
        const suppliedAcc = accountNumber?.replace(/[\s-]+/g, "").trim();
        if (suppliedAcc) {
          const digits = providerConfig.accountSuffixDigits ?? (providerCode === "boa" ? 5 : 8);
          const expectedSuffix = providerConfig.receivingAccountNumber.slice(-digits);
          if (suppliedAcc.slice(-digits) !== expectedSuffix) {
            const reason =
              "Provided receiving account digits do not match AddisGebeya's configured receiving account.";
            const updatedReceipt = await this.markReceiptVerificationOutcome({
              receiptId,
              paymentId,
              orderId: order.id,
              actorUserId: actor.userId,
              actorRole: actor.role,
              providerCode,
              reference: effectiveRef,
              receiptStatus: "Rejected",
              paymentStatus: "Failed",
              orderPaymentStatus: "Failed",
              logStatus: "Rejected",
              reason,
              httpStatus: HTTP_STATUS.UNPROCESSABLE_ENTITY,
              resubmissionRequested: true,
            });
            return {
              receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
              verified: false,
              verificationStatus: "Rejected",
              verificationSource: "pending",
              paymentStatus: "Failed",
              orderStatus: "PendingPayment",
              orderNumber: order.orderNumber,
              message: reason,
              failureReason: reason,
            };
          }
        }
        chekiRequest.accountNumber = providerConfig.receivingAccountNumber;
      } else if (accountNumber?.trim()) {
        chekiRequest.accountNumber = accountNumber.trim();
      }

      const chekiOutcome = await this.client.verifyReceipt(chekiRequest);

      if (chekiOutcome.outcome === "rate_limited" || chekiOutcome.outcome === "unavailable") {
        const reason =
          chekiOutcome.outcome === "rate_limited"
            ? `Provider verification service is temporarily rate-limited (${chekiOutcome.retryAfterSeconds}s). Saved for manual review.`
            : `${chekiOutcome.error || "Payment provider verification API is temporarily unavailable."} Saved for manual review.`;
        const updatedReceipt = await this.markReceiptVerificationOutcome({
          receiptId,
          paymentId,
          orderId: order.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          providerCode,
          reference: effectiveRef || effectiveQr,
          receiptStatus: "Manual Review",
          paymentStatus: "ReviewRequired",
          orderPaymentStatus: "ReviewRequired",
          logStatus:
            chekiOutcome.outcome === "rate_limited" ? "RateLimited" : "ProviderUnavailable",
          reason,
          httpStatus: chekiOutcome.outcome === "rate_limited" ? 429 : chekiOutcome.httpStatus,
        });
        return {
          receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
          verified: false,
          verificationStatus: "Manual Review",
          verificationSource: "pending",
          paymentStatus: "ReviewRequired",
          orderStatus: order.status,
          orderNumber: order.orderNumber,
          message: reason,
          failureReason: reason,
        };
      }

      if (chekiOutcome.outcome === "rejected") {
        const reason =
          chekiOutcome.error ||
          "Transaction reference was not found or could not be confirmed by the payment provider.";
        const updatedReceipt = await this.markReceiptVerificationOutcome({
          receiptId,
          paymentId,
          orderId: order.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          providerCode,
          reference: effectiveRef || effectiveQr,
          receiptStatus: "Rejected",
          paymentStatus: "Failed",
          orderPaymentStatus: "Failed",
          logStatus: "Rejected",
          reason,
          httpStatus: chekiOutcome.httpStatus,
          resubmissionRequested: true,
        });
        return {
          receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
          verified: false,
          verificationStatus: "Rejected",
          verificationSource: "pending",
          paymentStatus: "Failed",
          orderStatus: "PendingPayment",
          orderNumber: order.orderNumber,
          message: reason,
          failureReason: reason,
        };
      }

      const chekiData = chekiOutcome.data;
      const sanitizedResponse = sanitizeChekiPayload(chekiData);
      const parsedVerifiedAmount =
        chekiData.amount != null && Number.isFinite(Number(chekiData.amount))
          ? Number(chekiData.amount)
          : null;

      if (
        chekiData.success !== true ||
        chekiData.verified !== true ||
        chekiData.decodedOnly === true ||
        chekiData.parsed === true
      ) {
        const reason = chekiData.decodedOnly
          ? "Decoded-only QR result cannot verify payment."
          : chekiData.parsed
            ? "Parsed-only receipt cannot verify payment."
            : chekiData.error || "Transaction not confirmed by financial institution.";
        const updatedReceipt = await this.markReceiptVerificationOutcome({
          receiptId,
          paymentId,
          orderId: order.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          providerCode,
          reference: effectiveRef || effectiveQr,
          receiptStatus: "Rejected",
          paymentStatus: "Failed",
          orderPaymentStatus: "Failed",
          logStatus: "Rejected",
          reason,
          httpStatus: 200,
          providerResponse: sanitizedResponse,
          verifiedAmount: parsedVerifiedAmount,
          verifiedCurrency: chekiData.currency ?? null,
          chekiData,
          resubmissionRequested: true,
        });
        return {
          receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
          verified: false,
          verificationStatus: "Rejected",
          verificationSource: "pending",
          paymentStatus: "Failed",
          orderStatus: "PendingPayment",
          orderNumber: order.orderNumber,
          message: reason,
          failureReason: reason,
        };
      }

      if (
        !doesBankMatchProvider(
          providerCode,
          chekiData.bankCode,
          chekiData.bank,
          matchedProvider.name,
        )
      ) {
        const reason = `Provider mismatch: receipt belongs to ${chekiData.bank || chekiData.bankCode}, expected ${providerLabel}.`;
        const updatedReceipt = await this.markReceiptVerificationOutcome({
          receiptId,
          paymentId,
          orderId: order.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          providerCode,
          reference: chekiData.reference || effectiveRef,
          receiptStatus: "Rejected",
          paymentStatus: "Failed",
          orderPaymentStatus: "Failed",
          logStatus: "ProviderMismatch",
          reason,
          httpStatus: 200,
          providerResponse: sanitizedResponse,
          verifiedAmount: parsedVerifiedAmount,
          verifiedCurrency: chekiData.currency ?? null,
          chekiData,
          resubmissionRequested: true,
        });
        return {
          receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
          verified: false,
          verificationStatus: "Rejected",
          verificationSource: "pending",
          paymentStatus: "Failed",
          orderStatus: "PendingPayment",
          orderNumber: order.orderNumber,
          message: reason,
          failureReason: reason,
        };
      }

      if (!chekiData.currency || chekiData.currency.trim().toUpperCase() !== "ETB") {
        const reason = `Currency mismatch: expected ETB, provider returned "${chekiData.currency ?? "unknown"}".`;
        const updatedReceipt = await this.markReceiptVerificationOutcome({
          receiptId,
          paymentId,
          orderId: order.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          providerCode,
          reference: chekiData.reference || effectiveRef,
          receiptStatus: "Rejected",
          paymentStatus: "Failed",
          orderPaymentStatus: "Failed",
          logStatus: "CurrencyMismatch",
          reason,
          httpStatus: 200,
          providerResponse: sanitizedResponse,
          verifiedAmount: parsedVerifiedAmount,
          verifiedCurrency: chekiData.currency ?? null,
          chekiData,
          resubmissionRequested: true,
        });
        return {
          receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
          verified: false,
          verificationStatus: "Rejected",
          verificationSource: "pending",
          paymentStatus: "Failed",
          orderStatus: "PendingPayment",
          orderNumber: order.orderNumber,
          message: reason,
          failureReason: reason,
        };
      }

      const expectedTotalETB = Number(order.totalETB);
      if (!amountsMatchInSantim(expectedTotalETB, chekiData.amount)) {
        const reason = `Amount mismatch: expected ${expectedTotalETB.toFixed(2)} ETB, bank verified ${chekiData.amount ?? "unknown"} ETB.`;
        const updatedReceipt = await this.markReceiptVerificationOutcome({
          receiptId,
          paymentId,
          orderId: order.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          providerCode,
          reference: chekiData.reference || effectiveRef,
          receiptStatus: "Rejected",
          paymentStatus: "Failed",
          orderPaymentStatus: "Failed",
          logStatus: "AmountMismatch",
          reason,
          httpStatus: 200,
          providerResponse: sanitizedResponse,
          verifiedAmount: parsedVerifiedAmount,
          verifiedCurrency: "ETB",
          chekiData,
          resubmissionRequested: true,
        });
        return {
          receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
          verified: false,
          verificationStatus: "Rejected",
          verificationSource: "pending",
          paymentStatus: "Failed",
          orderStatus: "PendingPayment",
          orderNumber: order.orderNumber,
          message: reason,
          failureReason: reason,
        };
      }

      const accountVerified = chekiData.receiverAccount
        ? doesMaskedAccountMatch(chekiData.receiverAccount, providerConfig.receivingAccountNumber)
        : chekiData.receiverName
          ? doesReceiverNameMatch(chekiData.receiverName, providerConfig.receivingAccountName)
          : false;

      if (!accountVerified) {
        const reason = `Receiving account mismatch: expected ${providerConfig.receivingAccountName} (${providerConfig.receivingAccountNumber}), bank shows ${chekiData.receiverName ?? ""} ${chekiData.receiverAccount ?? "unknown"}.`;
        const updatedReceipt = await this.markReceiptVerificationOutcome({
          receiptId,
          paymentId,
          orderId: order.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          providerCode,
          reference: chekiData.reference || effectiveRef,
          receiptStatus: "Rejected",
          paymentStatus: "Failed",
          orderPaymentStatus: "Failed",
          logStatus: "ReceivingAccountMismatch",
          reason,
          httpStatus: 200,
          providerResponse: sanitizedResponse,
          verifiedAmount: parsedVerifiedAmount,
          verifiedCurrency: "ETB",
          chekiData,
          resubmissionRequested: true,
        });
        return {
          receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
          verified: false,
          verificationStatus: "Rejected",
          verificationSource: "pending",
          paymentStatus: "Failed",
          orderStatus: "PendingPayment",
          orderNumber: order.orderNumber,
          message: reason,
          failureReason: reason,
        };
      }

      if (
        !isTransactionWithinAcceptablePeriod(
          chekiData.date,
          order.createdAt,
          providerConfig.maxPaymentAgeDays,
        )
      ) {
        const reason = `Transaction date (${chekiData.date ?? "missing"}) is outside the accepted ${providerConfig.maxPaymentAgeDays}-day window and requires administrator review.`;
        const updatedReceipt = await this.markReceiptVerificationOutcome({
          receiptId,
          paymentId,
          orderId: order.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          providerCode,
          reference: chekiData.reference || effectiveRef,
          receiptStatus: "Manual Review",
          paymentStatus: "ReviewRequired",
          orderPaymentStatus: "ReviewRequired",
          logStatus: "ManualReviewRequired",
          reason,
          httpStatus: 200,
          providerResponse: sanitizedResponse,
          verifiedAmount: parsedVerifiedAmount,
          verifiedCurrency: "ETB",
          chekiData,
        });
        return {
          receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
          verified: false,
          verificationStatus: "Manual Review",
          verificationSource: "pending",
          paymentStatus: "ReviewRequired",
          orderStatus: order.status,
          orderNumber: order.orderNumber,
          message: reason,
          failureReason: reason,
        };
      }

      const canonicalBankRef = (chekiData.reference || effectiveRef || effectiveQr).trim();
      const canonicalVerifiedKey = normalizePaymentReference(providerCode, canonicalBankRef);
      const parsedTxDate = chekiData.date ? new Date(chekiData.date) : null;
      const validTxDate =
        parsedTxDate && !Number.isNaN(parsedTxDate.getTime()) ? parsedTxDate : null;
      const now = new Date();
      const validatedSourceUrl = validateOfficialReceiptUrl(
        providerCode,
        chekiData.sourceUrl,
      );

      try {
        const verifiedReceipt = await prisma.$transaction(async (tx) => {
          const [existingUsed, existingReceiptUsed, existingReceipt, existingPayment] =
            await Promise.all([
              tx.payment.findFirst({
                where: {
                  id: { not: paymentId },
                  OR: [
                    { verifiedReference: canonicalVerifiedKey },
                    {
                      transactionReference: { equals: canonicalBankRef, mode: "insensitive" },
                      paymentStatus: { in: ["Paid", "ReviewRequired"] },
                    },
                  ],
                },
                select: { id: true },
              }),
              tx.paymentReceipt.findFirst({
                where: {
                  id: { not: receiptId },
                  orderId: { not: order.id },
                  normalizedVerifiedReference: canonicalVerifiedKey,
                },
                select: { id: true },
              }),
              tx.paymentReceipt.findUnique({
                where: { id: receiptId },
                select: {
                  provider: true,
                  officialReceiptUrl: true,
                  cbeReceiptToken: true,
                  extractedReference: true,
                  extractedQrData: true,
                },
              }),
              tx.payment.findUnique({
                where: { id: paymentId },
                select: {
                  provider: true,
                  officialReceiptUrl: true,
                  sourceUrl: true,
                  cbeReceiptToken: true,
                },
              }),
            ]);

          if (existingUsed || existingReceiptUsed) {
            throw new AppError({
              message: "This transaction reference has already been used for another order.",
              statusCode: HTTP_STATUS.CONFLICT,
              code: "DUPLICATE_TRANSACTION_REFERENCE",
            });
          }

          const receiptSameProvider =
            existingReceipt?.provider?.toLowerCase() === providerCode;
          const paymentSameProvider =
            existingPayment?.provider?.toLowerCase() === providerCode;
          const verifiedLink = resolveOfficialReceiptLink({
            provider: providerCode,
            transactionReference: canonicalBankRef,
            verifiedReference: canonicalVerifiedKey,
            extractedReference: existingReceipt?.extractedReference,
            officialReceiptUrl:
              officialReceiptUrl ??
              (receiptSameProvider ? existingReceipt?.officialReceiptUrl : null) ??
              (paymentSameProvider ? existingPayment?.officialReceiptUrl : null),
            sourceUrl:
              validatedSourceUrl ??
              (paymentSameProvider ? existingPayment?.sourceUrl : null),
            cbeReceiptToken:
              cbeReceiptToken ??
              (receiptSameProvider ? existingReceipt?.cbeReceiptToken : null) ??
              (paymentSameProvider ? existingPayment?.cbeReceiptToken : null),
            qrData: effectiveQr || existingReceipt?.extractedQrData,
          });

          const receipt = await tx.paymentReceipt.update({
            where: { id: receiptId },
            data: {
              status: "Verified",
              provider: providerCode,
              transactionReference: canonicalBankRef,
              normalizedVerifiedReference: canonicalVerifiedKey,
              officialReceiptUrl: verifiedLink.officialReceiptUrl,
              cbeReceiptToken: verifiedLink.cbeReceiptToken,
              verifiedAmount: expectedTotalETB,
              verifiedCurrency: "ETB",
              verificationSource: "provider_api",
              failureReason: null,
              rejectionReason: null,
              resubmissionRequested: false,
              providerResponse: sanitizedResponse,
              verifiedAt: now,
              reviewedAt: now,
            },
          });

          await tx.payment.update({
            where: { id: paymentId },
            data: {
              userId: order.userId,
              provider: providerCode,
              paymentMethod: providerCode,
              transactionReference: canonicalBankRef,
              verifiedReference: canonicalVerifiedKey,
              amount: expectedTotalETB,
              currency: "ETB",
              paymentStatus: "Paid",
              verificationSource: "provider_api",
              failureReason: null,
              reviewReason: null,
              senderName: chekiData.senderName ?? null,
              senderAccount: chekiData.senderAccount ?? null,
              receiverName: chekiData.receiverName ?? null,
              receiverAccount: chekiData.receiverAccount ?? null,
              transactionDate: validTxDate,
              sourceUrl:
                validatedSourceUrl ??
                (paymentSameProvider ? existingPayment?.sourceUrl : null) ??
                null,
              officialReceiptUrl: verifiedLink.officialReceiptUrl,
              cbeReceiptToken: verifiedLink.cbeReceiptToken,
              verificationResponse: sanitizedResponse,
              verifiedAt: now,
              paidAt: now,
            },
          });

          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentMethod: providerCode,
              paymentStatus: "Paid",
              paymentReference: canonicalBankRef,
              status: "Confirmed",
              trackingEvents: buildVerifiedTrackingTimeline(
                order.trackingEvents,
                matchedProvider.name,
                canonicalBankRef,
              ),
            },
          });

          await tx.paymentVerificationLog.create({
            data: {
              paymentId,
              orderId: order.id,
              userId: actor.userId ?? null,
              provider: providerCode,
              submittedReference: canonicalBankRef,
              verificationStatus: "Verified",
              chekiHttpStatus: 200,
              responseData: sanitizedResponse,
              actorType: actor.role === "ADMIN" ? "admin" : "customer",
              actorId: actor.userId ?? null,
              reason: "Receipt automatically verified via Cheki provider API.",
            },
          });

          const customerId = order.userId;
          if (customerId) {
            await notificationService.createNotification(
              {
                userId: customerId,
                title: `Payment Verified — Order #${order.orderNumber}`,
                message: `Your payment of ${expectedTotalETB.toLocaleString()} ETB via ${providerLabel} (Ref: ${canonicalBankRef}) has been verified and your order is confirmed.`,
                type: "payment_verified",
                relatedEntityId: order.orderNumber,
                relatedEntityType: "payment",
                metadata: {
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  paymentId,
                  receiptId: receipt.id,
                  provider: providerCode,
                  reference: canonicalBankRef,
                  amountETB: expectedTotalETB,
                },
                idempotencyKey: `payment-verified:${paymentId}:${canonicalBankRef}`,
              },
              tx,
            );

            if (order.status !== "Confirmed") {
              await notificationService.createNotification(
                {
                  userId: customerId,
                  title: `Order Confirmed — #${order.orderNumber}`,
                  message: `Your order #${order.orderNumber} is confirmed and queued for dispatch.`,
                  type: "order_confirmed",
                  relatedEntityId: order.orderNumber,
                  relatedEntityType: "order",
                  metadata: {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                  },
                  idempotencyKey: `order-confirmed:${order.id}`,
                },
                tx,
              );
            }
          }

          await notificationService.notifyAdmins(
            {
              title: `Payment Verified — Order #${order.orderNumber}`,
              message: `${order.customerName}'s ${providerLabel} receipt (${expectedTotalETB.toLocaleString()} ETB, Ref: ${canonicalBankRef}) for order #${order.orderNumber} was automatically verified.`,
              type: "admin_payment_verified",
              relatedEntityId: order.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                paymentId,
                receiptId: receipt.id,
                customerName: order.customerName,
                provider: providerCode,
                reference: canonicalBankRef,
                amountETB: expectedTotalETB,
              },
              idempotencyKey: `admin-payment-verified:${paymentId}:${canonicalBankRef}`,
            },
            tx,
          );

          return receipt;
        });

        void notificationService.flushOutbox();

        const verifiedReceiptDto = mapReceiptRecordToDto(
          verifiedReceipt,
          order.orderNumber,
          order.customerName,
        );

        return {
          receipt: verifiedReceiptDto,
          verified: true,
          verificationStatus: "Verified",
          verificationSource: "provider_api",
          paymentStatus: "Paid",
          orderStatus: "Confirmed",
          orderNumber: order.orderNumber,
          officialReceiptUrl: verifiedReceiptDto.officialReceiptUrl ?? null,
          cbeReceiptToken: verifiedReceiptDto.cbeReceiptToken ?? null,
          message: "Payment receipt automatically verified with the provider! Your order is confirmed.",
          failureReason: null,
        };
      } catch (txErr: unknown) {
        if (
          txErr instanceof AppError &&
          txErr.code === "DUPLICATE_TRANSACTION_REFERENCE"
        ) {
          await this.markReceiptVerificationOutcome({
            receiptId,
            paymentId,
            orderId: order.id,
            actorUserId: actor.userId,
            actorRole: actor.role,
            providerCode,
            reference: canonicalBankRef,
            receiptStatus: "Rejected",
            paymentStatus: "Failed",
            orderPaymentStatus: "Failed",
            logStatus: "DuplicateReference",
            reason: txErr.message,
            httpStatus: HTTP_STATUS.CONFLICT,
            providerResponse: sanitizedResponse,
            resubmissionRequested: true,
          });
          throw txErr;
        }
        if (
          txErr instanceof Prisma.PrismaClientKnownRequestError &&
          txErr.code === "P2002"
        ) {
          const dupMsg = "This transaction reference has already been used for another order.";
          await this.markReceiptVerificationOutcome({
            receiptId,
            paymentId,
            orderId: order.id,
            actorUserId: actor.userId,
            actorRole: actor.role,
            providerCode,
            reference: canonicalBankRef,
            receiptStatus: "Rejected",
            paymentStatus: "Failed",
            orderPaymentStatus: "Failed",
            logStatus: "DuplicateReference",
            reason: dupMsg,
            httpStatus: HTTP_STATUS.CONFLICT,
            providerResponse: sanitizedResponse,
            resubmissionRequested: true,
          });
          throw new AppError({
            message: dupMsg,
            statusCode: HTTP_STATUS.CONFLICT,
            code: "DUPLICATE_TRANSACTION_REFERENCE",
          });
        }
        throw txErr;
      }
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      const fallbackReason =
        err instanceof Error
          ? `Unexpected error during automated verification: ${err.message}`
          : "Unexpected error during automated verification. Saved for administrator review.";
      const updatedReceipt = await this.markReceiptVerificationOutcome({
        receiptId,
        paymentId,
        orderId: order.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        providerCode,
        reference: submittedReference || submittedQr,
        receiptStatus: "Manual Review",
        paymentStatus: "ReviewRequired",
        orderPaymentStatus: "ReviewRequired",
        logStatus: "ProviderUnavailable",
        reason: fallbackReason,
        httpStatus: 500,
      });
      return {
        receipt: mapReceiptRecordToDto(updatedReceipt, order.orderNumber, order.customerName),
        verified: false,
        verificationStatus: "Manual Review",
        verificationSource: "pending",
        paymentStatus: "ReviewRequired",
        orderStatus: order.status,
        orderNumber: order.orderNumber,
        message: fallbackReason,
        failureReason: fallbackReason,
      };
    }
  }

  async submitReceipt(
    rawInput: unknown,
    file:
      | {
          buffer: Buffer;
          originalname: string;
          mimetype: string;
          size: number;
        }
      | undefined,
    actor: PaymentActor,
  ): Promise<SubmitPaymentReceiptResponse> {
    const input = submitPaymentReceiptSchema.parse(rawInput);

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new AppError({
        message: "Please select or capture a valid payment receipt image before submitting.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "RECEIPT_IMAGE_REQUIRED",
      });
    }

    const validation = cloudinaryService.validateReceiptBuffer(file.buffer);
    if (!validation.valid || !validation.format) {
      throw new AppError({
        message:
          validation.error ||
          "Invalid file signature. Only real JPG, JPEG, PNG, WebP images and PDF documents are accepted.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_IMAGE_FILE",
      });
    }

    const normalizedMimeType =
      validation.format === "jpeg"
        ? "image/jpeg"
        : validation.format === "png"
          ? "image/png"
          : validation.format === "webp"
            ? "image/webp"
            : "application/pdf";

    const normalizedOrderKey = input.orderId.replace(/^#/, "").trim();
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: normalizedOrderKey },
          { orderNumber: normalizedOrderKey },
          { orderNumber: `AG-${normalizedOrderKey}` },
        ],
      },
      include: {
        payment: true,
        receipts: {
          orderBy: { submittedAt: "desc" },
        },
      },
    });

    if (!order) {
      throw new AppError({
        message: `Order "${input.orderId}" not found`,
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ORDER_NOT_FOUND",
      });
    }

    if (!canActorAccessOrder(order, actor)) {
      throw new AppError({
        message: "You do not have permission to submit a receipt for this order.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "FORBIDDEN",
      });
    }

    if (order.status.toLowerCase() === "cancelled") {
      throw new AppError({
        message: "Cannot submit a payment receipt for a cancelled order.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "ORDER_CANCELLED",
      });
    }

    if (order.paymentMethod === "cod" || order.paymentStatus === "cod_due") {
      throw new AppError({
        message: "Cash on Delivery orders do not require a transfer receipt upload.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "COD_RECEIPT_NOT_APPLICABLE",
      });
    }

    if (
      order.paymentStatus === "Paid" ||
      order.paymentStatus === "verified" ||
      order.payment?.paymentStatus === "Paid" ||
      order.payment?.paymentStatus === "verified"
    ) {
      throw new AppError({
        message: "Payment for this order has already been verified and approved.",
        statusCode: HTTP_STATUS.CONFLICT,
        code: "PAYMENT_ALREADY_PAID",
      });
    }

    const existingApproved = order.receipts.find(
      (r) => r.status === "Verified" || r.status === "Approved",
    );
    if (existingApproved) {
      throw new AppError({
        message: "A payment receipt for this order has already been verified.",
        statusCode: HTTP_STATUS.CONFLICT,
        code: "PAYMENT_ALREADY_PAID",
      });
    }

    const existingPending = order.receipts.find(
      (r) => r.status === "Pending" || r.status === "Processing",
    );
    if (existingPending) {
      throw new AppError({
        message:
          "A payment receipt is already pending verification for this order. You can upload a replacement only if it is rejected or flagged for manual review.",
        statusCode: HTTP_STATUS.CONFLICT,
        code: "RECEIPT_ALREADY_PENDING",
      });
    }

    await ensurePaymentProviderConfigsSeeded();

    const hintProvider = (
      input.provider ||
      order.payment?.provider ||
      order.paymentMethod ||
      ""
    )
      .trim()
      .toLowerCase();

    const ocrResult = await receiptOcrService.extractFromBuffer(
      file.buffer,
      hintProvider || null,
    );

    const providerCode = (
      input.provider ||
      hintProvider ||
      ocrResult.detectedProvider ||
      "cbe"
    )
      .trim()
      .toLowerCase();

    const providerCfg = await prisma.paymentProviderConfig.findUnique({
      where: { providerCode },
    });
    if (providerCfg && !providerCfg.isEnabled) {
      throw new AppError({
        message: `Payment provider "${providerCode}" is currently disabled.`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "UNSUPPORTED_PAYMENT_PROVIDER",
      });
    }

    const validatedSubmittedOfficialUrl = assertValidSubmittedOfficialUrl(
      providerCode,
      input.officialReceiptUrl,
    );
    const suppliedRef =
      input.transactionReference?.trim() || ocrResult.extractedReference?.trim() || "";
    const suppliedQr = input.qrData?.trim() || ocrResult.extractedQrData?.trim() || "";
    const initialOfficialLink = resolveOfficialReceiptLink({
      provider: providerCode,
      transactionReference: suppliedRef || null,
      extractedReference: ocrResult.extractedReference,
      officialReceiptUrl:
        validatedSubmittedOfficialUrl ?? ocrResult.extractedOfficialReceiptUrl ?? null,
      cbeReceiptToken:
        input.cbeReceiptToken?.trim() || ocrResult.extractedCbeToken || null,
      qrData: suppliedQr || null,
    });

    let payment = order.payment;
    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          userId: order.userId ?? actor.userId ?? null,
          provider: providerCode,
          paymentMethod: providerCode,
          transactionReference: suppliedRef || order.paymentReference || `REF-${order.orderNumber}`,
          officialReceiptUrl: initialOfficialLink.officialReceiptUrl,
          cbeReceiptToken: initialOfficialLink.cbeReceiptToken,
          amount: order.totalETB,
          currency: "ETB",
          paymentStatus: "Pending",
        },
      });
    }

    const actorTag = (actor.userId ?? actor.guestSessionId ?? "guest").slice(0, 6);
    const uploaded = await cloudinaryService.uploadSingle(file.buffer, {
      folder: "addisgebeya/receipts",
      filenamePrefix: `receipt_${order.orderNumber}_${actorTag}`,
      tags: ["addisgebeya", "payment-receipt", order.orderNumber],
      deliveryType: "authenticated",
      allowPdf: true,
    });

    const now = new Date();
    const providerLabel = providerCfg?.displayName || providerCode.toUpperCase();
    const initialReceiptStatus = input.autoVerify ? "Processing" : "Pending";

    const isSameProvider = payment.provider?.toLowerCase() === providerCode;
    const nextPaymentOfficialUrl =
      initialOfficialLink.officialReceiptUrl ??
      (isSameProvider
        ? validateOfficialReceiptUrl(providerCode, payment.officialReceiptUrl)
        : null);
    const nextPaymentCbeToken =
      initialOfficialLink.cbeReceiptToken ??
      (isSameProvider ? payment.cbeReceiptToken : null);

    let createdReceipt;
    try {
      createdReceipt = await prisma.$transaction(async (tx) => {
        const activeOrApproved = await tx.paymentReceipt.findFirst({
          where: {
            paymentId: payment.id,
            status: { in: ["Pending", "Processing", "Verified", "Approved"] },
          },
          select: { id: true, status: true },
        });

        if (activeOrApproved) {
          const isPaidStatus =
            activeOrApproved.status === "Verified" || activeOrApproved.status === "Approved";
          throw new AppError({
            message: isPaidStatus
              ? "A payment receipt for this order has already been verified."
              : "A payment receipt is already pending verification for this order.",
            statusCode: HTTP_STATUS.CONFLICT,
            code: isPaidStatus ? "PAYMENT_ALREADY_PAID" : "RECEIPT_ALREADY_PENDING",
          });
        }

        const receipt = await tx.paymentReceipt.create({
          data: {
            paymentId: payment.id,
            orderId: order.id,
            userId: order.userId ?? actor.userId ?? null,
            provider: providerCode,
            transactionReference: suppliedRef || null,
            extractedReference: ocrResult.extractedReference,
            extractedQrData: ocrResult.extractedQrData,
            officialReceiptUrl: initialOfficialLink.officialReceiptUrl,
            cbeReceiptToken: initialOfficialLink.cbeReceiptToken,
            extractedAmount:
              ocrResult.extractedAmountETB != null ? ocrResult.extractedAmountETB : null,
            extractedDate: ocrResult.extractedDate,
            extractedSenderName: ocrResult.extractedSenderName,
            extractedSenderAccount: ocrResult.extractedSenderAccount,
            extractedReceiverName: ocrResult.extractedReceiverName,
            extractedReceiverAccount: ocrResult.extractedReceiverAccount,
            extractedStatus: ocrResult.extractedStatus,
            detectedProvider: ocrResult.detectedProvider,
            ocrConfidence: ocrResult.confidence,
            ocrRawText: ocrResult.rawTextPreview ?? null,
            ocrCompletedAt: now,
            verificationSource: "pending",
            imageUrl: uploaded.secureUrl,
            publicId: uploaded.publicId,
            mimeType: normalizedMimeType,
            fileSizeBytes: uploaded.bytes || file.buffer.length,
            width: uploaded.width || null,
            height: uploaded.height || null,
            captureMethod: input.captureMethod,
            status: initialReceiptStatus,
            resubmissionRequested: false,
            submittedAt: now,
          },
        });

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            provider: providerCode,
            paymentMethod: providerCode,
            paymentStatus: input.autoVerify ? "Pending" : "ReviewRequired",
            ...(suppliedRef ? { transactionReference: suppliedRef } : {}),
            officialReceiptUrl: nextPaymentOfficialUrl,
            cbeReceiptToken: nextPaymentCbeToken,
            reviewReason: null,
            failureReason: null,
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentMethod: providerCode,
            paymentStatus: input.autoVerify ? "Pending" : "ReviewRequired",
            ...(suppliedRef ? { paymentReference: suppliedRef } : {}),
            trackingEvents: buildReceiptSubmittedTrackingTimeline(
              order.trackingEvents,
              providerLabel,
              input.captureMethod,
            ),
          },
        });

        await tx.paymentVerificationLog.create({
          data: {
            paymentId: payment.id,
            orderId: order.id,
            userId: actor.userId ?? null,
            provider: providerCode,
            submittedReference: suppliedRef || payment.transactionReference,
            verificationStatus: "ReceiptSubmitted",
            actorType: actor.role === "ADMIN" ? "admin" : "customer",
            actorId: actor.userId ?? null,
            reason: `Payment receipt submitted via ${input.captureMethod === "camera" ? "camera capture" : "file upload"} (${Math.round((uploaded.bytes || file.buffer.length) / 1024)} KB). OCR ref: ${ocrResult.extractedReference ?? "none"}.`,
          },
        });

        const customerId = order.userId ?? actor.userId ?? null;
        if (customerId) {
          await notificationService.createNotification(
            {
              userId: customerId,
              title: `Payment Receipt Submitted — #${order.orderNumber}`,
              message: `Your ${providerLabel} receipt for order #${order.orderNumber} (${Number(order.totalETB).toLocaleString()} ETB) was uploaded successfully${input.autoVerify ? " and is being verified." : " and queued for administrator verification."}`,
              type: "payment_receipt_submitted",
              relatedEntityId: order.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                paymentId: payment.id,
                receiptId: receipt.id,
                provider: providerCode,
                reference: suppliedRef || null,
              },
              idempotencyKey: `payment-receipt-submitted:${receipt.id}`,
            },
            tx,
          );

          if (!input.autoVerify) {
            await notificationService.createNotification(
              {
                userId: customerId,
                title: `Manual Verification Pending — #${order.orderNumber}`,
                message: `Your ${providerLabel} receipt for order #${order.orderNumber} is queued for manual administrator review.`,
                type: "payment_manual_review",
                relatedEntityId: order.orderNumber,
                relatedEntityType: "payment",
                metadata: {
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  paymentId: payment.id,
                  receiptId: receipt.id,
                  provider: providerCode,
                },
                idempotencyKey: `payment-manual-review:${receipt.id}:submitted`,
              },
              tx,
            );
          }
        }

        await notificationService.notifyAdmins(
          {
            title: `Payment Receipt Submitted — #${order.orderNumber}`,
            message: `${order.customerName} submitted a ${providerLabel} payment receipt (${input.captureMethod}) for order #${order.orderNumber}${suppliedRef ? ` (Ref: ${suppliedRef})` : ""}.`,
            type: "admin_payment_receipt_submitted",
            relatedEntityId: order.orderNumber,
            relatedEntityType: "payment",
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              paymentId: payment.id,
              receiptId: receipt.id,
              customerName: order.customerName,
              provider: providerCode,
              reference: suppliedRef || null,
              captureMethod: input.captureMethod,
              submittedAt: now.toISOString(),
            },
            idempotencyKey: `admin-receipt-submitted:${receipt.id}`,
          },
          tx,
        );

        if (!input.autoVerify) {
          await notificationService.notifyAdmins(
            {
              title: `Manual Payment Review Needed — #${order.orderNumber}`,
              message: `${order.customerName}'s ${providerLabel} receipt for order #${order.orderNumber} requires manual verification.`,
              type: "admin_payment_manual_review",
              relatedEntityId: order.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                paymentId: payment.id,
                receiptId: receipt.id,
                customerName: order.customerName,
                provider: providerCode,
              },
              idempotencyKey: `admin-payment-manual-review:${receipt.id}:submitted`,
            },
            tx,
          );
        }

        return receipt;
      });

      void notificationService.flushOutbox();
    } catch (err) {
      await cloudinaryService
        .deleteImage(
          uploaded.publicId,
          "authenticated",
          validation.format === "pdf" ? "raw" : "image",
        )
        .catch(() => {});
      throw err;
    }

    if (!input.autoVerify) {
      const pendingReceiptDto = mapReceiptRecordToDto(
        createdReceipt,
        order.orderNumber,
        order.customerName,
      );
      return {
        receipt: pendingReceiptDto,
        verified: false,
        verificationStatus: "Pending",
        verificationSource: "pending",
        paymentStatus: "ReviewRequired",
        orderStatus: order.status,
        orderNumber: order.orderNumber,
        officialReceiptUrl: pendingReceiptDto.officialReceiptUrl ?? null,
        cbeReceiptToken: pendingReceiptDto.cbeReceiptToken ?? null,
        message: "Payment receipt submitted successfully. Your payment is pending verification.",
        failureReason: null,
      };
    }

    return this.verifyReceiptAgainstProvider({
      receiptId: createdReceipt.id,
      paymentId: payment.id,
      order,
      providerCode,
      submittedReference: suppliedRef,
      submittedQr: suppliedQr,
      officialReceiptUrl: initialOfficialLink.officialReceiptUrl,
      cbeReceiptToken: initialOfficialLink.cbeReceiptToken,
      accountNumber: input.accountNumber,
      phoneNumber: input.phoneNumber,
      actor,
    });
  }

  async verifyReceiptById(
    receiptId: string,
    rawInput: unknown,
    actor: PaymentActor,
  ): Promise<SubmitPaymentReceiptResponse> {
    const input = verifyReceiptByIdSchema.parse(rawInput ?? {});

    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
      include: {
        order: true,
        payment: true,
      },
    });

    if (!receipt || !receipt.order || !receipt.payment) {
      throw new AppError({
        message: "Payment receipt not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "RECEIPT_NOT_FOUND",
      });
    }

    if (!canActorAccessOrder(receipt.order, actor, receipt.userId)) {
      throw new AppError({
        message: "You do not have permission to verify this receipt.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "FORBIDDEN",
      });
    }

    if (
      receipt.status === "Verified" ||
      receipt.status === "Approved" ||
      receipt.payment.paymentStatus === "Paid" ||
      receipt.payment.paymentStatus === "verified"
    ) {
      const verifiedDto = mapReceiptRecordToDto(
        receipt,
        receipt.order.orderNumber,
        receipt.order.customerName,
      );
      const verifiedLink = resolveOfficialReceiptLink({
        provider: receipt.provider || receipt.payment.provider,
        transactionReference:
          receipt.transactionReference || receipt.payment.transactionReference,
        verifiedReference: receipt.payment.verifiedReference,
        extractedReference: receipt.extractedReference,
        officialReceiptUrl:
          verifiedDto.officialReceiptUrl ?? receipt.payment.officialReceiptUrl,
        sourceUrl: receipt.payment.sourceUrl,
        cbeReceiptToken:
          verifiedDto.cbeReceiptToken ?? receipt.payment.cbeReceiptToken,
        qrData: receipt.extractedQrData,
      });
      return {
        receipt: {
          ...verifiedDto,
          officialReceiptUrl: verifiedLink.officialReceiptUrl,
          cbeReceiptToken: verifiedLink.cbeReceiptToken,
          officialReceiptReason: verifiedLink.reason ?? null,
        },
        verified: true,
        verificationStatus: "Verified",
        verificationSource: receipt.verificationSource || "provider_api",
        paymentStatus: receipt.payment.paymentStatus,
        orderStatus: receipt.order.status,
        orderNumber: receipt.order.orderNumber,
        officialReceiptUrl: verifiedLink.officialReceiptUrl,
        cbeReceiptToken: verifiedLink.cbeReceiptToken,
        message: "Payment receipt is already verified.",
        failureReason: null,
      };
    }

    const providerCode = (
      input.provider ||
      receipt.provider ||
      receipt.detectedProvider ||
      receipt.payment.provider ||
      "cbe"
    )
      .trim()
      .toLowerCase();
    const validatedSubmittedOfficialUrl = assertValidSubmittedOfficialUrl(
      providerCode,
      input.officialReceiptUrl,
    );
    const effectiveRef =
      input.transactionReference?.trim() ||
      receipt.transactionReference?.trim() ||
      receipt.extractedReference?.trim() ||
      "";
    const effectiveQr =
      input.qrData?.trim() || receipt.extractedQrData?.trim() || "";

    const receiptSameProvider = receipt.provider.toLowerCase() === providerCode;
    const paymentSameProvider = receipt.payment.provider.toLowerCase() === providerCode;
    const preVerifyLink = resolveOfficialReceiptLink({
      provider: providerCode,
      transactionReference: effectiveRef || null,
      extractedReference: receipt.extractedReference,
      officialReceiptUrl:
        validatedSubmittedOfficialUrl ??
        (receiptSameProvider ? receipt.officialReceiptUrl : null) ??
        (paymentSameProvider ? receipt.payment.officialReceiptUrl : null),
      sourceUrl: paymentSameProvider ? receipt.payment.sourceUrl : null,
      cbeReceiptToken:
        input.cbeReceiptToken?.trim() ||
        (receiptSameProvider ? receipt.cbeReceiptToken : null) ||
        (paymentSameProvider ? receipt.payment.cbeReceiptToken : null),
      qrData: effectiveQr || null,
    });

    const lockReceipt = await prisma.paymentReceipt.updateMany({
      where: {
        id: receipt.id,
        status: { notIn: ["Processing", "Verified", "Approved"] },
      },
      data: {
        status: "Processing",
        provider: providerCode,
        ...(effectiveRef ? { transactionReference: effectiveRef } : {}),
        officialReceiptUrl: preVerifyLink.officialReceiptUrl,
        cbeReceiptToken: preVerifyLink.cbeReceiptToken,
        failureReason: null,
      },
    });

    if (lockReceipt.count === 0) {
      throw new AppError({
        message: "Verification for this receipt is already in progress or completed.",
        statusCode: HTTP_STATUS.CONFLICT,
        code: "VERIFICATION_IN_PROGRESS",
      });
    }

    return this.verifyReceiptAgainstProvider({
      receiptId: receipt.id,
      paymentId: receipt.payment.id,
      order: receipt.order,
      providerCode,
      submittedReference: effectiveRef,
      submittedQr: effectiveQr,
      officialReceiptUrl: preVerifyLink.officialReceiptUrl,
      cbeReceiptToken: preVerifyLink.cbeReceiptToken,
      accountNumber: input.accountNumber,
      phoneNumber: input.phoneNumber,
      actor,
    });
  }

  async getOrderReceipts(
    orderIdOrNumber: string,
    actor: PaymentActor,
  ): Promise<PaymentReceiptDto[]> {
    const normalized = orderIdOrNumber.replace(/^#/, "").trim();
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: normalized }, { orderNumber: normalized }, { orderNumber: `AG-${normalized}` }],
      },
      include: {
        receipts: {
          orderBy: { submittedAt: "desc" },
        },
      },
    });

    if (!order) {
      throw new AppError({
        message: `Order "${orderIdOrNumber}" not found`,
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ORDER_NOT_FOUND",
      });
    }

    if (!canActorAccessOrder(order, actor)) {
      throw new AppError({
        message: "You do not have permission to view receipts for this order.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "FORBIDDEN",
      });
    }

    return order.receipts.map((r) => mapReceiptRecordToDto(r, order.orderNumber, order.customerName));
  }

  async createAuthorizedReceiptAccess(
    receiptId: string,
    actor: PaymentActor,
  ): Promise<ReceiptAccessUrlResponse> {
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
      include: {
        order: {
          select: { userId: true, guestSessionId: true, orderNumber: true },
        },
      },
    });

    if (!receipt) {
      throw new AppError({
        message: "Payment receipt not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "RECEIPT_NOT_FOUND",
      });
    }

    if (!canActorAccessOrder(receipt.order, actor, receipt.userId)) {
      throw new AppError({
        message: "You do not have permission to access this receipt.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "FORBIDDEN",
      });
    }

    if (!receipt.publicId && (!receipt.imageUrl || !receipt.imageUrl.startsWith("https://"))) {
      throw new AppError({
        message: "Receipt file storage location is unavailable.",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "RECEIPT_FILE_UNAVAILABLE",
      });
    }

    const tokenSubject =
      actor.userId || (actor.guestSessionId ? `guest:${actor.guestSessionId}` : "guest");
    const token = signReceiptAccessToken(
      { sub: tokenSubject, role: actor.role, receiptId: receipt.id },
      "5m",
    );
    const ext =
      receipt.mimeType === "application/pdf"
        ? "pdf"
        : receipt.mimeType === "image/png"
          ? "png"
          : receipt.mimeType === "image/webp"
            ? "webp"
            : "jpg";

    return {
      accessUrl: `/payment/receipts/${receipt.id}/file?access=${encodeURIComponent(token)}`,
      mimeType: receipt.mimeType || "image/jpeg",
      fileName: `receipt-${receipt.order.orderNumber}.${ext}`,
      expiresInSeconds: 300,
    };
  }

  async getAuthorizedReceiptFile(
    receiptId: string,
    actor: PaymentActor,
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
      include: {
        order: {
          select: { userId: true, guestSessionId: true, orderNumber: true },
        },
      },
    });

    if (!receipt) {
      throw new AppError({
        message: "Payment receipt not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "RECEIPT_NOT_FOUND",
      });
    }

    if (!canActorAccessOrder(receipt.order, actor, receipt.userId)) {
      throw new AppError({
        message: "You do not have permission to access this receipt image.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "FORBIDDEN",
      });
    }

    const candidateUrls: string[] = [];
    if (receipt.publicId) {
      try {
        const timed = cloudinaryService.getTimeLimitedAuthenticatedUrl(
          receipt.publicId,
          receipt.mimeType,
          180,
        );
        if (timed) candidateUrls.push(timed);
      } catch {
        // fallback below
      }
      try {
        const signed = cloudinaryService.getSignedAuthenticatedUrl(
          receipt.publicId,
          receipt.mimeType,
        );
        if (signed && !candidateUrls.includes(signed)) candidateUrls.push(signed);
      } catch {
        // fallback below
      }
    }
    if (receipt.imageUrl && receipt.imageUrl.startsWith("https://")) {
      if (!candidateUrls.includes(receipt.imageUrl)) {
        candidateUrls.push(receipt.imageUrl);
      }
    }

    const validUrls = candidateUrls.filter(
      (u) =>
        u.startsWith("https://res.cloudinary.com/") ||
        u.startsWith("https://api.cloudinary.com/"),
    );

    if (validUrls.length === 0) {
      throw new AppError({
        message: "Receipt file storage location is unavailable.",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "RECEIPT_FILE_UNAVAILABLE",
      });
    }

    let upstream: globalThis.Response | null = null;
    for (const candidateUrl of validUrls) {
      try {
        const res = await fetch(candidateUrl, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          upstream = res;
          break;
        }
      } catch {
        // try next signed URL fallback
      }
    }

    if (!upstream) {
      throw new AppError({
        message: "Could not retrieve stored receipt file from media storage.",
        statusCode: HTTP_STATUS.BAD_GATEWAY,
        code: "RECEIPT_STORAGE_FETCH_FAILED",
      });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const ext =
      receipt.mimeType === "application/pdf"
        ? "pdf"
        : receipt.mimeType === "image/png"
          ? "png"
          : receipt.mimeType === "image/webp"
            ? "webp"
            : "jpg";

    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: receipt.mimeType || "image/jpeg",
      filename: `receipt-${receipt.order.orderNumber}.${ext}`,
    };
  }

  async getPaymentStatus(
    orderIdOrNumber: string,
    actor: PaymentActor,
  ): Promise<PaymentStatusResponse> {
    const normalized = orderIdOrNumber.replace(/^#/, "").trim();
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: normalized }, { orderNumber: normalized }, { orderNumber: `AG-${normalized}` }],
      },
      include: {
        payment: true,
        receipts: {
          orderBy: { submittedAt: "desc" },
        },
      },
    });

    if (!order) {
      throw new AppError({
        message: `Order "${orderIdOrNumber}" not found`,
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "ORDER_NOT_FOUND",
      });
    }

    if (!canActorAccessOrder(order, actor)) {
      throw new AppError({
        message: "You do not have permission to view payment status for this order.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "FORBIDDEN",
      });
    }

    const providerCode = order.payment?.provider || order.paymentMethod;
    const providerCfg = providerCode
      ? await prisma.paymentProviderConfig.findUnique({
          where: { providerCode: providerCode.toLowerCase() },
        })
      : null;

    const receipts = order.receipts.map((r) =>
      mapReceiptRecordToDto(r, order.orderNumber, order.customerName),
    );
    const latestReceipt = receipts[0] ?? null;
    const officialLink = resolveOfficialReceiptLink({
      provider: providerCode || latestReceipt?.provider || "",
      transactionReference:
        order.payment?.transactionReference ||
        order.paymentReference ||
        latestReceipt?.transactionReference ||
        null,
      verifiedReference: order.payment?.verifiedReference ?? null,
      extractedReference: latestReceipt?.extractedReference ?? null,
      officialReceiptUrl:
        order.payment?.officialReceiptUrl ?? latestReceipt?.officialReceiptUrl ?? null,
      sourceUrl: order.payment?.sourceUrl ?? null,
      cbeReceiptToken:
        order.payment?.cbeReceiptToken ?? latestReceipt?.cbeReceiptToken ?? null,
      qrData: latestReceipt?.extractedQrData ?? null,
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paymentId: order.payment?.id,
      provider: providerCode,
      paymentStatus: order.payment?.paymentStatus || order.paymentStatus,
      verificationStatus: latestReceipt?.status ?? null,
      verificationSource:
        order.payment?.verificationSource || latestReceipt?.verificationSource || "pending",
      transactionReference: order.payment?.transactionReference || order.paymentReference || "",
      extractedReference: latestReceipt?.extractedReference ?? null,
      officialReceiptUrl: officialLink.officialReceiptUrl,
      cbeReceiptToken: officialLink.cbeReceiptToken,
      officialReceiptReason: officialLink.reason ?? null,
      amountETB: Number(order.totalETB),
      extractedAmountETB: latestReceipt?.extractedAmountETB ?? null,
      verifiedAmountETB: latestReceipt?.verifiedAmountETB ?? null,
      currency: order.payment?.currency || "ETB",
      verifiedAt: (order.payment?.verifiedAt ?? order.payment?.paidAt)?.toISOString() ?? null,
      receivingAccountName: providerCfg?.receivingAccountName,
      receivingAccountNumber: providerCfg?.receivingAccountNumber,
      reviewReason: order.payment?.reviewReason ?? latestReceipt?.rejectionReason ?? null,
      failureReason: order.payment?.failureReason ?? latestReceipt?.failureReason ?? null,
      receiptStatus: latestReceipt?.status ?? null,
      latestReceipt,
      receipts,
    };
  }

  async listAdminPayments(rawQuery: unknown): Promise<{
    items: AdminPaymentRecordDto[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    summary: {
      paidCount: number;
      pendingCount: number;
      reviewRequiredCount: number;
      failedCount: number;
      pendingReceiptsCount: number;
      manualReviewCount: number;
      verifiedReceiptsCount: number;
    };
  }> {
    const filters = adminPaymentFilterQuerySchema.parse(rawQuery);
    const where: Prisma.PaymentWhereInput = {};
    const andClauses: Prisma.PaymentWhereInput[] = [];

    if (filters.status && filters.status !== "all") {
      if (filters.status === "ReceiptPending") {
        where.receipts = { some: { status: { in: ["Pending", "Processing"] } } };
      } else if (filters.status === "ManualReview") {
        andClauses.push({
          OR: [
            { paymentStatus: "ReviewRequired" },
            { receipts: { some: { status: "Manual Review" } } },
          ],
        });
      } else if (filters.status === "Verified") {
        where.receipts = { some: { status: { in: ["Verified", "Approved"] } } };
      } else if (filters.status === "Rejected") {
        where.receipts = { some: { status: "Rejected" } };
      } else {
        where.paymentStatus = filters.status;
      }
    }

    if (filters.receiptStatus && filters.receiptStatus !== "all") {
      where.receipts = { some: { status: filters.receiptStatus } };
    }

    if (filters.provider && filters.provider !== "all") {
      where.provider = filters.provider.toLowerCase();
    }

    if (filters.startDate || filters.endDate) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        if (!Number.isNaN(start.getTime())) createdAt.gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          createdAt.lte = end;
        }
      }
      if (createdAt.gte || createdAt.lte) {
        where.createdAt = createdAt;
      }
    }

    if (filters.search) {
      const q = filters.search.trim();
      andClauses.push({
        OR: [
          { transactionReference: { contains: q, mode: "insensitive" } },
          { senderName: { contains: q, mode: "insensitive" } },
          { order: { orderNumber: { contains: q, mode: "insensitive" } } },
          { order: { customerName: { contains: q, mode: "insensitive" } } },
          { order: { customerEmail: { contains: q, mode: "insensitive" } } },
          { receipts: { some: { extractedReference: { contains: q, mode: "insensitive" } } } },
        ],
      });
    }

    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [
      total,
      payments,
      statusGroups,
      allRefCounts,
      pendingReceiptsCount,
      manualReviewCount,
      verifiedReceiptsCount,
    ] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          order: true,
          receipts: {
            orderBy: { submittedAt: "desc" },
            take: 100,
          },
          logs: {
            orderBy: { attemptedAt: "desc" },
            take: 50,
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: filters.limit,
      }),
      prisma.payment.groupBy({
        by: ["paymentStatus"],
        _count: { id: true },
      }),
      prisma.payment.groupBy({
        by: ["transactionReference"],
        _count: { id: true },
      }),
      prisma.paymentReceipt.count({
        where: { status: { in: ["Pending", "Processing"] } },
      }),
      prisma.paymentReceipt.count({
        where: { status: "Manual Review" },
      }),
      prisma.paymentReceipt.count({
        where: { status: { in: ["Verified", "Approved"] } },
      }),
    ]);

    const refFreqMap = new Map<string, number>();
    for (const r of allRefCounts) {
      const key = r.transactionReference.trim().toLowerCase();
      refFreqMap.set(key, (refFreqMap.get(key) ?? 0) + r._count.id);
    }

    const statusCountMap = new Map(statusGroups.map((g) => [g.paymentStatus, g._count.id]));

    const items: AdminPaymentRecordDto[] = payments.map((p) => {
      const normRef = p.transactionReference.trim().toLowerCase();
      const refCount = refFreqMap.get(normRef) ?? 0;
      const isPlaceholderRef =
        p.transactionReference.startsWith("REF-") || p.transactionReference.startsWith("PENDING-");
      const hasDupLog = p.logs.some((l) =>
        l.errorMessage?.toLowerCase().includes("duplicate"),
      );
      const receipts = p.receipts.map((r) =>
        mapReceiptRecordToDto(r, p.order.orderNumber, p.order.customerName),
      );
      const latestReceipt = receipts[0] ?? null;
      const providerCode = p.provider || p.paymentMethod || latestReceipt?.provider || "";
      const officialLink = resolveOfficialReceiptLink({
        provider: providerCode,
        transactionReference:
          p.transactionReference || latestReceipt?.transactionReference || null,
        verifiedReference: p.verifiedReference,
        extractedReference: latestReceipt?.extractedReference ?? null,
        officialReceiptUrl:
          p.officialReceiptUrl ?? latestReceipt?.officialReceiptUrl ?? null,
        sourceUrl: p.sourceUrl,
        cbeReceiptToken:
          p.cbeReceiptToken ?? latestReceipt?.cbeReceiptToken ?? null,
        qrData: latestReceipt?.extractedQrData ?? null,
      });

      return {
        id: p.id,
        orderId: p.orderId,
        orderNumber: p.order.orderNumber,
        userId: p.userId ?? p.order.userId,
        customerName: p.order.customerName,
        customerEmail: p.order.customerEmail,
        provider: providerCode,
        paymentMethod: p.paymentMethod,
        transactionReference: p.transactionReference,
        verifiedReference: p.verifiedReference,
        extractedReference: latestReceipt?.extractedReference ?? null,
        officialReceiptUrl: officialLink.officialReceiptUrl,
        cbeReceiptToken: officialLink.cbeReceiptToken,
        officialReceiptReason: officialLink.reason ?? null,
        amountETB: Number(p.amount),
        extractedAmountETB: latestReceipt?.extractedAmountETB ?? null,
        verifiedAmountETB: latestReceipt?.verifiedAmountETB ?? null,
        expectedOrderTotalETB: Number(p.order.totalETB),
        currency: p.currency,
        paymentStatus: p.paymentStatus,
        verificationSource:
          p.verificationSource || latestReceipt?.verificationSource || "pending",
        failureReason: p.failureReason ?? latestReceipt?.failureReason ?? null,
        orderStatus: p.order.status,
        senderName: p.senderName,
        senderAccount: p.senderAccount,
        receiverName: p.receiverName,
        receiverAccount: p.receiverAccount,
        transactionDate: p.transactionDate?.toISOString() ?? null,
        sourceUrl: p.sourceUrl,
        verifiedAt: (p.verifiedAt ?? p.paidAt)?.toISOString() ?? null,
        reviewedByAdminId: p.reviewedByAdminId,
        reviewReason: p.reviewReason,
        reviewedAt: p.reviewedAt?.toISOString() ?? null,
        verificationResponse:
          p.verificationResponse && typeof p.verificationResponse === "object"
            ? (p.verificationResponse as Record<string, unknown>)
            : latestReceipt?.providerResponse ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        isDuplicateReference: (!isPlaceholderRef && refCount > 1) || hasDupLog,
        receiptStatus: latestReceipt?.status ?? null,
        latestReceipt,
        receipts,
        logs: p.logs.map((l) => ({
          id: l.id,
          paymentId: l.paymentId,
          orderId: l.orderId,
          provider: l.provider,
          submittedReference: l.submittedReference,
          verificationStatus: l.verificationStatus,
          errorMessage: l.errorMessage,
          chekiHttpStatus: l.chekiHttpStatus,
          attemptedAt: l.attemptedAt.toISOString(),
          actorType: l.actorType,
          actorId: l.actorId,
          reason: l.reason,
        })),
      };
    });

    return {
      items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / filters.limit)),
      },
      summary: {
        paidCount: (statusCountMap.get("Paid") ?? 0) + (statusCountMap.get("verified") ?? 0),
        pendingCount:
          (statusCountMap.get("Pending") ?? 0) +
          (statusCountMap.get("pending") ?? 0) +
          (statusCountMap.get("VerificationPending") ?? 0),
        reviewRequiredCount: statusCountMap.get("ReviewRequired") ?? 0,
        failedCount: (statusCountMap.get("Failed") ?? 0) + (statusCountMap.get("failed") ?? 0),
        pendingReceiptsCount,
        manualReviewCount,
        verifiedReceiptsCount,
      },
    };
  }

  async reviewPayment(
    paymentId: string,
    adminUserId: string,
    rawPayload: unknown,
  ): Promise<AdminPaymentRecordDto> {
    const payload = adminReviewPaymentSchema.parse(rawPayload);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: true,
        receipts: { orderBy: { submittedAt: "desc" } },
        logs: { orderBy: { attemptedAt: "desc" } },
      },
    });

    if (!payment) {
      throw new AppError({
        message: "Payment record not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PAYMENT_NOT_FOUND",
      });
    }

    if (payment.paymentStatus === "Paid" || payment.paymentStatus === "verified") {
      throw new AppError({
        message: "An already verified payment record cannot be silently overridden.",
        statusCode: HTTP_STATUS.CONFLICT,
        code: "PAYMENT_ALREADY_PAID",
      });
    }

    const now = new Date();
    const latestReceipt = payment.receipts[0] ?? null;
    let resolvedRef = payload.reference?.trim() || payment.transactionReference;
    const providerCode = payment.provider || payment.paymentMethod || "cbe";
    const targetCustomerId = payment.userId ?? payment.order.userId;
    const validatedAdminOfficialUrl = assertValidSubmittedOfficialUrl(
      providerCode,
      payload.officialReceiptUrl,
    );

    if (payload.decision === "approve") {
      if (
        (!resolvedRef || resolvedRef.startsWith("REF-") || resolvedRef.startsWith("PENDING-")) &&
        latestReceipt
      ) {
        resolvedRef =
          latestReceipt.transactionReference?.trim() ||
          latestReceipt.extractedReference?.trim() ||
          `RCP-${payment.order.orderNumber}-${latestReceipt.id.slice(0, 6).toUpperCase()}`;
      }

      if (!resolvedRef || resolvedRef.startsWith("REF-")) {
        throw new AppError({
          message: "A valid transaction reference is required to approve payment manually.",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "REFERENCE_REQUIRED",
        });
      }

      const verifiedKey = normalizePaymentReference(providerCode, resolvedRef);
      const approvedOfficialLink = resolveOfficialReceiptLink({
        provider: providerCode,
        transactionReference: resolvedRef,
        verifiedReference: verifiedKey,
        extractedReference: latestReceipt?.extractedReference,
        officialReceiptUrl:
          validatedAdminOfficialUrl ??
          payment.officialReceiptUrl ??
          latestReceipt?.officialReceiptUrl,
        sourceUrl: payment.sourceUrl,
        cbeReceiptToken:
          payload.cbeReceiptToken?.trim() ||
          payment.cbeReceiptToken ||
          latestReceipt?.cbeReceiptToken,
        qrData: latestReceipt?.extractedQrData,
      });

      await prisma.$transaction(async (tx) => {
        const [dupPayment, dupReceipt] = await Promise.all([
          tx.payment.findFirst({
            where: {
              id: { not: payment.id },
              verifiedReference: verifiedKey,
            },
            select: { id: true },
          }),
          tx.paymentReceipt.findFirst({
            where: {
              orderId: { not: payment.orderId },
              normalizedVerifiedReference: verifiedKey,
            },
            select: { id: true },
          }),
        ]);
        if (dupPayment || dupReceipt) {
          throw new AppError({
            message: "Cannot approve: this transaction reference is already claimed by another paid order.",
            statusCode: HTTP_STATUS.CONFLICT,
            code: "DUPLICATE_TRANSACTION_REFERENCE",
          });
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            transactionReference: resolvedRef,
            verifiedReference: verifiedKey,
            officialReceiptUrl: approvedOfficialLink.officialReceiptUrl,
            cbeReceiptToken: approvedOfficialLink.cbeReceiptToken,
            paymentStatus: "Paid",
            verificationSource: "admin_manual",
            failureReason: null,
            verifiedAt: now,
            paidAt: now,
            reviewedByAdminId: adminUserId,
            reviewReason: payload.reason,
            reviewedAt: now,
          },
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: "Paid",
            paymentReference: resolvedRef,
            status: "Confirmed",
            trackingEvents: buildVerifiedTrackingTimeline(
              payment.order.trackingEvents,
              `${providerCode.toUpperCase()} (Admin Manual Review)`,
              resolvedRef,
            ),
          },
        });

        if (latestReceipt) {
          await tx.paymentReceipt.update({
            where: { id: latestReceipt.id },
            data: {
              status: "Verified",
              transactionReference: resolvedRef,
              normalizedVerifiedReference: verifiedKey,
              officialReceiptUrl: approvedOfficialLink.officialReceiptUrl,
              cbeReceiptToken: approvedOfficialLink.cbeReceiptToken,
              verificationSource: "admin_manual",
              verifiedAmount: Number(payment.order.totalETB),
              verifiedCurrency: "ETB",
              failureReason: null,
              rejectionReason: null,
              resubmissionRequested: false,
              reviewedByAdminId: adminUserId,
              reviewedAt: now,
              verifiedAt: now,
            },
          });
        }

        await tx.paymentVerificationLog.create({
          data: {
            paymentId: payment.id,
            orderId: payment.orderId,
            userId: payment.userId,
            provider: providerCode,
            submittedReference: resolvedRef,
            verificationStatus: "ManualApproved",
            actorType: "admin",
            actorId: adminUserId,
            reason: payload.reason,
          },
        });

        if (targetCustomerId) {
          await notificationService.createNotification(
            {
              userId: targetCustomerId,
              title: `Payment Approved — Order #${payment.order.orderNumber}`,
              message: `Your payment of ${Number(payment.amount).toLocaleString()} ETB (Ref: ${resolvedRef}) has been approved by an administrator. Your order is now confirmed for dispatch.`,
              type: "payment_approved",
              relatedEntityId: payment.order.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: payment.orderId,
                orderNumber: payment.order.orderNumber,
                paymentId: payment.id,
                provider: providerCode,
                reference: resolvedRef,
                amountETB: Number(payment.amount),
              },
              idempotencyKey: `payment-approved:${payment.id}:${resolvedRef}`,
            },
            tx,
          );

          if (payment.order.status !== "Confirmed") {
            await notificationService.createNotification(
              {
                userId: targetCustomerId,
                title: `Order Confirmed — #${payment.order.orderNumber}`,
                message: `Your order #${payment.order.orderNumber} is confirmed and queued for dispatch.`,
                type: "order_confirmed",
                relatedEntityId: payment.order.orderNumber,
                relatedEntityType: "order",
                metadata: {
                  orderId: payment.orderId,
                  orderNumber: payment.order.orderNumber,
                },
                idempotencyKey: `order-confirmed:${payment.orderId}`,
              },
              tx,
            );
          }
        }

        await notificationService.notifyAdmins(
          {
            title: `Payment Verified — Order #${payment.order.orderNumber}`,
            message: `Payment for ${payment.order.customerName}'s order #${payment.order.orderNumber} (${Number(payment.amount).toLocaleString()} ETB, Ref: ${resolvedRef}) was manually approved.`,
            type: "admin_payment_verified",
            relatedEntityId: payment.order.orderNumber,
            relatedEntityType: "payment",
            metadata: {
              orderId: payment.orderId,
              orderNumber: payment.order.orderNumber,
              paymentId: payment.id,
              customerName: payment.order.customerName,
              provider: providerCode,
              reference: resolvedRef,
              amountETB: Number(payment.amount),
            },
            idempotencyKey: `admin-payment-verified:${payment.id}:${resolvedRef}`,
          },
          tx,
        );
      });

      void notificationService.flushOutbox();
    } else {
      const isNewReceiptRequested =
        payload.decision === "request_new_receipt" || Boolean(payload.requestNewReceipt);
      const activeReceipts = payment.receipts.filter(
        (r) => r.status === "Pending" || r.status === "Processing" || r.status === "Manual Review",
      );
      const receiptIdsToReject =
        activeReceipts.length > 0
          ? activeReceipts.map((r) => r.id)
          : latestReceipt
            ? [latestReceipt.id]
            : [];

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            paymentStatus: "Failed",
            verificationSource: "admin_manual",
            failureReason: payload.reason,
            reviewedByAdminId: adminUserId,
            reviewReason: payload.reason,
            reviewedAt: now,
          },
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: "Failed",
            status: "PendingPayment",
          },
        });

        if (receiptIdsToReject.length > 0) {
          await tx.paymentReceipt.updateMany({
            where: { id: { in: receiptIdsToReject } },
            data: {
              status: "Rejected",
              verificationSource: "admin_manual",
              failureReason: payload.reason,
              rejectionReason: payload.reason,
              resubmissionRequested: isNewReceiptRequested,
              reviewedByAdminId: adminUserId,
              reviewedAt: now,
            },
          });
        }

        await tx.paymentVerificationLog.create({
          data: {
            paymentId: payment.id,
            orderId: payment.orderId,
            userId: payment.userId,
            provider: providerCode,
            submittedReference: resolvedRef,
            verificationStatus: isNewReceiptRequested
              ? "ReceiptResubmissionRequested"
              : "ManualRejected",
            errorMessage: payload.reason,
            actorType: "admin",
            actorId: adminUserId,
            reason: payload.reason,
          },
        });

        const rejectKeySuffix = `${payment.id}:${now.getTime()}`;

        if (targetCustomerId) {
          await notificationService.createNotification(
            {
              userId: targetCustomerId,
              title: isNewReceiptRequested
                ? `New Receipt Requested — Order #${payment.order.orderNumber}`
                : `Payment Rejected — Order #${payment.order.orderNumber}`,
              message: `Your payment for order #${payment.order.orderNumber} was rejected. Reason: ${payload.reason}. Please upload or capture a clear replacement receipt.`,
              type: "payment_rejected",
              relatedEntityId: payment.order.orderNumber,
              relatedEntityType: "payment",
              metadata: {
                orderId: payment.orderId,
                orderNumber: payment.order.orderNumber,
                paymentId: payment.id,
                provider: providerCode,
                reason: payload.reason,
                resubmissionRequested: isNewReceiptRequested,
              },
              idempotencyKey: `payment-rejected:${rejectKeySuffix}`,
            },
            tx,
          );
        }

        await notificationService.notifyAdmins(
          {
            title: `Payment Rejected — Order #${payment.order.orderNumber}`,
            message: `${payment.order.customerName}'s payment for order #${payment.order.orderNumber} was rejected. Reason: ${payload.reason}`,
            type: "admin_payment_rejected",
            relatedEntityId: payment.order.orderNumber,
            relatedEntityType: "payment",
            metadata: {
              orderId: payment.orderId,
              orderNumber: payment.order.orderNumber,
              paymentId: payment.id,
              customerName: payment.order.customerName,
              provider: providerCode,
              reason: payload.reason,
            },
            idempotencyKey: `admin-payment-rejected:${rejectKeySuffix}`,
          },
          tx,
        );
      });

      void notificationService.flushOutbox();
    }

    const result = await this.listAdminPayments({ search: payment.order.orderNumber, page: 1, limit: 1 });
    return result.items.find((i) => i.id === payment.id)!;
  }

  async processRefund(
    paymentId: string,
    adminUserId: string,
    rawPayload: unknown,
  ): Promise<AdminPaymentRecordDto> {
    const payload = adminRefundPaymentSchema.parse(rawPayload);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new AppError({
        message: "Payment record not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "PAYMENT_NOT_FOUND",
      });
    }

    const currentStatus = payment.paymentStatus.toLowerCase();
    if (currentStatus !== "paid" && currentStatus !== "verified" && currentStatus !== "refundinitiated") {
      throw new AppError({
        message: "Only paid or refund-initiated payments can be refunded",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "PAYMENT_NOT_REFUNDABLE",
      });
    }

    const isCompleted = payload.stage === "completed";
    const nextPaymentStatus = isCompleted ? "Refunded" : "RefundInitiated";
    const now = new Date();
    const targetCustomerId = payment.userId ?? payment.order.userId;

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          paymentStatus: nextPaymentStatus,
          reviewedByAdminId: adminUserId,
          reviewReason: payload.reason,
          reviewedAt: now,
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: nextPaymentStatus,
          ...(isCompleted ? { status: "Cancelled" } : {}),
        },
      });

      await tx.paymentVerificationLog.create({
        data: {
          paymentId: payment.id,
          orderId: payment.orderId,
          userId: payment.userId,
          provider: payment.provider,
          submittedReference: payment.transactionReference,
          verificationStatus: nextPaymentStatus,
          actorType: "admin",
          actorId: adminUserId,
          reason: payload.reason,
        },
      });

      if (targetCustomerId) {
        await notificationService.createNotification(
          {
            userId: targetCustomerId,
            title: isCompleted
              ? `Refund Completed — Order #${payment.order.orderNumber}`
              : `Refund Initiated — Order #${payment.order.orderNumber}`,
            message: isCompleted
              ? `Your refund of ${Number(payment.amount).toLocaleString()} ETB for order #${payment.order.orderNumber} has been completed. Note: ${payload.reason}`
              : `A refund of ${Number(payment.amount).toLocaleString()} ETB for order #${payment.order.orderNumber} has been initiated. Note: ${payload.reason}`,
            type: isCompleted ? "payment_refund_completed" : "payment_refund_initiated",
            relatedEntityId: payment.order.orderNumber,
            relatedEntityType: "payment",
            metadata: {
              orderId: payment.orderId,
              orderNumber: payment.order.orderNumber,
              paymentId: payment.id,
              amountETB: Number(payment.amount),
              reason: payload.reason,
            },
            idempotencyKey: `payment-refund:${payment.id}:${nextPaymentStatus}`,
          },
          tx,
        );
      }
    });

    void notificationService.flushOutbox();

    const result = await this.listAdminPayments({ search: payment.order.orderNumber, page: 1, limit: 1 });
    return result.items.find((i) => i.id === payment.id)!;
  }

  async listProviderConfigs(): Promise<PaymentProviderConfigDto[]> {
    await ensurePaymentProviderConfigsSeeded();
    const configs = await prisma.paymentProviderConfig.findMany({
      orderBy: { providerCode: "asc" },
    });
    return configs.map((c) => ({
      id: c.id,
      providerCode: c.providerCode,
      displayName: c.displayName,
      receivingAccountName: c.receivingAccountName,
      receivingAccountNumber: c.receivingAccountNumber,
      accountSuffixDigits: c.accountSuffixDigits,
      instructions: c.instructions,
      isEnabled: c.isEnabled,
      maxPaymentAgeDays: c.maxPaymentAgeDays,
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  async updateProviderConfig(providerCode: string, rawPatch: unknown): Promise<PaymentProviderConfigDto> {
    await ensurePaymentProviderConfigsSeeded();
    const patch = updatePaymentProviderConfigSchema.parse(rawPatch);
    const code = providerCode.trim().toLowerCase();

    const updated = await prisma.paymentProviderConfig.upsert({
      where: { providerCode: code },
      update: {
        displayName: patch.displayName,
        receivingAccountName: patch.receivingAccountName,
        receivingAccountNumber: patch.receivingAccountNumber,
        accountSuffixDigits:
          patch.accountSuffixDigits !== undefined ? patch.accountSuffixDigits : undefined,
        instructions: patch.instructions !== undefined ? patch.instructions : undefined,
        isEnabled: patch.isEnabled,
        maxPaymentAgeDays: patch.maxPaymentAgeDays,
      },
      create: {
        providerCode: code,
        displayName: patch.displayName || code.toUpperCase(),
        receivingAccountName: patch.receivingAccountName,
        receivingAccountNumber: patch.receivingAccountNumber,
        accountSuffixDigits: patch.accountSuffixDigits ?? null,
        instructions: patch.instructions ?? null,
        isEnabled: patch.isEnabled ?? true,
        maxPaymentAgeDays: patch.maxPaymentAgeDays ?? 30,
      },
    });

    return {
      id: updated.id,
      providerCode: updated.providerCode,
      displayName: updated.displayName,
      receivingAccountName: updated.receivingAccountName,
      receivingAccountNumber: updated.receivingAccountNumber,
      accountSuffixDigits: updated.accountSuffixDigits,
      instructions: updated.instructions,
      isEnabled: updated.isEnabled,
      maxPaymentAgeDays: updated.maxPaymentAgeDays,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}

export const paymentVerificationService = new PaymentVerificationService();

