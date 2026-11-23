import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:5000/api/v1"),
});

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

export const clientEnv = {
  apiUrl: parsed.success ? parsed.data.NEXT_PUBLIC_API_URL : "http://localhost:5000/api/v1",
} as const;
