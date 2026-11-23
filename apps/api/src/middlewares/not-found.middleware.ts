import type { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { AppError } from "../utils/app-error.js";

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(
    new AppError({
      message: `Route ${req.method} ${req.originalUrl} not found`,
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: "ROUTE_NOT_FOUND",
    }),
  );
}
