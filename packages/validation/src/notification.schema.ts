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

