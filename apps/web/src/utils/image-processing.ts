/**
 * Client-side receipt image validation and readability-preserving compression.
 */

export const ALLOWED_RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const ALLOWED_RECEIPT_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf"] as const;

export const MAX_RECEIPT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const COMPRESSION_THRESHOLD_BYTES = 900 * 1024; // Compress files > ~900 KB or oversized dimensions
const MAX_RECEIPT_DIMENSION = 1800; // Preserves crisp bank reference numbers & QR codes

export interface ReceiptValidationResult {
  valid: boolean;
  error?: string;
}

export interface PreparedReceiptImage {
  file: File;
  previewUrl: string;
  originalSizeBytes: number;
  finalSizeBytes: number;
  width: number;
  height: number;
  wasCompressed: boolean;
  isPdf?: boolean;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateReceiptFile(file: File | null | undefined): ReceiptValidationResult {
  if (!file) {
    return { valid: false, error: "Please select or capture a payment receipt image." };
  }

  if (file.size === 0) {
    return { valid: false, error: "The selected file is empty and cannot be submitted." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type.toLowerCase();
  const isAllowedMime = ALLOWED_RECEIPT_MIME_TYPES.includes(
    mime as (typeof ALLOWED_RECEIPT_MIME_TYPES)[number],
  );
  const isAllowedExt = ALLOWED_RECEIPT_EXTENSIONS.includes(
    ext as (typeof ALLOWED_RECEIPT_EXTENSIONS)[number],
  );

  if (!isAllowedMime && !isAllowedExt) {
    return {
      valid: false,
      error: `Unsupported file format ("${file.name}"). Only JPG, JPEG, PNG, WebP images and PDF receipts are accepted.`,
    };
  }

  if (mime && !isAllowedMime) {
    return {
      valid: false,
      error: `Invalid MIME type ("${file.type}"). Only JPG, JPEG, PNG, WebP images and PDF files are accepted.`,
    };
  }

  if (file.size > MAX_RECEIPT_FILE_BYTES) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the 5 MB maximum limit. Please choose a smaller file.`,
    };
  }

  return { valid: true };
}

function loadImageElement(file: File): Promise<{ img: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, objectUrl });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected file could not be decoded as a valid image."));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Validates and optionally compresses a receipt image without degrading text readability.
 * Preserves PDF documents unmodified and ensures files stay under 5 MB.
 */
export async function prepareReceiptImageFile(file: File): Promise<PreparedReceiptImage> {
  const basicValidation = validateReceiptFile(file);
  if (!basicValidation.valid) {
    throw new Error(basicValidation.error || "Invalid receipt file.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = file.type.toLowerCase() === "application/pdf" || ext === "pdf";
  if (isPdf) {
    return {
      file,
      previewUrl: URL.createObjectURL(file),
      originalSizeBytes: file.size,
      finalSizeBytes: file.size,
      width: 0,
      height: 0,
      wasCompressed: false,
      isPdf: true,
    };
  }

  const { img, objectUrl } = await loadImageElement(file);
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  if (!naturalWidth || !naturalHeight) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Receipt image appears corrupted or has zero dimensions.");
  }

  const longestEdge = Math.max(naturalWidth, naturalHeight);
  const needsResize = longestEdge > MAX_RECEIPT_DIMENSION;
  const needsSizeReduction = file.size > COMPRESSION_THRESHOLD_BYTES;

  if (!needsResize && !needsSizeReduction) {
    return {
      file,
      previewUrl: objectUrl,
      originalSizeBytes: file.size,
      finalSizeBytes: file.size,
      width: naturalWidth,
      height: naturalHeight,
      wasCompressed: false,
    };
  }

  const scale = needsResize ? MAX_RECEIPT_DIMENSION / longestEdge : 1;
  const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      file,
      previewUrl: objectUrl,
      originalSizeBytes: file.size,
      finalSizeBytes: file.size,
      width: naturalWidth,
      height: naturalHeight,
      wasCompressed: false,
    };
  }

  // Fill white canvas background so transparent PNGs convert cleanly to JPEG if needed
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Prefer WebP or JPEG at high quality (0.86) so receipt digits and QR codes stay crisp
  const targetMime = file.type === "image/webp" ? "image/webp" : "image/jpeg";
  const targetExt = targetMime === "image/webp" ? "webp" : "jpg";
  let compressedBlob = await canvasToBlob(canvas, targetMime, 0.86);

  // Fallback to JPEG if browser cannot encode WebP canvas
  if (!compressedBlob && targetMime !== "image/jpeg") {
    compressedBlob = await canvasToBlob(canvas, "image/jpeg", 0.86);
  }

  if (!compressedBlob) {
    return {
      file,
      previewUrl: objectUrl,
      originalSizeBytes: file.size,
      finalSizeBytes: file.size,
      width: naturalWidth,
      height: naturalHeight,
      wasCompressed: false,
    };
  }

  // Keep original if compression did not shrink the file and dimensions were fine
  if (!needsResize && compressedBlob.size >= file.size) {
    return {
      file,
      previewUrl: objectUrl,
      originalSizeBytes: file.size,
      finalSizeBytes: file.size,
      width: naturalWidth,
      height: naturalHeight,
      wasCompressed: false,
    };
  }

  if (compressedBlob.size > MAX_RECEIPT_FILE_BYTES) {
    compressedBlob = await canvasToBlob(canvas, "image/jpeg", 0.72);
  }

  if (!compressedBlob || compressedBlob.size > MAX_RECEIPT_FILE_BYTES) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Unable to compress image below the 5 MB limit. Please upload a smaller image.");
  }

  URL.revokeObjectURL(objectUrl);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "payment-receipt";
  const compressedFile = new File([compressedBlob], `${baseName}.${targetExt}`, {
    type: compressedBlob.type || "image/jpeg",
    lastModified: Date.now(),
  });
  const compressedPreviewUrl = URL.createObjectURL(compressedFile);

  return {
    file: compressedFile,
    previewUrl: compressedPreviewUrl,
    originalSizeBytes: file.size,
    finalSizeBytes: compressedFile.size,
    width: targetWidth,
    height: targetHeight,
    wasCompressed: compressedFile.size < file.size || needsResize,
  };
}

