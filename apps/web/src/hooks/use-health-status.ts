"use client";

import { useQuery } from "@tanstack/react-query";
import { healthService } from "@/services/health.service";

export const healthQueryKeys = {
  all: ["health"] as const,
};

export function useHealthStatus() {
  return useQuery({
    queryKey: healthQueryKeys.all,
    queryFn: () => healthService.getStatus(),
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
