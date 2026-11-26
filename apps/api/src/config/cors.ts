import type { CorsOptions } from "cors";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { AppError } from "../utils/app-error.js";
import { env } from "./env.js";

/** Normalizes an HTTP origin by trimming, removing trailing slashes/paths, and lowercasing. */
export function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function getAllowedOrigins(): string[] {
  const raw = process.env.FRONTEND_URL ?? env.frontendUrl;
  return raw
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

/** Checks whether an incoming request origin is permitted by the configured CORS allowlist. */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return true;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes("*") || allowedOrigins.includes(normalizedOrigin);
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    callback(
      new AppError({
        message: `Origin ${origin} is not allowed by CORS policy`,
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "CORS_ORIGIN_NOT_ALLOWED",
      }),
    );
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-guest-id"],
};
