import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional().default(""),
  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("[env] Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;

if (data.NODE_ENV === "production") {
  if (!data.DATABASE_URL || !data.JWT_ACCESS_SECRET || !data.JWT_REFRESH_SECRET) {
    console.error(
      "[env] DATABASE_URL, JWT_ACCESS_SECRET, and JWT_REFRESH_SECRET are required in production.",
    );
    process.exit(1);
  }
}

export const env = Object.freeze({
  port: data.PORT,
  nodeEnv: data.NODE_ENV,
  isProduction: data.NODE_ENV === "production",
  isDevelopment: data.NODE_ENV === "development",
  frontendUrl: data.FRONTEND_URL,
  databaseUrl: data.DATABASE_URL,
  jwtAccessSecret: data.JWT_ACCESS_SECRET ?? "",
  jwtRefreshSecret: data.JWT_REFRESH_SECRET ?? "",
});

export type AppEnv = typeof env;
