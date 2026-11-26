import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BACKEND_URL: z.string().url().optional().or(z.literal("")).default(""),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional().default(""),
  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_CALLBACK_URL: z.string().url().optional().or(z.literal("")).default(""),
  GOOGLE_OAUTH_REDIRECT_URL_DEV: z.string().url().optional().or(z.literal("")).default(""),
  GOOGLE_OAUTH_REDIRECT_URL_PROD: z.string().url().optional().or(z.literal("")).default(""),
  CLOUDINARY_URL: z.string().optional().default(""),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  CHEKI_API_BASE_URL: z.string().url().default("https://cheki.et"),
  CHEKI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(65000),
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

const resolvedBackendUrl = (data.BACKEND_URL || `http://localhost:${data.PORT}`).replace(/\/+$/, "");

export const env = Object.freeze({
  port: data.PORT,
  nodeEnv: data.NODE_ENV,
  isProduction: data.NODE_ENV === "production",
  isDevelopment: data.NODE_ENV === "development",
  backendUrl: resolvedBackendUrl,
  frontendUrl: data.FRONTEND_URL,
  databaseUrl: data.DATABASE_URL,
  jwtAccessSecret: data.JWT_ACCESS_SECRET ?? "",
  jwtRefreshSecret: data.JWT_REFRESH_SECRET ?? "",
  googleClientId: data.GOOGLE_CLIENT_ID.trim(),
  googleClientSecret: data.GOOGLE_CLIENT_SECRET.trim(),
  googleCallbackUrl: (data.GOOGLE_CALLBACK_URL || `${resolvedBackendUrl}/api/auth/google/callback`).trim(),
  googleOAuthRedirectUrlDev: data.GOOGLE_OAUTH_REDIRECT_URL_DEV.trim(),
  googleOAuthRedirectUrlProd: data.GOOGLE_OAUTH_REDIRECT_URL_PROD.trim(),
  cloudinaryUrl: data.CLOUDINARY_URL,
  cloudinaryCloudName: data.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: data.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: data.CLOUDINARY_API_SECRET,
  chekiApiBaseUrl: data.CHEKI_API_BASE_URL.replace(/\/+$/, ""),
  chekiTimeoutMs: data.CHEKI_TIMEOUT_MS,
});

export type AppEnv = typeof env;
