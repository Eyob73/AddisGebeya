import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import { cloudinary, getCloudinaryConfigStatus } from "./cloudinary.config.js";
import { AppError } from "../../utils/app-error.js";
import { HTTP_STATUS } from "@addisgebeya/shared";

export type MediaFolder =
  | "addisgebeya/products"
  | "addisgebeya/categories"
  | "addisgebeya/profiles"
  | "addisgebeya/banners"
  | "addisgebeya/receipts";

export type CloudinaryDeliveryType = "upload" | "authenticated" | "private";

export interface ImageValidationResult {
  valid: boolean;
  format?: "jpeg" | "png" | "webp";
  error?: string;
}

export interface ReceiptFileValidationResult {
  valid: boolean;
  format?: "jpeg" | "png" | "webp" | "pdf";
  error?: string;
}

export interface UploadedImageResult {
  publicId: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  resourceType: string;
}

export interface TransformationOptions {
  width?: number;
  height?: number;
  crop?: "fill" | "scale" | "fit" | "thumb" | "limit";
  quality?: "auto" | number;
  format?: "auto" | "webp" | "jpg" | "png";
}

interface CloudinaryErrorLike {
  message?: string;
  http_code?: number;
  error?: {
    message?: string;
    http_code?: number;
  };
}

function parseCloudinaryError(err: unknown): { message: string; httpCode?: number } {
  if (err && typeof err === "object") {
    const e = err as CloudinaryErrorLike;
    return {
      message: e.error?.message || e.message || (err instanceof Error ? err.message : String(err)),
      httpCode: e.http_code ?? e.error?.http_code,
    };
  }
  return { message: String(err) };
}

export class CloudinaryService {
  /**
   * Validates true image contents via binary signatures (magic bytes)
   * and enforces the 5 MB maximum size limit.
   */
  validateImageBuffer(buffer: Buffer): ImageValidationResult {
    if (!buffer || buffer.length === 0) {
      return { valid: false, error: "Empty image buffer provided." };
    }

    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
    if (buffer.length > MAX_BYTES) {
      return {
        valid: false,
        error: `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the 5 MB maximum limit.`,
      };
    }

    // Magic Bytes Verification
    // 1. JPEG / JPG: 0xFF 0xD8 0xFF
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { valid: true, format: "jpeg" };
    }

    // 2. PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { valid: true, format: "png" };
    }

    // 3. WebP: "RIFF" at offset 0, and "WEBP" at offset 8
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && // 'R'
      buffer[1] === 0x49 && // 'I'
      buffer[2] === 0x46 && // 'F'
      buffer[3] === 0x46 && // 'F'
      buffer[8] === 0x57 && // 'W'
      buffer[9] === 0x45 && // 'E'
      buffer[10] === 0x42 && // 'B'
      buffer[11] === 0x50 // 'P'
    ) {
      return { valid: true, format: "webp" };
    }

    return {
      valid: false,
      error:
        "Invalid file signature. Only real JPEG, JPG, PNG, and WebP image files are accepted.",
    };
  }

  /**
   * Validates payment receipt contents via magic bytes (JPG/JPEG, PNG, WebP, or PDF)
   * and enforces the 5 MB maximum size limit.
   */
  validateReceiptBuffer(buffer: Buffer): ReceiptFileValidationResult {
    const imgCheck = this.validateImageBuffer(buffer);
    if (imgCheck.valid && imgCheck.format) {
      return { valid: true, format: imgCheck.format };
    }

    if (!buffer || buffer.length === 0) {
      return { valid: false, error: "Empty receipt file provided." };
    }

    const MAX_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      return {
        valid: false,
        error: `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the 5 MB maximum limit.`,
      };
    }

    // PDF: "%PDF-" (0x25 0x50 0x44 0x46 0x2D)
    if (
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d
    ) {
      return { valid: true, format: "pdf" };
    }

    return {
      valid: false,
      error:
        "Invalid file signature. Only real JPEG, JPG, PNG, WebP images and PDF documents are accepted.",
    };
  }

  private ensureConfigured(): void {
    const status = getCloudinaryConfigStatus();
    if (!status.configured) {
      throw new AppError({
        message: `Cloudinary is not configured properly: ${status.reason}`,
        statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
        code: "CLOUDINARY_CONFIG_ERROR",
      });
    }
  }

  /**
   * Uploads an image buffer to Cloudinary using an upload stream.
   */
  async uploadSingle(
    buffer: Buffer,
    options: {
      folder: MediaFolder;
      filenamePrefix?: string;
      publicId?: string;
      tags?: string[];
      deliveryType?: CloudinaryDeliveryType;
      allowPdf?: boolean;
    },
  ): Promise<UploadedImageResult> {
    const validation = options.allowPdf
      ? this.validateReceiptBuffer(buffer)
      : this.validateImageBuffer(buffer);
    if (!validation.valid) {
      throw new AppError({
        message: validation.error || "Unsupported receipt file format",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_IMAGE_FILE",
      });
    }

    this.ensureConfigured();

    const isPdf = validation.format === "pdf";
    const baseUniqueId =
      options.publicId ||
      `${options.filenamePrefix || "img"}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const uniqueId = isPdf && !baseUniqueId.endsWith(".pdf") ? `${baseUniqueId}.pdf` : baseUniqueId;

    const uploadOptions: UploadApiOptions = {
      folder: options.folder,
      public_id: uniqueId,
      resource_type: isPdf ? "raw" : "image",
      type: options.deliveryType || "upload",
      overwrite: true,
      tags: options.tags || ["addisgebeya"],
    };

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        let settled = false;
        const done = (err: unknown, uploadResult?: UploadApiResponse) => {
          if (settled) return;
          settled = true;
          if (err || !uploadResult) {
            return reject(err || new Error("Cloudinary upload failed with empty response"));
          }
          resolve(uploadResult);
        };

        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, uploadResult) => {
          done(error, uploadResult);
        });
        stream.on("error", (streamErr) => done(streamErr));
        stream.end(buffer);
      });

      return {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        resourceType: result.resource_type,
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;

      const { message: errorMsg, httpCode } = parseCloudinaryError(error);

      if (
        httpCode === 401 ||
        errorMsg.includes("cloud_name mismatch") ||
        errorMsg.includes("Invalid cloud_name") ||
        errorMsg.includes("Must supply api_key")
      ) {
        throw new AppError({
          message: `Cloudinary authentication/configuration failed (${errorMsg}). Verify CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.`,
          statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
          code: "CLOUDINARY_CONFIG_ERROR",
        });
      }

      throw new AppError({
        message: `Cloudinary storage upload error: ${errorMsg}`,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code: "STORAGE_UPLOAD_ERROR",
      });
    }
  }

  /**
   * Uploads multiple images sequentially to preserve order and avoid rate limits.
   */
  async uploadMultiple(
    files: Array<{ buffer: Buffer; originalname: string }>,
    folder: MediaFolder,
    filenamePrefix = "prod",
  ): Promise<UploadedImageResult[]> {
    if (!files || files.length === 0) {
      return [];
    }

    if (files.length > 8) {
      throw new AppError({
        message: "Maximum 8 images allowed per upload batch.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "TOO_MANY_FILES",
      });
    }

    const results: UploadedImageResult[] = [];
    const uploadedPublicIds: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        const res = await this.uploadSingle(file.buffer, {
          folder,
          filenamePrefix: `${filenamePrefix}_${i + 1}`,
        });
        results.push(res);
        uploadedPublicIds.push(res.publicId);
      }
      return results;
    } catch (err) {
      // Transactional storage cleanup on batch failure:
      // Roll back all images uploaded in this batch so no orphaned assets remain
      for (const pubId of uploadedPublicIds) {
        await this.deleteImage(pubId).catch(() => {});
      }
      throw err;
    }
  }

  /**
   * Replaces an existing image by uploading the new image first,
   * and deleting the previous asset only after successful upload.
   */
  async replaceImage(
    oldPublicId: string | null | undefined,
    newBuffer: Buffer,
    folder: MediaFolder,
    filenamePrefix = "prod_replace",
  ): Promise<UploadedImageResult> {
    // 1. Upload new image first
    const newImage = await this.uploadSingle(newBuffer, {
      folder,
      filenamePrefix,
    });

    // 2. Remove old image only after successful upload
    if (oldPublicId && oldPublicId.trim()) {
      await this.deleteImage(oldPublicId).catch((delErr) => {
        console.warn(`[Cloudinary Cleanup] Failed to delete previous image asset (${oldPublicId}):`, delErr);
      });
    }

    return newImage;
  }

  /**
   * Generates a signed Cloudinary URL for private/authenticated assets (e.g., payment receipts).
   */
  getSignedAuthenticatedUrl(publicId: string, mimeOrFormat?: string): string {
    if (!publicId || !publicId.trim()) return "";
    this.ensureConfigured();

    const lower = mimeOrFormat?.toLowerCase() ?? "";
    const isPdf = lower.includes("pdf") || publicId.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      return cloudinary.url(publicId, {
        resource_type: "raw",
        type: "authenticated",
        sign_url: true,
        secure: true,
      });
    }

    let format: string | undefined;
    if (lower.includes("jpeg") || lower.includes("jpg")) format = "jpg";
    else if (lower.includes("png")) format = "png";
    else if (lower.includes("webp")) format = "webp";

    return cloudinary.url(publicId, {
      type: "authenticated",
      sign_url: true,
      secure: true,
      ...(format ? { format } : {}),
    });
  }

  /**
   * Generates a strictly time-limited signed Cloudinary download URL for server-side streaming.
   */
  getTimeLimitedAuthenticatedUrl(
    publicId: string,
    mimeOrFormat?: string,
    ttlSeconds = 300,
  ): string {
    if (!publicId || !publicId.trim()) return "";
    this.ensureConfigured();

    const lower = mimeOrFormat?.toLowerCase() ?? "";
    const isPdf = lower.includes("pdf") || publicId.toLowerCase().endsWith(".pdf");
    const expiresAt = Math.floor(Date.now() / 1000) + Math.max(30, ttlSeconds);

    let format = "jpg";
    if (isPdf) format = "";
    else if (lower.includes("png")) format = "png";
    else if (lower.includes("webp")) format = "webp";

    return cloudinary.utils.private_download_url(publicId, format, {
      resource_type: isPdf ? "raw" : "image",
      type: "authenticated",
      expires_at: expiresAt,
    });
  }

  /**
   * Deletes an asset from Cloudinary using its public ID.
   */
  async deleteImage(
    publicId: string,
    deliveryType: CloudinaryDeliveryType = "upload",
    resourceType: "image" | "raw" = "image",
  ): Promise<{ success: boolean; result?: string }> {
    if (!publicId || !publicId.trim()) {
      return { success: true, result: "not_found" };
    }

    const status = getCloudinaryConfigStatus();
    if (!status.configured) {
      console.warn(`[Cloudinary Delete Warning] Skipping destroy for ${publicId}: ${status.reason}`);
      return { success: false, result: status.reason };
    }

    try {
      const res = await cloudinary.uploader.destroy(publicId, {
        type: deliveryType,
        resource_type: resourceType,
        invalidate: true, // Invalidate CDN cache
      });
      return {
        success: res.result === "ok" || res.result === "not found",
        result: res.result,
      };
    } catch (error: unknown) {
      const { message: errorMsg } = parseCloudinaryError(error);
      console.warn(`[Cloudinary Delete Warning] Could not destroy ${publicId}:`, errorMsg);
      return { success: false, result: errorMsg };
    }
  }

  /**
   * Retrieves asset information from Cloudinary.
   */
  async getImageInfo(publicId: string) {
    if (!publicId || !publicId.trim()) {
      throw new AppError({
        message: "Image public ID is required",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_PUBLIC_ID",
      });
    }

    this.ensureConfigured();

    try {
      const resource = await cloudinary.api.resource(publicId);
      return resource;
    } catch (error: unknown) {
      const { message: errorMsg, httpCode } = parseCloudinaryError(error);

      if (httpCode === 401 || errorMsg.includes("cloud_name mismatch")) {
        throw new AppError({
          message: `Cloudinary authentication/configuration failed: ${errorMsg}`,
          statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
          code: "CLOUDINARY_CONFIG_ERROR",
        });
      }

      throw new AppError({
        message: `Could not retrieve image info: ${errorMsg}`,
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "IMAGE_NOT_FOUND",
      });
    }
  }

  /**
   * Generates optimized Cloudinary transformation URLs:
   * - Product cards: 500x500
   * - Product details: 1000x1000
   * - Thumbnails: 150x150
   */
  generateOptimizedUrl(publicIdOrUrl: string, options: TransformationOptions = {}): string {
    if (!publicIdOrUrl) return "";

    // Keep non-Cloudinary external URLs, blob/data URLs, and local static paths untouched
    if (
      publicIdOrUrl.startsWith("blob:") ||
      publicIdOrUrl.startsWith("data:") ||
      publicIdOrUrl.startsWith("/") ||
      (publicIdOrUrl.startsWith("http") && !publicIdOrUrl.includes("res.cloudinary.com"))
    ) {
      return publicIdOrUrl;
    }

    const {
      width = 500,
      height = 500,
      crop = "fill",
      quality = "auto",
      format = "auto",
    } = options;

    // Extract publicId if a full Cloudinary URL was provided (stripping any existing transforms/version/ext)
    let publicId = publicIdOrUrl;
    const uploadMarker = "/upload/";
    const markerIdx = publicIdOrUrl.indexOf(uploadMarker);
    if (markerIdx !== -1) {
      let remainder = publicIdOrUrl.slice(markerIdx + uploadMarker.length);
      const segments = remainder.split("/").filter(Boolean);
      while (segments.length > 1) {
        const first = segments[0]!;
        const isTransform = /^(?:[a-z]{1,3}_[^/,]+)(?:,[a-z]{1,3}_[^/,]+)*$/.test(first);
        const isVersion = /^v\d+$/.test(first);
        if (isTransform || isVersion) {
          segments.shift();
        } else {
          break;
        }
      }
      remainder = segments.join("/");
      publicId = remainder.replace(/\.[a-zA-Z0-9]+$/, "");
    }

    return cloudinary.url(publicId, {
      transformation: [
        { width, height, crop },
        { quality, fetch_format: format },
      ],
      secure: true,
    });
  }
}

export const cloudinaryService = new CloudinaryService();
