import { parseReceiptText } from "@addisgebeya/shared";
import type { ReceiptOcrExtractionDto } from "@/types/store.types";

const BROWSER_OCR_TIMEOUT_MS = 25_000;

async function loadReceiptCanvas(file: File): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }

  let objectUrl: string | null = null;
  let bitmap: ImageBitmap | null = null;

  try {
    let sourceWidth: number;
    let sourceHeight: number;
    let drawSource: CanvasImageSource;

    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(file);
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      drawSource = bitmap;
    } else {
      objectUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not decode receipt image"));
        el.src = objectUrl!;
      });
      sourceWidth = img.naturalWidth || img.width;
      sourceHeight = img.naturalHeight || img.height;
      drawSource = img;
    }

    const targetWidth =
      sourceWidth < 900
        ? Math.min(1300, Math.max(960, sourceWidth * 2))
        : Math.min(1350, sourceWidth);
    const scale = targetWidth / Math.max(1, sourceWidth);
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(drawSource, 0, 0, targetWidth, targetHeight);

    return canvas;
  } finally {
    bitmap?.close();
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

async function decodeQrFromCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const jsQRModule = await import("jsqr");
  const jsQR = jsQRModule.default ?? (jsQRModule as unknown as typeof jsQRModule.default);
  if (typeof jsQR !== "function") return null;

  const regions: Array<{ x: number; y: number; w: number; h: number }> = [
    { x: 0, y: 0, w: canvas.width, h: canvas.height },
  ];

  // Tall mobile receipts frequently place the QR payload in the bottom half
  if (canvas.height > canvas.width * 1.2 && canvas.height > 200) {
    const cropY = Math.floor(canvas.height * 0.45);
    regions.push({ x: 0, y: cropY, w: canvas.width, h: canvas.height - cropY });
  }

  for (const region of regions) {
    const imageData = ctx.getImageData(region.x, region.y, region.w, region.h);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });
    if (code?.data?.trim()) {
      return code.data.trim();
    }
  }

  return null;
}

function preprocessCanvasForOcr(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const contrasted = Math.max(0, Math.min(255, Math.round((luminance - 128) * 1.25 + 128)));
    data[i] = contrasted;
    data[i + 1] = contrasted;
    data[i + 2] = contrasted;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Runs client-side QR + Tesseract OCR fallback in the browser when server-side
 * text scanning is skipped (for example on memory-constrained API containers).
 */
export async function extractReceiptInBrowser(
  file: File,
  hintProvider?: string | null,
  existingQrData?: string | null,
): Promise<ReceiptOcrExtractionDto | null> {
  if (typeof window === "undefined") {
    return null;
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return null;
  }

  const canvas = await loadReceiptCanvas(file);
  const qrData = existingQrData || (await decodeQrFromCanvas(canvas).catch(() => null));

  preprocessCanvasForOcr(canvas);

  let recognizedText = "";
  let recognizedConfidence = 0;
  let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const { createWorker } = await import("tesseract.js");
    worker = await Promise.race([
      createWorker("eng", 1, {
        errorHandler: () => {
          // Handled via promise rejection / fallback
        },
      }),
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Browser OCR initialization timed out"));
        }, BROWSER_OCR_TIMEOUT_MS);
      }),
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const result = await Promise.race([
      worker.recognize(canvas),
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Browser OCR timed out"));
        }, BROWSER_OCR_TIMEOUT_MS);
      }),
    ]);

    recognizedText = result.data.text || "";
    recognizedConfidence = Number(result.data.confidence || 0);
  } catch {
    if (!qrData) {
      return null;
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    canvas.width = 0;
    canvas.height = 0;
    if (worker) {
      await worker.terminate().catch(() => {});
    }
  }

  const parsed = parseReceiptText(recognizedText, qrData, hintProvider);
  const confidence =
    recognizedConfidence > 0
      ? Math.round(recognizedConfidence * 10) / 10
      : qrData
        ? 95
        : 0;

  return {
    ...parsed,
    confidence,
  };
}

/**
 * Combines server extraction metadata (such as QR/provider hints) with client OCR results.
 */
export function mergeReceiptOcrResults(
  serverResult: ReceiptOcrExtractionDto | null,
  browserResult: ReceiptOcrExtractionDto,
): ReceiptOcrExtractionDto {
  if (!serverResult) {
    return browserResult;
  }

  const extractedReference =
    browserResult.extractedReference ?? serverResult.extractedReference;
  const extractedQrData =
    serverResult.extractedQrData ?? browserResult.extractedQrData;
  const extractedOfficialReceiptUrl =
    browserResult.extractedOfficialReceiptUrl ??
    serverResult.extractedOfficialReceiptUrl ??
    null;
  const extractedCbeToken =
    browserResult.extractedCbeToken ?? serverResult.extractedCbeToken ?? null;
  const extractionSucceeded = Boolean(
    extractedReference || extractedQrData || extractedCbeToken,
  );

  return {
    extractedReference,
    extractedQrData,
    extractedOfficialReceiptUrl,
    extractedCbeToken,
    extractedAmountETB:
      browserResult.extractedAmountETB ?? serverResult.extractedAmountETB,
    extractedDate: browserResult.extractedDate ?? serverResult.extractedDate,
    extractedSenderName:
      browserResult.extractedSenderName ?? serverResult.extractedSenderName,
    extractedSenderAccount:
      browserResult.extractedSenderAccount ?? serverResult.extractedSenderAccount,
    extractedReceiverName:
      browserResult.extractedReceiverName ?? serverResult.extractedReceiverName,
    extractedReceiverAccount:
      browserResult.extractedReceiverAccount ?? serverResult.extractedReceiverAccount,
    extractedStatus:
      browserResult.extractedStatus ?? serverResult.extractedStatus,
    detectedProvider:
      browserResult.detectedProvider ?? serverResult.detectedProvider,
    confidence: Math.max(browserResult.confidence, serverResult.confidence),
    extractionSucceeded,
    message: extractionSucceeded ? browserResult.message : serverResult.message,
    rawTextPreview: browserResult.rawTextPreview ?? serverResult.rawTextPreview ?? null,
  };
}

