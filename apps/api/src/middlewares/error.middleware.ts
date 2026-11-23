import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import type { ApiErrorResponse } from "@addisgebeya/types";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response<ApiErrorResponse> {
  if (err instanceof ZodError) {
    const response: ApiErrorResponse = {
      success: false,
      message: "Request validation failed",
      code: "VALIDATION_ERROR",
      errors: err.issues.map((issue) => ({
        field: issue.path.join(".") || undefined,
        message: issue.message,
      })),
      timestamp: new Date().toISOString(),
    };
    return res.status(HTTP_STATUS.BAD_REQUEST).json(response);
  }

  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      success: false,
      message: err.message,
      code: err.code,
      errors: err.errors,
      timestamp: new Date().toISOString(),
    };
    return res.status(err.statusCode).json(response);
  }

  logger.error("Unhandled application error", {
    error: err instanceof Error ? (err.stack ?? err.message) : String(err),
  });

  const response: ApiErrorResponse = {
    success: false,
    message: env.isProduction
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
    timestamp: new Date().toISOString(),
  };

  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
}
