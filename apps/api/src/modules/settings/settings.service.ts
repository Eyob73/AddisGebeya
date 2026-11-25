import { HTTP_STATUS } from "@addisgebeya/shared";
import { z } from "zod";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";
import { cloudinaryService } from "../media/cloudinary.service.js";

export interface UpdateSettingsPatch {
  storeName?: string;
  tagline?: string;
  showroomAddress?: string;
  phone?: string;
  whatsapp?: string;
  telegramHandle?: string;
  email?: string;
  showroomHours?: string;
  freeDeliveryThresholdETB?: number;
  standardAddisDeliveryFeeETB?: number;
  vipTwoHourDeliveryFeeETB?: number;
  regionalCargoFeeETB?: number;
  vatPercent?: number;
  paymentMethods?: Record<string, boolean>;
  announcementBarText?: string;
  dispatchRibbonText?: string;
  heroImageUrl?: string | null;
  heroBadgeText?: string;
  heroCardSubtitle?: string;
  heroCardTitle?: string;
  heroCardPriceText?: string;
  heroCardHref?: string;
}

function isSafeHeroUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.startsWith("/")) return !trimmed.startsWith("//");
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const updateSettingsSchema = z.object({
  storeName: z.string().trim().min(1).max(120).optional(),
  tagline: z.string().trim().min(1).max(200).optional(),
  showroomAddress: z.string().trim().min(1).max(240).optional(),
  phone: z.string().trim().min(1).max(60).optional(),
  whatsapp: z.string().trim().min(1).max(60).optional(),
  telegramHandle: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().min(1).max(160).optional(),
  showroomHours: z.string().trim().min(1).max(160).optional(),
  freeDeliveryThresholdETB: z.coerce.number().min(0).optional(),
  standardAddisDeliveryFeeETB: z.coerce.number().min(0).optional(),
  vipTwoHourDeliveryFeeETB: z.coerce.number().min(0).optional(),
  regionalCargoFeeETB: z.coerce.number().min(0).optional(),
  vatPercent: z.coerce.number().min(0).max(100).optional(),
  paymentMethods: z.record(z.string(), z.boolean()).optional(),
  announcementBarText: z.string().trim().min(1).max(300).optional(),
  dispatchRibbonText: z.string().trim().min(1).max(300).optional(),
  heroImageUrl: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || isSafeHeroUrl(v), {
      message: "Hero image URL must use https://, http://, or a relative / path.",
    }),
  heroBadgeText: z.string().trim().min(1, "Badge text is required").max(80).optional(),
  heroCardSubtitle: z.string().trim().min(1, "Subtitle text is required").max(100).optional(),
  heroCardTitle: z.string().trim().min(1, "Title text is required").max(120).optional(),
  heroCardPriceText: z.string().trim().min(1, "Price text is required").max(60).optional(),
  heroCardHref: z
    .string()
    .trim()
    .min(1, "Link path is required")
    .max(300)
    .refine(isSafeHeroUrl, {
      message: "Card link must start with / or https://.",
    })
    .optional(),
});

export class SettingsService {
  async getSettings() {
    let settings = await prisma.storeSetting.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await prisma.storeSetting.create({
        data: { id: "default" },
      });
    }

    const paymentMethods =
      settings.paymentMethods && typeof settings.paymentMethods === "object"
        ? (settings.paymentMethods as Record<string, boolean>)
        : { telebirr: true, cbeBirr: true, bankTransfer: true, cod: true };

    return {
      storeName: settings.storeName,
      tagline: settings.tagline,
      showroomAddress: settings.showroomAddress,
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      telegramHandle: settings.telegramHandle,
      email: settings.email,
      showroomHours: settings.showroomHours,
      freeDeliveryThresholdETB: Number(settings.freeDeliveryThresholdETB),
      standardAddisDeliveryFeeETB: Number(settings.standardAddisDeliveryFeeETB),
      vipTwoHourDeliveryFeeETB: Number(settings.vipTwoHourDeliveryFeeETB),
      regionalCargoFeeETB: Number(settings.regionalCargoFeeETB),
      vatPercent: Number(settings.vatPercent),
      paymentMethods,
      announcementBarText: settings.announcementBarText,
      dispatchRibbonText: settings.dispatchRibbonText,
      heroImageUrl: settings.heroImageUrl ?? null,
      heroBadgeText: settings.heroBadgeText,
      heroCardSubtitle: settings.heroCardSubtitle,
      heroCardTitle: settings.heroCardTitle,
      heroCardPriceText: settings.heroCardPriceText,
      heroCardHref: settings.heroCardHref,
    };
  }

  async updateSettings(rawPatch: unknown) {
    const parsed = updateSettingsSchema.safeParse(rawPatch);
    if (!parsed.success) {
      throw new AppError({
        message: parsed.error.issues[0]?.message || "Invalid store settings input.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_SETTINGS",
      });
    }

    const patch = parsed.data;
    const nextHeroImageUrl =
      patch.heroImageUrl === undefined
        ? undefined
        : patch.heroImageUrl === null || patch.heroImageUrl === ""
          ? null
          : patch.heroImageUrl;

    await prisma.storeSetting.upsert({
      where: { id: "default" },
      update: {
        storeName: patch.storeName,
        tagline: patch.tagline,
        showroomAddress: patch.showroomAddress,
        phone: patch.phone,
        whatsapp: patch.whatsapp,
        telegramHandle: patch.telegramHandle,
        email: patch.email,
        showroomHours: patch.showroomHours,
        freeDeliveryThresholdETB: patch.freeDeliveryThresholdETB,
        standardAddisDeliveryFeeETB: patch.standardAddisDeliveryFeeETB,
        vipTwoHourDeliveryFeeETB: patch.vipTwoHourDeliveryFeeETB,
        regionalCargoFeeETB: patch.regionalCargoFeeETB,
        vatPercent: patch.vatPercent,
        paymentMethods: patch.paymentMethods,
        announcementBarText: patch.announcementBarText,
        dispatchRibbonText: patch.dispatchRibbonText,
        heroImageUrl: nextHeroImageUrl,
        heroBadgeText: patch.heroBadgeText,
        heroCardSubtitle: patch.heroCardSubtitle,
        heroCardTitle: patch.heroCardTitle,
        heroCardPriceText: patch.heroCardPriceText,
        heroCardHref: patch.heroCardHref,
      },
      create: {
        id: "default",
        ...(patch.storeName ? { storeName: patch.storeName } : {}),
        ...(nextHeroImageUrl !== undefined ? { heroImageUrl: nextHeroImageUrl } : {}),
        ...(patch.heroBadgeText ? { heroBadgeText: patch.heroBadgeText } : {}),
        ...(patch.heroCardSubtitle ? { heroCardSubtitle: patch.heroCardSubtitle } : {}),
        ...(patch.heroCardTitle ? { heroCardTitle: patch.heroCardTitle } : {}),
        ...(patch.heroCardPriceText ? { heroCardPriceText: patch.heroCardPriceText } : {}),
        ...(patch.heroCardHref ? { heroCardHref: patch.heroCardHref } : {}),
      },
    });

    return this.getSettings();
  }

  async uploadHeroImage(file?: { buffer: Buffer; originalname: string }) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new AppError({
        message: "Please select an image file to upload.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "IMAGE_REQUIRED",
      });
    }

    const validation = cloudinaryService.validateImageBuffer(file.buffer);
    if (!validation.valid) {
      throw new AppError({
        message:
          validation.error ||
          "Invalid image file. Only genuine JPG, JPEG, PNG, and WebP images are accepted.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_IMAGE_FILE",
      });
    }

    const uploaded = await cloudinaryService.uploadSingle(file.buffer, {
      folder: "addisgebeya/banners",
      filenamePrefix: "hero_showcase",
      tags: ["addisgebeya", "hero-showcase"],
    });

    return { url: uploaded.secureUrl };
  }
}

export const settingsService = new SettingsService();
