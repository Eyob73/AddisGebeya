import type { HealthCheckData } from "@addisgebeya/types";
import { apiClient } from "@/lib/api-client";

export const healthService = {
  getStatus(): Promise<HealthCheckData> {
    return apiClient.get<HealthCheckData>("/health", { cache: "no-store" });
  },
};
