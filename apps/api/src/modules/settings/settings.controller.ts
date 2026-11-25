import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { settingsService } from "./settings.service.js";

export const settingsController = {
  getSettings: asyncHandler(async (_req: Request, res: Response) => {
    const settings = await settingsService.getSettings();
    sendSuccess(res, settings, "Store settings retrieved");
  }),

  updateSettings: asyncHandler(async (req: Request, res: Response) => {
    const settings = await settingsService.updateSettings(req.body);
    sendSuccess(res, settings, "Store settings updated");
  }),

  uploadHeroImage: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file
      ? { buffer: req.file.buffer, originalname: req.file.originalname }
      : undefined;
    const result = await settingsService.uploadHeroImage(file);
    sendSuccess(res, result, "Homepage hero image uploaded");
  }),
};
