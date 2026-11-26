import { z } from "zod";

export const mergeCartItemSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  colorwayId: z.string().trim().min(1, "Colorway ID is required"),
  size: z.coerce.number().int().min(20).max(55),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
});

export const mergeCartRequestSchema = z.object({
  items: z.array(mergeCartItemSchema).max(100).optional().default([]),
});

export type MergeCartItemInput = z.infer<typeof mergeCartItemSchema>;
export type MergeCartRequestInput = z.infer<typeof mergeCartRequestSchema>;

export const guestTrackOrderSchema = z.object({
  orderNumber: z.string().trim().min(3, "Order number is required").max(40),
  email: z.string().trim().email("Enter the email address used for the order"),
});

export type GuestTrackOrderInput = z.infer<typeof guestTrackOrderSchema>;

