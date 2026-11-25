/**
 * AddisGebeya Cloudinary Image Transformation & Optimization Utilities
 */

export const DEFAULT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80";

export interface CloudinaryTransformOptions {
  width?: number;
  height?: number;
  crop?: "fill" | "scale" | "fit" | "thumb" | "limit";
  quality?: "auto" | number;
  format?: "auto" | "webp" | "jpg" | "png";
}

/**
 * Injects on-the-fly Cloudinary transformations for automatic format,
 * auto quality, and precise responsive dimensions.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  options: CloudinaryTransformOptions = {},
): string {
  if (!url) return DEFAULT_FALLBACK_IMAGE;

  // Only transform Cloudinary URLs
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }

  const {
    width = 500,
    height = 500,
    crop = "fill",
    quality = "auto",
    format = "auto",
  } = options;

  const transformParts = [
    `c_${crop}`,
    `w_${width}`,
    `h_${height}`,
    `q_${quality}`,
    `f_${format}`,
  ].join(",");

  // Cloudinary standard upload pattern: .../upload/(<existing-transforms>/)?(v<version>/)?...
  // Replace existing transformation segment if present, otherwise insert right after "/upload/"
  const uploadMarker = "/upload/";
  const idx = url.indexOf(uploadMarker);
  if (idx === -1) return url;

  const prefix = url.slice(0, idx + uploadMarker.length);
  const rest = url.slice(idx + uploadMarker.length);
  const segments = rest.split("/");
  const firstSegment = segments[0] ?? "";
  const hasExistingTransforms = /^(?:[a-z]{1,3}_[^/,]+)(?:,[a-z]{1,3}_[^/,]+)*$/.test(firstSegment);

  if (hasExistingTransforms) {
    segments[0] = transformParts;
    return `${prefix}${segments.join("/")}`;
  }

  return `${prefix}${transformParts}/${rest}`;
}

/**
 * 500x500 optimized delivery for catalog grids and product cards.
 */
export function getCardImageUrl(url: string | null | undefined): string {
  return getOptimizedImageUrl(url, { width: 500, height: 500, crop: "fill" });
}

/**
 * 1000x1000 high-res delivery for product detail galleries.
 */
export function getDetailImageUrl(url: string | null | undefined): string {
  return getOptimizedImageUrl(url, { width: 1000, height: 1000, crop: "fill" });
}

/**
 * 150x150 thumbnail delivery for cart, checkout, and gallery thumbs.
 */
export function getThumbnailImageUrl(url: string | null | undefined): string {
  return getOptimizedImageUrl(url, { width: 150, height: 150, crop: "fill" });
}

