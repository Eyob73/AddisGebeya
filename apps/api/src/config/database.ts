import { PrismaClient } from "@prisma/client";
import type { DatabaseHealthState } from "@addisgebeya/types";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDevelopment ? ["warn", "error"] : ["error"],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

export interface DatabaseCheckResult {
  status: DatabaseHealthState;
  latencyMs?: number;
}

export async function verifyDatabaseConnection(): Promise<DatabaseCheckResult> {
  if (!env.databaseUrl) {
    return { status: "not_configured" };
  }

  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "connected",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    logger.warn("Database connectivity check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "disconnected" };
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!env.databaseUrl) {
    return;
  }

  await prisma.$disconnect();
}
