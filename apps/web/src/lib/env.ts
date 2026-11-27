import type { GoogleOAuthIntent } from "@addisgebeya/types";
import { isSafeRedirectPath } from "@addisgebeya/validation";
import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:5000/api/v1"),
  NEXT_PUBLIC_SOCKET_URL: z.string().url().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional().default(""),
});

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || undefined,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
});

const apiUrl = parsed.success ? parsed.data.NEXT_PUBLIC_API_URL : "http://localhost:5000/api/v1";

function deriveSocketOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "http://localhost:5000";
  }
}

function deriveAuthApiBase(url: string): string {
  return url.replace(/\/+$/, "").replace(/\/v1$/i, "");
}

export function buildGoogleOAuthUrl(options?: {
  intent?: GoogleOAuthIntent;
  from?: string | null;
}): string {
  const target = new URL(`${deriveAuthApiBase(apiUrl)}/auth/google`);
  if (options?.intent) {
    target.searchParams.set("intent", options.intent);
  }
  if (options?.from && isSafeRedirectPath(options.from)) {
    target.searchParams.set("from", options.from);
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    target.searchParams.set("origin", window.location.origin);
  }
  return target.toString();
}

export const clientEnv = {
  apiUrl,
  socketUrl:
    parsed.success && parsed.data.NEXT_PUBLIC_SOCKET_URL
      ? parsed.data.NEXT_PUBLIC_SOCKET_URL
      : deriveSocketOrigin(apiUrl),
  vapidPublicKey: parsed.success ? parsed.data.NEXT_PUBLIC_VAPID_PUBLIC_KEY.trim() : "",
} as const;
