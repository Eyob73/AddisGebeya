import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { reviewService } from "./review.service.js";

const strParam = (p: unknown): string => (Array.isArray(p) ? String(p[0] ?? "") : String(p ?? ""));

export const reviewController = {
  listAllReviews: asyncHandler(async (_req: Request, res: Response) => {
    const reviews = await reviewService.listAllReviews();
    sendSuccess(res, reviews, "All reviews retrieved");
  }),

  listReviews: asyncHandler(async (req: Request, res: Response) => {
    const productId = strParam(req.params.productId);
    const reviews = await reviewService.listProductReviews(productId);
    sendSuccess(res, reviews, "Reviews retrieved");
  }),

  addReview: asyncHandler(async (req: Request, res: Response) => {
    const review = await reviewService.addReview(req.body);
    sendSuccess(res, review, "Review added successfully", HTTP_STATUS.CREATED);
  }),

  markHelpful: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const updated = await reviewService.markHelpful(id);
    sendSuccess(res, updated, "Review marked as helpful");
  }),
};
