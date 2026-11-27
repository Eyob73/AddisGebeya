import { z } from "zod";

export const notificationIdParamSchema = z.object({
  id: z.string().trim().min(1, "Notification ID is required").max(128, "Invalid notification ID"),
});

export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z
    .enum(["all", "true", "false"])
    .optional()
    .default("all"),
  type: z.string().trim().max(64).optional(),
  search: z.string().trim().max(120).optional(),
  since: z
    .string()
    .trim()
    .refine((val) => !Number.isNaN(Date.parse(val)), "Invalid 'since' ISO timestamp")
    .optional(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const adminDispatchNotificationSchema = z
  .object({
    userId: z.string().trim().min(1).max(128).optional(),
    title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
    message: z.string().trim().min(1, "Message is required").max(2000, "Message is too long"),
    type: z.string().trim().min(1).max(64).optional().default("announcement"),
    relatedEntityId: z.string().trim().max(128).nullable().optional(),
    relatedEntityType: z
      .enum(["order", "payment", "product", "customer", "system"])
      .nullable()
      .optional(),
    broadcast: z.boolean().optional().default(false),
  })
  .refine((data) => data.broadcast || Boolean(data.userId), {
    message: "userId is required unless broadcast is true",
    path: ["userId"],
  });

export type AdminDispatchNotificationInput = z.infer<typeof adminDispatchNotificationSchema>;

export const pushSubscriptionKeysSchema = z.object({
  p256dh: z
    .string()
    .trim()
    .min(16, "Invalid push encryption public key")
    .max(512, "Push public key is too long"),
  auth: z
    .string()
    .trim()
    .min(8, "Invalid push authentication secret")
    .max(256, "Push auth secret is too long"),
});

export const subscribePushNotificationSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .url("Valid push endpoint URL is required")
    .max(2048, "Push endpoint URL is too long")
    .refine((val) => /^https:\/\//i.test(val), {
      message: "Push subscription endpoint must use HTTPS",
    }),
  keys: pushSubscriptionKeysSchema,
  userAgent: z.string().trim().max(512).optional(),
});

export const unsubscribePushNotificationSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .url("Valid push endpoint URL is required")
    .max(2048)
    .optional(),
  all: z.boolean().optional().default(false),
});

export const pushStatusQuerySchema = z.object({
  endpoint: z.string().trim().url().max(2048).optional(),
});

export const updatePushPreferencesSchema = z.object({
  pushEnabled: z.boolean(),
});

export type SubscribePushNotificationInput = z.infer<typeof subscribePushNotificationSchema>;
export type UnsubscribePushNotificationInput = z.input<typeof unsubscribePushNotificationSchema>;
export type PushStatusQuery = z.infer<typeof pushStatusQuerySchema>;
export type UpdatePushPreferencesInput = z.infer<typeof updatePushPreferencesSchema>;

