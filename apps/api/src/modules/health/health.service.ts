import { env } from "../../config/env.js";
import { toHealthResponseDto } from "./health.mapper.js";
import { healthRepository, type HealthRepository } from "./health.repository.js";
import type { HealthResponseDto } from "./health.types.js";

export class HealthService {
  constructor(private readonly repository: HealthRepository) {}

  async getHealthStatus(): Promise<HealthResponseDto> {
    const database = await this.repository.checkDatabase();

    return toHealthResponseDto({
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database,
    });
  }
}

export const healthService = new HealthService(healthRepository);
