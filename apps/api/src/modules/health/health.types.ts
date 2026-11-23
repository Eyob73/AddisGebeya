import type { DatabaseHealthState, HealthCheckData } from "@addisgebeya/types";

export interface HealthSnapshot {
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  database: {
    status: DatabaseHealthState;
    latencyMs?: number;
  };
}

export type HealthResponseDto = HealthCheckData;
