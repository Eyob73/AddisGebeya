import type { CorsOptions } from "cors";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { AppError } from "../utils/app-error.js";
import { env } from "./env.js";

export function getAllowedOrigins(): string[] {
  return env.frontendUrl
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    const normalizedOrigin = origin?.trim().replace(/\/+$/, "");
    if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
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
