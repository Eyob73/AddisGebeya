import type { Server } from "node:http";
import { API_PREFIX, APP_NAME } from "@addisgebeya/shared";
import { createApp } from "./app.js";
import { disconnectDatabase, verifyDatabaseConnection } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

let server: Server | undefined;
let isShuttingDown = false;

async function bootstrap(): Promise<void> {
  const app = createApp();

  const dbCheck = await verifyDatabaseConnection();
  logger.info(
    `Database status: ${dbCheck.status}`,
    dbCheck.latencyMs !== undefined ? { latencyMs: dbCheck.latencyMs } : undefined,
  );

  server = app.listen(env.port, () => {
    logger.info(`${APP_NAME} API running on http://localhost:${env.port}${API_PREFIX}`, {
      environment: env.nodeEnv,
      frontendUrl: env.frontendUrl,
    });
  });
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    }

    await disconnectDatabase();
    logger.info("Graceful shutdown complete.");
    process.exit(0);
  } catch (error) {
    logger.error("Error during graceful shutdown", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
  });
  void shutdown("unhandledRejection");
});

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught exception", { error: error.stack ?? error.message });
  void shutdown("uncaughtException");
});

void bootstrap();
