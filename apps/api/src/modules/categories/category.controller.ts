import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { categoryService } from "./category.service.js";

const strParam = (p: unknown): string => (Array.isArray(p) ? String(p[0] ?? "") : String(p ?? ""));

export const categoryController = {
  listCategories: asyncHandler(async (_req: Request, res: Response) => {
    const categories = await categoryService.listCategories();
    sendSuccess(res, categories, "Categories retrieved successfully");
  }),

  getCategoryBySlug: asyncHandler(async (req: Request, res: Response) => {
    const slug = strParam(req.params.slug);
    const category = await categoryService.getCategoryBySlug(slug);
    sendSuccess(res, category, "Category retrieved successfully");
  }),

  createCategory: asyncHandler(async (req: Request, res: Response) => {
    const created = await categoryService.createCategory(req.body);
    sendSuccess(res, created, "Category created successfully", HTTP_STATUS.CREATED);
  }),

  updateCategory: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const updated = await categoryService.updateCategory(id, req.body);
    sendSuccess(res, updated, "Category updated successfully");
  }),

  deleteCategory: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const result = await categoryService.deleteCategory(id);
    sendSuccess(res, result, "Category deleted successfully");
  }),
};
