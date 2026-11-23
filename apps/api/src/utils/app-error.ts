import type { ApiErrorDetail } from "@addisgebeya/types";
import { HTTP_STATUS, type HttpStatusCode } from "@addisgebeya/shared";

export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly errors?: ApiErrorDetail[];

  constructor(options: {
    message: string;
    statusCode?: HttpStatusCode;
    code?: string;
    errors?: ApiErrorDetail[];
    isOperational?: boolean;
  }) {
    super(options.message);
    this.name = "AppError";
    this.statusCode = options.statusCode ?? HTTP_STATUS.INTERNAL_SERVER_ERROR;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.errors = options.errors;
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace(this, this.constructor);
  }
}
