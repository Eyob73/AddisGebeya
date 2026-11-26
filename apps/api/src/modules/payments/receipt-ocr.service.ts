import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import jsQRImport from "jsqr";
import sharp, { type Sharp } from "sharp";
import { createWorker, type Worker } from "tesseract.js";
import {
  extractCbeReceiptToken,
  resolveOfficialReceiptLink,
} from "@addisgebeya/shared";
import type { ReceiptOcrExtractionDto } from "@addisgebeya/types";

const require = createRequire(import.meta.url);
const engData = require("@tesseract.js-data/eng") as { langPath?: string };

// Bound libvips native memory in constrained containers
sharp.cache(false);
sharp.concurrency(1);

const OCR_JOB_TIMEOUT_MS = 20_000;
const OCR_WORKER_IDLE_MS = 10_000;
const MIN_OCR_CGROUP_LIMIT_BYTES = 384 * 1024 * 1024;
const MIN_OCR_CGROUP_HEADROOM_BYTES = 160 * 1024 * 1024;
const MAX_RSS_FOR_SMALL_CONTAINER_BYTES = 200 * 1024 * 1024;

function readCgroupPositiveInt(path: string): number | null {
  try {
    const raw = readFileSync(path, "utf8").trim();
    if (!raw || raw === "max") return null;
    const parsed = Number.parseInt(raw, 10);
    // Ignore kernel "unlimited" sentinel values (>= 1 TiB)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1024 ** 4) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function readCgroupInactiveFileBytes(statPath: string, key: string): number {
  try {
    const content = readFileSync(statPath, "utf8");
    const match = content.match(new RegExp(`^${key}\\s+(\\d+)`, "m"));
    return match?.[1] ? Number.parseInt(match[1], 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function getOcrMemoryConstraintReason(): string | null {
  const v2Limit = readCgroupPositiveInt("/sys/fs/cgroup/memory.max");
  const v2Current = readCgroupPositiveInt("/sys/fs/cgroup/memory.current");
  const v1Limit =
    v2Limit == null ? readCgroupPositiveInt("/sys/fs/cgroup/memory/memory.limit_in_bytes") : null;
  const v1Current =
    v2Limit == null ? readCgroupPositiveInt("/sys/fs/cgroup/memory/memory.usage_in_bytes") : null;

  const limitBytes = v2Limit ?? v1Limit;
  const currentBytes = v2Limit != null ? v2Current : v1Current;
  const inactiveFileBytes =
    v2Limit != null
      ? readCgroupInactiveFileBytes("/sys/fs/cgroup/memory.stat", "inactive_file")
      : v1Limit != null
        ? readCgroupInactiveFileBytes("/sys/fs/cgroup/memory/memory.stat", "total_inactive_file")
        : 0;

  if (limitBytes == null) {
    return null;
  }

  if (limitBytes < MIN_OCR_CGROUP_LIMIT_BYTES) {
    return `Container memory limit (${Math.round(limitBytes / (1024 * 1024))} MB) is below safe OCR threshold`;
  }

  if (currentBytes != null) {
    const effectiveUsed = Math.max(0, currentBytes - Math.min(currentBytes, inactiveFileBytes));
    const headroom = limitBytes - effectiveUsed;
    if (headroom < MIN_OCR_CGROUP_HEADROOM_BYTES) {
      return `Insufficient container memory headroom (${Math.round(headroom / (1024 * 1024))} MB free)`;
    }
  }

  if (
    limitBytes < 512 * 1024 * 1024 &&
    process.memoryUsage().rss > MAX_RSS_FOR_SMALL_CONTAINER_BYTES
  ) {
    return "Process RSS headroom is too low for OCR";
  }

  return null;
}

function createSharpInput(buffer: Buffer): Sharp {
  return sharp(buffer, {
    failOn: "none",
    limitInputPixels: 25_000_000,
    sequentialRead: true,
  });
}

type JsQrFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" },
) => { data: string } | null;

const jsQR = ((jsQRImport as unknown as { default?: JsQrFn }).default ??
  (jsQRImport as unknown as JsQrFn));

const OFFICIAL_RECEIPT_URL_REGEX =
  /https?:\/\/(?:mbreciept\.cbe\.com\.et|mbreceipt\.cbe\.com\.et|apps\.cbe\.com\.et(?::\d+)?|transactioninfo\.ethiotelecom\.et|cs\.bankofabyssinia\.com|receipts\.dashenbanksc\.com|awashpay\.awashbank\.com(?::\d+)?|cbepay1\.cbe\.com\.et|m-pesabusiness\.safaricom\.et|transinfo\.wegagenbanksc\.com\.et(?::\d+)?|online\.bunnabanksc\.com|receipt-backend\.zamzambank\.com\.et|receipt\.ebirr\.com|receipts\.siinqeebank\.com(?::\d+)?)\/[^\s<>"')]+/i;

const NON_REFERENCE_WORDS = new Set([
  "SUCCESS",
  "SUCCESSFUL",
  "COMPLETED",
  "COMPLETE",
  "PENDING",
  "FAILED",
  "SETTLED",
  "VERIFIED",
  "TRANSACTION",
  "REFERENCE",
  "RECEIPT",
  "NUMBER",
  "AMOUNT",
  "COMMERCIAL",
  "ETHIOPIA",
  "ABYSSINIA",
  "TELEBIRR",
  "DASHEN",
  "AWASH",
  "CBEBIRR",
  "ADDISABABA",
  "ADDISGEBEYA",
  "TRANSFER",
  "PAYMENT",
  "ACCOUNT",
  "STATUS",
  "CURRENCY",
  "BALANCE",
  "SERVICE",
  "CHARGE",
]);

function isPlausibleReference(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const cleaned = candidate.trim().replace(/[.,;:!?)]+$/, "");
  if (!cleaned) return null;

  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }

  const compact = cleaned.replace(/[\s]+/g, "");
  if (compact.length < 6 || compact.length > 64) return null;

  const upper = compact.toUpperCase();
  if (NON_REFERENCE_WORDS.has(upper)) return null;

  // Reject Ethiopian mobile numbers mistaken for reference IDs
  if (/^(?:\+?251|0)?[79]\d{8}$/.test(compact.replace(/[-]/g, ""))) {
    return null;
  }

  // Reject pure currency amounts or pure date strings
  if (/^\d+(?:\.\d{1,2})?$/.test(compact) && compact.length < 8) return null;
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(compact)) return null;
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(compact)) return null;

  // Must contain at least one digit unless long alphanumeric receipt token
  if (!/\d/.test(compact) && compact.length < 14) {
    return null;
  }

  return compact;
}

export function detectProviderFromText(text: string, qrData?: string | null): string | null {
  const combined = `${text}\n${qrData ?? ""}`.toLowerCase();

  if (
    combined.includes("cbepay1.cbe.com.et") ||
    combined.includes("cbe birr") ||
    combined.includes("cbebirr")
  ) {
    return "cbebirr";
  }
  if (
    combined.includes("commercial bank of ethiopia") ||
    combined.includes("mbreciept.cbe.com.et") ||
    combined.includes("mbreceipt.cbe.com.et") ||
    combined.includes("apps.cbe.com.et") ||
    combined.includes("cbetetaa") ||
    /\bcbe\s*mobile\b/i.test(combined)
  ) {
    return "cbe";
  }
  if (
    combined.includes("telebirr") ||
    combined.includes("ethiotelecom") ||
    combined.includes("ethio telecom") ||
    combined.includes("transactioninfo.ethiotelecom.et")
  ) {
    return "telebirr";
  }
  if (
    combined.includes("bank of abyssinia") ||
    combined.includes("abyssinia") ||
    combined.includes("cs.bankofabyssinia.com") ||
    combined.includes("abysetaa")
  ) {
    return "boa";
  }
  if (
    combined.includes("dashen bank") ||
    combined.includes("dashenbanksc") ||
    combined.includes("dashetaa") ||
    combined.includes("amole")
  ) {
    return "dashen";
  }
  if (
    combined.includes("awash bank") ||
    combined.includes("awashpay") ||
    combined.includes("awashbirr") ||
    combined.includes("awinet")
  ) {
    return "awash";
  }
  if (
    combined.includes("m-pesa") ||
    combined.includes("mpesa") ||
    combined.includes("safaricom")
  ) {
    return "mpesa";
  }
  if (combined.includes("wegagen") || combined.includes("wegaetaa")) {
    return "wegagen";
  }
  if (combined.includes("bunna") || combined.includes("bunaetaa")) {
    return "bunna";
  }
  if (combined.includes("zamzam") || combined.includes("zamzetaa")) {
    return "zamzam";
  }
  if (combined.includes("siinqee") || combined.includes("sinqetaa")) {
    return "siinqee";
  }
  if (combined.includes("ebirr") || combined.includes("receipt.ebirr.com")) {
    return "ebirr";
  }

  return null;
}

function extractReferenceFromText(
  text: string,
  qrData: string | null,
  providerHint?: string | null,
): string | null {
  // 1. Official receipt URL in QR or OCR text
  if (qrData) {
    const qrUrlMatch = qrData.match(OFFICIAL_RECEIPT_URL_REGEX);
    if (qrUrlMatch?.[0]) {
      // Telebirr receipt URL carries the TX code at the end of /receipt/<TX>
      if (qrUrlMatch[0].includes("transactioninfo.ethiotelecom.et/receipt/")) {
        const txPart = qrUrlMatch[0].split("/receipt/").pop()?.split(/[?#]/)[0];
        const validTx = isPlausibleReference(txPart);
        if (validTx) return validTx;
      }
      return qrUrlMatch[0].trim();
    }
  }

  const textUrlMatch = text.match(OFFICIAL_RECEIPT_URL_REGEX);
  if (textUrlMatch?.[0]) {
    if (textUrlMatch[0].includes("transactioninfo.ethiotelecom.et/receipt/")) {
      const txPart = textUrlMatch[0].split("/receipt/").pop()?.split(/[?#]/)[0];
      const validTx = isPlausibleReference(txPart);
      if (validTx) return validTx;
    }
    return textUrlMatch[0].trim();
  }

  const normalizedLines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const joinedText = normalizedLines.join("\n");

  // 2. Labeled transaction reference patterns (same line or next line)
  const labeledPatterns = [
    /(?:Transaction\s*(?:ID|No\.?|Number|Ref(?:erence)?|Code)|Reference\s*(?:No\.?|Number|ID|Code)?|Receipt\s*(?:No\.?|Number|ID)|FT\s*(?:No\.?|Number|Ref(?:erence)?)|TXN\s*(?:ID|No\.?|Ref)|Slip\s*(?:No\.?|Ref(?:erence)?)|Confirmation\s*(?:Code|ID|No\.?)|Share\s*ID|\bTID\b|\bRef\.?\s*(?:No\.?|ID)?)\s*[:#-]?\s*\n?\s*([A-Za-z0-9][A-Za-z0-9\-/]{5,44})/gi,
  ];

  for (const pattern of labeledPatterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(joinedText)) !== null) {
      const valid = isPlausibleReference(match[1]);
      if (valid) return valid;
    }
  }

  // 3. Provider-specific token extraction
  const effectiveProvider = (providerHint || detectProviderFromText(joinedText, qrData) || "").toLowerCase();

  // CBE / BOA / Dashen FT pattern (e.g. FT2611ABC12345)
  const ftMatches = joinedText.match(/\bFT[A-Z0-9]{6,18}\b/gi);
  if (ftMatches) {
    for (const token of ftMatches) {
      const valid = isPlausibleReference(token.toUpperCase());
      if (valid) return valid;
    }
  }

  if (effectiveProvider === "wegagen") {
    const hex24 = joinedText.match(/\b[a-f0-9]{24}\b/i);
    if (hex24?.[0]) return hex24[0];
  }

  if (effectiveProvider === "telebirr" || effectiveProvider === "mpesa" || effectiveProvider === "cbebirr") {
    // Telebirr / M-Pesa 9-12 char uppercase alphanumeric transaction codes containing both letters and digits
    const tokens = joinedText.match(/\b[A-Z0-9]{9,14}\b/g) ?? [];
    for (const token of tokens) {
      if (/[A-Z]/.test(token) && /\d/.test(token)) {
        const valid = isPlausibleReference(token);
        if (valid) return valid;
      }
    }
  }

  // Generic mixed-alphanumeric transaction ID fallback (at least 8 chars, mixed letters + digits)
  const genericTokens = joinedText.match(/\b[A-Z0-9]{8,24}\b/g) ?? [];
  for (const token of genericTokens) {
    if (/[A-Z]{2,}/.test(token) && /\d{3,}/.test(token)) {
      const valid = isPlausibleReference(token);
      if (valid) return valid;
    }
  }

  return null;
}

function parseNumericAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0 || num > 100_000_000) return null;
  return Math.round(num * 100) / 100;
}

function extractAmountFromText(text: string): number | null {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Skip lines clearly referring to service fee / VAT / commission unless nothing else exists
  const nonFeeLines = lines.filter(
    (l) => !/\b(?:service\s*(?:charge|fee)|commission|vat|tax|fee)\b/i.test(l),
  );
  const searchPool = nonFeeLines.join("\n");

  const primaryAmountRegexes = [
    /(?:Settled\s*Amount|Transferred\s*Amount|Transfer\s*Amount|Paid\s*Amount|Amount\s*Paid|Total\s*(?:Paid|Amount)|Transaction\s*Amount|Principal\s*Amount)\s*[:-]?\s*(?:ETB|Birr|Br\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\bAmount\s*[:-]?\s*(?:ETB|Birr|Br\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:ETB|Birr|Br\.?)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr)\b/i,
  ];

  for (const regex of primaryAmountRegexes) {
    const m = searchPool.match(regex);
    if (m?.[1]) {
      const parsed = parseNumericAmount(m[1]);
      if (parsed !== null) return parsed;
    }
  }

  // Fallback across all lines
  for (const regex of primaryAmountRegexes) {
    const m = text.match(regex);
    if (m?.[1]) {
      const parsed = parseNumericAmount(m[1]);
      if (parsed !== null) return parsed;
    }
  }

  return null;
}

function extractDateFromText(text: string): string | null {
  const labeledDate = text.match(
    /(?:Transaction\s*Date(?:\s*(?:&|and)\s*Time)?|Payment\s*Date(?:\s*(?:&|and)\s*Time)?|Date\s*(?:&|and)\s*Time|Completed\s*On|Date\s*Time|Date)\s*[:-]?\s*([^\n\r]{6,40})/i,
  );
  if (labeledDate?.[1]) {
    return labeledDate[1].trim();
  }

  const isoMatch = text.match(
    /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?\b/i,
  );
  if (isoMatch?.[0]) return isoMatch[0].trim();

  const dmyMatch = text.match(
    /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?\b/i,
  );
  if (dmyMatch?.[0]) return dmyMatch[0].trim();

  const monthMatch = text.match(
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}(?:[\s,]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?\b/i,
  );
  if (monthMatch?.[0]) return monthMatch[0].trim();

  return null;
}

function extractLabeledField(text: string, labelsPattern: string): string | null {
  const regex = new RegExp(
    `(?:${labelsPattern})\\s*[:-]?\\s*([^\\n\\r]{2,70})`,
    "i",
  );
  const m = text.match(regex);
  if (!m?.[1]) return null;
  const cleaned = m[1].trim();
  return cleaned.length >= 2 ? cleaned : null;
}

function extractStatusFromText(text: string): string | null {
  const m = text.match(
    /(?:Transaction\s*Status|Payment\s*Status|Status)\s*[:-]?\s*([A-Za-z ]{3,24})/i,
  );
  if (m?.[1]) {
    return m[1].trim();
  }
  if (/\b(?:Completed|Successful|Success|Settled|Paid)\b/i.test(text)) {
    return "Completed";
  }
  if (/\b(?:Failed|Declined|Rejected|Cancelled)\b/i.test(text)) {
    return "Failed";
  }
  return null;
}

export function parseReceiptText(
  rawText: string,
  qrData: string | null = null,
  hintProvider?: string | null,
): Omit<ReceiptOcrExtractionDto, "confidence"> {
  const normalizedText = rawText.replace(/\r/g, "").trim();
  const detectedProvider = detectProviderFromText(normalizedText, qrData);
  const effectiveProvider = detectedProvider || hintProvider || null;

  const extractedReference = extractReferenceFromText(normalizedText, qrData, effectiveProvider);
  const extractedAmountETB = extractAmountFromText(normalizedText);
  const extractedDate = extractDateFromText(normalizedText);

  const extractedSenderName = extractLabeledField(
    normalizedText,
    "Sender\\s*Name|Payer\\s*Name|From\\s*Name|Debited\\s*Customer|Customer\\s*Name|Sender|Payer|From",
  );
  const extractedSenderAccount = extractLabeledField(
    normalizedText,
    "Sender\\s*(?:Account|Acc|Phone|No\\.?)|Payer\\s*(?:Account|Phone|No\\.?)|Debited\\s*Account|Debit\\s*Account|From\\s*Account",
  );
  const extractedReceiverName = extractLabeledField(
    normalizedText,
    "Receiver\\s*Name|Beneficiary\\s*Name|Recipient\\s*Name|Credited\\s*Customer|Merchant\\s*Name|Receiver|Beneficiary|Recipient|Paid\\s*To|To",
  );
  const extractedReceiverAccount = extractLabeledField(
    normalizedText,
    "Receiver\\s*(?:Account|Acc|No\\.?)|Beneficiary\\s*(?:Account|No\\.?)|Credited\\s*Account|Credit\\s*Account|Merchant\\s*(?:ID|Account|No\\.?)|To\\s*Account",
  );
  const extractedStatus = extractStatusFromText(normalizedText);
  const officialResolved = resolveOfficialReceiptLink({
    provider: effectiveProvider,
    transactionReference: extractedReference,
    extractedReference,
    qrData,
  });
  const detectedCbeToken =
    officialResolved.cbeReceiptToken ??
    extractCbeReceiptToken(qrData) ??
    extractCbeReceiptToken(normalizedText.match(OFFICIAL_RECEIPT_URL_REGEX)?.[0] ?? null);

  const extractionSucceeded = Boolean(extractedReference || qrData || detectedCbeToken);
  const message = extractionSucceeded
    ? extractedReference
      ? `Extracted transaction reference "${extractedReference}"${detectedProvider ? ` (${detectedProvider.toUpperCase()})` : ""}. Please verify the details below before submitting.`
      : "Decoded payment receipt QR payload. Please confirm before submitting."
    : "Automatic OCR could not identify a transaction reference from this receipt image. You can enter the reference manually below or submit for administrator manual review.";

  return {
    extractedReference,
    extractedQrData: qrData,
    extractedOfficialReceiptUrl: officialResolved.officialReceiptUrl,
    extractedCbeToken: detectedCbeToken,
    extractedAmountETB,
    extractedDate,
    extractedSenderName,
    extractedSenderAccount,
    extractedReceiverName,
    extractedReceiverAccount,
    extractedStatus,
    detectedProvider,
    extractionSucceeded,
    message,
    rawTextPreview: normalizedText ? normalizedText.slice(0, 1200) : null,
  };
}

let workerPromise: Promise<Worker> | null = null;
let workerQueue: Promise<unknown> = Promise.resolve();
let activeOcrJobs = 0;
let idleTerminateTimer: NodeJS.Timeout | null = null;
const terminatingWorkers = new WeakSet<object>();

function clearIdleTerminateTimer(): void {
  if (idleTerminateTimer) {
    clearTimeout(idleTerminateTimer);
    idleTerminateTimer = null;
  }
}

function scheduleIdleTerminate(): void {
  clearIdleTerminateTimer();
  if (activeOcrJobs > 0 || !workerPromise) return;
  idleTerminateTimer = setTimeout(() => {
    idleTerminateTimer = null;
    if (activeOcrJobs === 0) {
      void shutdownOcrWorker();
    }
  }, OCR_WORKER_IDLE_MS);
  idleTerminateTimer.unref();
}

async function getOcrWorker(): Promise<Worker> {
  clearIdleTerminateTimer();
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      langPath: engData.langPath,
      cacheMethod: "none",
      errorHandler: (err) => {
        console.warn("[ReceiptOCR] Worker reported error:", err);
      },
    })
      .then((worker) => {
        const rawWorker = (worker as unknown as {
          worker?: {
            on?: (event: string, listener: (...args: unknown[]) => void) => void;
          };
        }).worker;
        if (rawWorker?.on) {
          rawWorker.on("error", (err) => {
            console.warn("[ReceiptOCR] Worker thread error:", err);
            workerPromise = null;
          });
          rawWorker.on("exit", (code) => {
            if (code !== 0 && !terminatingWorkers.has(worker as unknown as object)) {
              console.warn(`[ReceiptOCR] Worker thread exited unexpectedly (code=${String(code)})`);
            }
            workerPromise = null;
          });
        }
        return worker;
      })
      .catch((err) => {
        workerPromise = null;
        throw err;
      });
  }
  return workerPromise;
}

function enqueueOcrJob<T>(task: (worker: Worker) => Promise<T>): Promise<T> {
  clearIdleTerminateTimer();
  activeOcrJobs += 1;

  const next = workerQueue.then(async () => {
    let timeoutHandle: NodeJS.Timeout | null = null;
    try {
      const worker = await getOcrWorker();
      return await Promise.race([
        task(worker),
        new Promise<T>((_resolve, reject) => {
          timeoutHandle = setTimeout(() => {
            void shutdownOcrWorker();
            reject(new Error("OCR processing timed out"));
          }, OCR_JOB_TIMEOUT_MS);
          timeoutHandle.unref();
        }),
      ]);
    } catch (err) {
      await shutdownOcrWorker().catch(() => {});
      throw err;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  });

  workerQueue = next
    .catch(() => {})
    .finally(() => {
      activeOcrJobs = Math.max(0, activeOcrJobs - 1);
      if (activeOcrJobs === 0) {
        scheduleIdleTerminate();
      }
    });

  return next;
}

export async function shutdownOcrWorker(): Promise<void> {
  clearIdleTerminateTimer();
  const active = workerPromise;
  workerPromise = null;
  if (active) {
    try {
      const worker = await active;
      terminatingWorkers.add(worker as unknown as object);
      await worker.terminate();
    } catch {
      // ignore worker shutdown error
    }
  }
}

async function decodeQrFromImageBuffer(buffer: Buffer): Promise<string | null> {
  const attempts: Array<(img: Sharp) => Sharp> = [
    (img) =>
      img
        .rotate()
        .resize({ width: 960, withoutEnlargement: true })
        .ensureAlpha()
        .raw(),
    (img) =>
      img
        .rotate()
        .resize({ width: 1120 })
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.1 })
        .ensureAlpha()
        .raw(),
  ];

  for (const pipeline of attempts) {
    try {
      const { data, info } = await pipeline(createSharpInput(buffer)).toBuffer({
        resolveWithObject: true,
      });
      const clamped = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
      const code = jsQR(clamped, info.width, info.height, {
        inversionAttempts: "attemptBoth",
      });
      if (code?.data?.trim()) {
        return code.data.trim();
      }
    } catch {
      // Ignore individual QR attempt failures
    }
  }

  return null;
}

async function resolveOcrTargetWidth(buffer: Buffer): Promise<number> {
  const metadata = await createSharpInput(buffer).rotate().metadata();
  const width = metadata.width ?? 1000;
  // Upscale small screenshots cleanly while bounding oversized photos to save container RAM
  return width < 1000 ? Math.min(1300, Math.max(1000, width * 2)) : Math.min(1350, width);
}

async function preprocessReceiptBuffer(
  buffer: Buffer,
  targetWidth: number,
  mode: "primary" | "highContrast",
): Promise<Buffer> {
  const pipeline = createSharpInput(buffer)
    .rotate()
    .resize({ width: targetWidth, kernel: sharp.kernel.lanczos3 })
    .grayscale()
    .normalize();

  if (mode === "highContrast") {
    return pipeline.linear(1.25, -20).threshold(155).png({ compressionLevel: 6 }).toBuffer();
  }

  return pipeline.sharpen({ sigma: 1.1 }).png({ compressionLevel: 6 }).toBuffer();
}

export class ReceiptOcrService {
  async extractFromBuffer(
    buffer: Buffer,
    hintProvider?: string | null,
  ): Promise<ReceiptOcrExtractionDto> {
    if (!buffer || buffer.length === 0) {
      return {
        extractedReference: null,
        extractedQrData: null,
        extractedAmountETB: null,
        extractedDate: null,
        extractedSenderName: null,
        extractedSenderAccount: null,
        extractedReceiverName: null,
        extractedReceiverAccount: null,
        extractedStatus: null,
        detectedProvider: hintProvider ?? null,
        confidence: 0,
        extractionSucceeded: false,
        message: "Empty receipt image provided.",
        rawTextPreview: null,
      };
    }

    if (
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d
    ) {
      const latinText = buffer.toString("latin1");
      const parenChunks: string[] = [];
      const textOpRegex = /\(([^()]{2,200})\)/g;
      let match: RegExpExecArray | null;
      while ((match = textOpRegex.exec(latinText)) !== null && parenChunks.length < 250) {
        if (match[1]) {
          parenChunks.push(match[1].replace(/\\([()\\])/g, "$1"));
        }
      }
      const combinedPdfText = parenChunks.join("\n").replace(/[^\x20-\x7E\n]/g, " ");
      const parsedPdf = parseReceiptText(combinedPdfText, null, hintProvider);
      return {
        ...parsedPdf,
        confidence: parsedPdf.extractedReference ? 85 : 0,
        message: parsedPdf.extractedReference
          ? parsedPdf.message
          : "PDF receipt uploaded. Please enter or confirm the transaction reference number before submitting, or submit for administrator manual review.",
      };
    }

    const qrData = await decodeQrFromImageBuffer(buffer).catch(() => null);
    const qrOnlyParsed = qrData ? parseReceiptText("", qrData, hintProvider) : null;

    const memoryConstraintReason = getOcrMemoryConstraintReason();
    if (memoryConstraintReason) {
      console.warn(`[ReceiptOCR] Skipping Tesseract OCR (${memoryConstraintReason})`);
      const fallbackParsed = qrOnlyParsed ?? parseReceiptText("", null, hintProvider);
      return {
        ...fallbackParsed,
        confidence: qrData ? 95 : 0,
        message: qrData
          ? fallbackParsed.message
          : "Server memory is currently limited for automatic text scanning. Please enter the transaction reference manually or submit for administrator manual review.",
      };
    }

    try {
      const targetWidth = await resolveOcrTargetWidth(buffer);
      let primaryBuf: Buffer | null = await preprocessReceiptBuffer(buffer, targetWidth, "primary");

      const primaryResult = await enqueueOcrJob(async (worker) => {
        const res = await worker.recognize(primaryBuf!);
        return {
          text: res.data.text || "",
          confidence: Number(res.data.confidence || 0),
        };
      });
      primaryBuf = null;

      let parsed = parseReceiptText(primaryResult.text, qrData, hintProvider);
      let bestConfidence = primaryResult.confidence;

      const qrHasSufficientData = Boolean(
        qrOnlyParsed?.extractedReference || qrOnlyParsed?.extractedOfficialReceiptUrl,
      );

      // Fallback high-contrast binarized OCR pass when primary pass misses reference or has low confidence
      if (
        !parsed.extractedReference &&
        !qrHasSufficientData &&
        (primaryResult.confidence < 68 || primaryResult.text.trim().length < 25)
      ) {
        let highContrastBuf: Buffer | null = await preprocessReceiptBuffer(
          buffer,
          targetWidth,
          "highContrast",
        );
        const fallbackResult = await enqueueOcrJob(async (worker) => {
          const res = await worker.recognize(highContrastBuf!);
          return {
            text: res.data.text || "",
            confidence: Number(res.data.confidence || 0),
          };
        });
        highContrastBuf = null;

        const fallbackParsed = parseReceiptText(fallbackResult.text, qrData, hintProvider);
        if (
          fallbackParsed.extractedReference ||
          (!parsed.extractedAmountETB && fallbackParsed.extractedAmountETB) ||
          fallbackResult.confidence > primaryResult.confidence + 8
        ) {
          parsed = {
            ...fallbackParsed,
            extractedAmountETB: fallbackParsed.extractedAmountETB ?? parsed.extractedAmountETB,
            extractedDate: fallbackParsed.extractedDate ?? parsed.extractedDate,
            extractedSenderName: fallbackParsed.extractedSenderName ?? parsed.extractedSenderName,
            extractedSenderAccount:
              fallbackParsed.extractedSenderAccount ?? parsed.extractedSenderAccount,
            extractedReceiverName:
              fallbackParsed.extractedReceiverName ?? parsed.extractedReceiverName,
            extractedReceiverAccount:
              fallbackParsed.extractedReceiverAccount ?? parsed.extractedReceiverAccount,
            extractedStatus: fallbackParsed.extractedStatus ?? parsed.extractedStatus,
            detectedProvider: fallbackParsed.detectedProvider ?? parsed.detectedProvider,
          };
          bestConfidence = Math.max(bestConfidence, fallbackResult.confidence);
        }
      }

      return {
        ...parsed,
        confidence: Math.round(bestConfidence * 10) / 10,
      };
    } catch (err) {
      const fallbackParsed = parseReceiptText("", qrData, hintProvider);
      return {
        ...fallbackParsed,
        confidence: qrData ? 95 : 0,
        message: qrData
          ? "Decoded payment receipt QR payload. Please confirm before submitting."
          : `Automatic OCR could not read text from this image (${err instanceof Error ? err.message : "processing error"}). You can enter the transaction reference manually or submit for manual review.`,
      };
    }
  }
}

export const receiptOcrService = new ReceiptOcrService();
