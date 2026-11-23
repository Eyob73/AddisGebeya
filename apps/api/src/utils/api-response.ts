import type { Response } from "express";
import type { ApiSuccessResponse } from "@addisgebeya/types";
import { HTTP_STATUS, type HttpStatusCode } from "@addisgebeya/shared";

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode: HttpStatusCode = HTTP_STATUS.OK,
): Response<ApiSuccessResponse<T>> {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(payload);
}
