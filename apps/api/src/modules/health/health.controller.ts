import type { Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { sendSuccess } from "../../utils/api-response.js";
import { healthService } from "./health.service.js";

export class HealthController {
  async getHealth(_req: Request, res: Response): Promise<Response> {
    const health = await healthService.getHealthStatus();
    return sendSuccess(res, health, "Service health status retrieved", HTTP_STATUS.OK);
  }
}

export const healthController = new HealthController();
