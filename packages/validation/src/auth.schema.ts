import { z } from "zod";

export const googleOAuthIntentSchema = z.enum(["login", "register"]).default("login");

export function isSafeRedirectPath(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\");
}

export const googleOAuthStartQuerySchema = z.object({
  intent: googleOAuthIntentSchema.optional(),
  from: z.string().trim().max(500).optional(),
  redirectTo: z.string().trim().max(500).optional(),
  origin: z.string().url().optional(),
});

export type GoogleOAuthStartQuery = z.infer<typeof googleOAuthStartQuerySchema>;

export const googleOAuthStatePayloadSchema = z.object({
  nonce: z.string().min(16),
  intent: googleOAuthIntentSchema,
  from: z.string().optional(),
  frontendOrigin: z.string().url(),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type GoogleOAuthStatePayload = z.infer<typeof googleOAuthStatePayloadSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional().default(""),
    newPassword: z.string().min(8, "New password must be at least 8 characters long"),
  });

export const googleOneTapCredentialSchema = z.object({
  credential: z.string().trim().min(20, "Google credential token is required"),
  g_csrf_token: z.string().trim().optional(),
  intent: googleOAuthIntentSchema.optional(),
});

export type GoogleOneTapCredentialInput = z.infer<typeof googleOneTapCredentialSchema>;


