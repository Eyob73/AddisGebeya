import { API_VERSION, APP_NAME } from "@addisgebeya/shared";
import type { HealthResponseDto, HealthSnapshot } from "./health.types.js";

export function toHealthResponseDto(snapshot: HealthSnapshot): HealthResponseDto {
  const isHealthy = snapshot.database.status !== "disconnected";

  return {
    status: isHealthy ? "ok" : "degraded",
    service: `${APP_NAME} API`,
    version: API_VERSION,
    environment: snapshot.environment,
    uptimeSeconds: snapshot.uptimeSeconds,
    timestamp: snapshot.timestamp,
    database: snapshot.database,
  };
}
