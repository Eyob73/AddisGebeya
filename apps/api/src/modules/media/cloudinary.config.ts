import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ENV_PATH = path.resolve(__dirname, "../../../.env");

function parseCloudinaryUrl(url: string): {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
} {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "cloudinary:") return {};
    return {
      cloudName: parsed.hostname || undefined,
      apiKey: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      apiSecret: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    };
  } catch {
    return {};
  }
}

function applyCloudinaryConfigFromEnv(): void {
  const fromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL || env.cloudinaryUrl || "");
  const cloudName = (
    process.env.CLOUDINARY_CLOUD_NAME ||
    env.cloudinaryCloudName ||
    fromUrl.cloudName ||
    ""
  ).trim();
  const apiKey = (
    process.env.CLOUDINARY_API_KEY ||
    env.cloudinaryApiKey ||
    fromUrl.apiKey ||
    ""
  ).trim();
  const apiSecret = (
    process.env.CLOUDINARY_API_SECRET ||
    env.cloudinaryApiSecret ||
    fromUrl.apiSecret ||
    ""
  ).trim();

  // Configure official Cloudinary v2 SDK
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true, // Always enforce HTTPS delivery
  });
}

applyCloudinaryConfigFromEnv();

export function getCloudinaryConfigStatus(): {
  configured: boolean;
  reason?: string;
} {
  let cfg = cloudinary.config();
  if (!cfg.cloud_name || cfg.cloud_name === "Root" || !cfg.api_key || !cfg.api_secret) {
    // Re-read apps/api/.env in case credentials were updated while the dev server is running
    dotenv.config({ path: API_ENV_PATH, override: true });
    applyCloudinaryConfigFromEnv();
    cfg = cloudinary.config();
  }

  if (!cfg.cloud_name || cfg.cloud_name === "Root") {
    return {
      configured: false,
      reason:
        cfg.cloud_name === "Root"
          ? 'CLOUDINARY_CLOUD_NAME is set to "Root" (the Cloudinary environment label), not your actual Cloud Name.'
          : "CLOUDINARY_CLOUD_NAME is missing.",
    };
  }
  if (!cfg.api_key || !cfg.api_secret) {
    return {
      configured: false,
      reason: "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required.",
    };
  }
  return { configured: true };
}

export { cloudinary };
