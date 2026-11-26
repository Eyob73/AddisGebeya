import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import jsQRImport from "jsqr";
import sharp, { type Sharp } from "sharp";
import { createWorker, type Worker } from "tesseract.js";
import {
  detectProviderFromText,
  parseReceiptText,
} from "@addisgebeya/shared";
import type { ReceiptOcrExtractionDto } from "@addisgebeya/types";

export { detectProviderFromText, parseReceiptText };

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
    (img) =>
      img
        .rotate()
        .resize({ width: 1120 })
        .grayscale()
        .normalize()
        .threshold(140)
        .ensureAlpha()
        .raw(),
  ];

  try {
    const meta = await createSharpInput(buffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if ((!meta.orientation || meta.orientation === 1) && width >= 200 && height > width * 1.2) {
      const cropTop = Math.floor(height * 0.45);
      const cropHeight = height - cropTop;
      if (cropHeight >= 150) {
        attempts.push((img) =>
          img
            .extract({ left: 0, top: cropTop, width, height: cropHeight })
            .resize({ width: Math.min(1200, width) })
            .grayscale()
            .normalize()
            .sharpen({ sigma: 1.1 })
            .ensureAlpha()
            .raw(),
        );
      }
    }
  } catch {
    // Metadata inspection failure still leaves full-frame QR attempts intact
  }

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
