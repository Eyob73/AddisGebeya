export type ServiceHealthState = "ok" | "degraded";

export type DatabaseHealthState = "connected" | "disconnected" | "not_configured";

export interface HealthCheckData {
  status: ServiceHealthState;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  database: {
    status: DatabaseHealthState;
    latencyMs?: number;
  };
}
