import { z } from "zod";

const SHOE_GENDERS = ["Men", "Women", "Unisex", "Kids"] as const;

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

export const productColorwaySchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Color name is required"),
  hex: z.string().trim().regex(hexColorRegex, "Primary color must be a valid 6-digit hex code"),
  secondaryHex: z
    .string()
    .trim()
    .regex(hexColorRegex, "Accent color must be a valid 6-digit hex code")
    .optional()
    .nullable()
    .or(z.literal("")),
  soleHex: z
    .string()
    .trim()
    .regex(hexColorRegex, "Sole color must be a valid 6-digit hex code")
    .optional()
    .nullable()
    .or(z.literal("")),
  images: z.array(z.string()).default([]),
  stockBySize: z
    .record(z.string(), z.coerce.number().int().min(0, "Stock cannot be negative"))
    .refine((obj) => Object.keys(obj).length > 0, {
      message: "At least one EU size is required per colorway",
    }),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
});

export const createProductSchema = z
  .object({
    id: z.string().trim().optional().nullable(),
    slug: z.string().trim().optional().nullable(),
    sku: z.string().trim().optional().nullable(),
    name: z.string().trim().min(2, "Shoe model name must be at least 2 characters"),
    brand: z.string().trim().min(1, "Brand is required").default("AddisGebeya"),
    categoryId: z.string().trim().optional().nullable(),
    categorySlug: z.string().trim().optional().nullable(),
    categoryName: z.string().trim().optional().nullable(),
    gender: z.enum(SHOE_GENDERS).default("Unisex"),
    shoeType: z.string().trim().min(1, "Shoe type is required").default("Sneakers"),
    material: z.string().trim().optional().nullable().default(""),
    tagline: z.string().trim().optional().nullable().default(""),
    description: z.string().trim().optional().nullable().default(""),
    priceETB: z.coerce.number().positive("Price must be greater than 0"),
    compareAtPriceETB: z.coerce.number().min(0).optional().nullable(),
    cogsETB: z.coerce.number().min(0).optional().nullable(),
    status: z.enum(["active", "draft", "archived"]).default("active"),
    badges: z.array(z.string()).optional().nullable(),
    featuredTrending: z.boolean().optional(),
    featuredNewDrop: z.boolean().optional(),
    isOnSale: z.boolean().optional(),
    freeAddisDelivery: z.boolean().optional(),
    reserveShowroomPairs: z.boolean().optional(),
    dispatchDepot: z.string().trim().optional().nullable(),
    specs: z.record(z.string(), z.unknown()).optional().nullable(),
    colorways: z.array(productColorwaySchema).min(1, "At least one colorway is required"),
  })
  .passthrough()
  .refine(
    (data) =>
      !data.compareAtPriceETB ||
      data.compareAtPriceETB === 0 ||
      data.compareAtPriceETB >= data.priceETB,
    {
      message: "Original / compare-at price must be greater than or equal to the selling price",
      path: ["compareAtPriceETB"],
    },
  );

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2, "Shoe model name must be at least 2 characters").optional(),
    sku: z.string().trim().min(1).optional(),
    brand: z.string().trim().min(1).optional(),
    categoryId: z.string().trim().optional(),
    categorySlug: z.string().trim().optional(),
    gender: z.enum(SHOE_GENDERS).optional(),
    shoeType: z.string().trim().min(1).optional(),
    material: z.string().trim().optional().nullable(),
    tagline: z.string().trim().optional(),
    description: z.string().trim().optional(),
    priceETB: z.coerce.number().positive("Price must be greater than 0").optional(),
    compareAtPriceETB: z.coerce.number().min(0).optional().nullable(),
    cogsETB: z.coerce.number().min(0).optional().nullable(),
    status: z.enum(["active", "draft", "archived"]).optional(),
    badges: z.array(z.string()).optional(),
    featuredTrending: z.boolean().optional(),
    featuredNewDrop: z.boolean().optional(),
    isOnSale: z.boolean().optional(),
    freeAddisDelivery: z.boolean().optional(),
    reserveShowroomPairs: z.boolean().optional(),
    dispatchDepot: z.string().trim().optional(),
    specs: z.record(z.string(), z.unknown()).optional(),
    colorways: z.array(productColorwaySchema).min(1).optional(),
  })
  .passthrough();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
