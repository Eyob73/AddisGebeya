"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bookmark,
  Camera,
  Check,
  Edit3,
  Heart,
  Layers,
  Loader2,
  MapPin,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Rocket,
  Ruler,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { AdminProductFormSkeleton } from "@/components/shared/page-skeletons";
import { useIsMounted } from "@/hooks/use-is-mounted";
import {
  ADULT_EU_SIZES,
  EU_SIZES,
  KIDS_EU_SIZES,
} from "@/data/mock-footwear";
import { useCategoriesQuery } from "@/hooks/use-store-queries";
import { useQueryClient } from "@tanstack/react-query";
import { storeService } from "@/services/store.service";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import {
  SHOE_GENDERS,
  SHOE_TYPES,
  type GenderCategory,
  type ProductStatus,
  type ShoeColorway,
  type ShoeProduct,
} from "@/types/store.types";
import { calculateDiscountPercent, formatETBPrefix, slugify } from "@/utils/format";
import { cn } from "@/lib/utils";
import {
  linkProductImageColorway,
  ProductImageUploader,
  type ManagedImageItem,
} from "./product-image-uploader";

const MATERIAL_TAGS = [
  "Full-grain Ethiopian Cowhide",
  "Jacquard Breathable Mesh",
  "Nitrogen-infused EVA Foam",
  "Vibram Rubber Lugs",
  "Recycled Poly Laces",
  "Vegetable-Tanned Insole",
  "Suede Overlays",
  "Carbon Fiber Plate",
];

const BRAND_SUGGESTIONS = [
  "Addis Performance Lab",
  "Bole Heritage Series",
  "Abyssinia Luxury Leather",
  "Entoto Trail Lab",
  "Daily Flight",
  "AddisGebeya Athletics",
];

const COLORWAY_PRESETS = [
  { name: "Midnight Cobalt", hex: "#14284B", secondaryHex: "#93C5FD", soleHex: "#F8F9FB" },
  { name: "Terracotta Clay", hex: "#D4441A", secondaryHex: "#1E293B", soleHex: "#F1F5F9" },
  { name: "Obsidian Matte", hex: "#0F172A", secondaryHex: "#475569", soleHex: "#E2E8F0" },
  { name: "Highland Sand", hex: "#C8A986", secondaryHex: "#5C4033", soleHex: "#FAF8F5" },
  { name: "Cloud White / Navy", hex: "#F8FAFC", secondaryHex: "#14284B", soleHex: "#CBD5E1" },
];

const BELL_CURVE_WEIGHTS: Record<number, number> = {
  36: 2,
  37: 2,
  38: 2,
  39: 3,
  40: 4,
  41: 5,
  42: 5,
  43: 4,
  44: 3,
  45: 2,
  46: 1,
};

interface ColorwayDraft {
  id: string;
  name: string;
  hex: string;
  secondaryHex: string;
  soleHex: string;
  lowStockThreshold: number;
  stockBySize: Record<number, number>;
}

interface ProductFormViewProps {
  existingProduct?: ShoeProduct;
}

function buildInitialSizes(product?: ShoeProduct): number[] {
  if (product && product.colorways.length > 0) {
    const sizeSet = new Set<number>();
    for (const cw of product.colorways) {
      for (const sizeKey of Object.keys(cw.stockBySize)) {
        const parsed = Number(sizeKey);
        if (Number.isFinite(parsed) && parsed > 0) {
          sizeSet.add(parsed);
        }
      }
    }
    if (sizeSet.size > 0) {
      return Array.from(sizeSet).sort((a, b) => a - b);
    }
  }
  return [...EU_SIZES];
}

function buildInitialColorways(product: ShoeProduct | undefined, sizes: number[]): ColorwayDraft[] {
  if (product && product.colorways.length > 0) {
    return product.colorways.map((cw) => {
      const normalizedStock: Record<number, number> = {};
      for (const sz of sizes) {
        normalizedStock[sz] = Math.max(0, Number(cw.stockBySize[sz] ?? 0));
      }
      return {
        id: cw.id,
        name: cw.name,
        hex: cw.hex || "#14284B",
        secondaryHex: cw.secondaryHex || "#FFFFFF",
        soleHex: cw.soleHex || "#F1F5F9",
        lowStockThreshold: cw.lowStockThreshold ?? 2,
        stockBySize: normalizedStock,
      };
    });
  }

  return [
    {
      id: `cw-${Date.now()}-0`,
      name: "Midnight Cobalt",
      hex: "#14284B",
      secondaryHex: "#93C5FD",
      soleHex: "#F8F9FB",
      lowStockThreshold: 2,
      stockBySize: Object.fromEntries(sizes.map((sz) => [sz, 0])),
    },
  ];
}

export function ProductFormView({ existingProduct }: ProductFormViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategoriesQuery();
  const addToast = useUiStore((s) => s.addToast);
  const isEditing = Boolean(existingProduct);
  const isMounted = useIsMounted();
  const [isSaving, setIsSaving] = React.useState(false);

  const initialSizes = React.useMemo(() => buildInitialSizes(existingProduct), [existingProduct]);

  const [name, setName] = React.useState(existingProduct?.name ?? "");
  const [sku, setSku] = React.useState(existingProduct?.sku ?? "");
  const [categorySlug, setCategorySlug] = React.useState(existingProduct?.categorySlug ?? "");
  const [gender, setGender] = React.useState<GenderCategory | "">(existingProduct?.gender ?? "");
  const [shoeType, setShoeType] = React.useState<string>(existingProduct?.shoeType ?? "Sneakers");
  const [brand, setBrand] = React.useState(existingProduct?.brand ?? "");
  const [tagline, setTagline] = React.useState(existingProduct?.tagline ?? "");
  const [description, setDescription] = React.useState(existingProduct?.description ?? "");
  const [materialSummary, setMaterialSummary] = React.useState(
    existingProduct?.material || existingProduct?.specs.materials?.join(", ") || "",
  );
  const [materials, setMaterials] = React.useState<string[]>(existingProduct?.specs.materials ?? []);

  const [euSizes, setEuSizes] = React.useState<number[]>(initialSizes);
  const [customSizeInput, setCustomSizeInput] = React.useState<string>("");
  const [colorways, setColorways] = React.useState<ColorwayDraft[]>(() =>
    buildInitialColorways(existingProduct, initialSizes),
  );
  const [activeColorwayId, setActiveColorwayId] = React.useState<string>(
    () => colorways[0]?.id ?? "",
  );

  const initialManagedImages = React.useMemo<ManagedImageItem[]>(() => {
    if (existingProduct?.productImages && existingProduct.productImages.length > 0) {
      return existingProduct.productImages.map((img) => ({
        id: img.id,
        colorwayId: img.colorwayId ?? null,
        imageUrl: img.imageUrl,
        publicId: img.publicId,
        isPrimary: img.isPrimary,
        displayOrder: img.displayOrder,
      }));
    }
    const collected: ManagedImageItem[] = [];
    if (existingProduct?.colorways) {
      existingProduct.colorways.forEach((cw) => {
        cw.images.forEach((url) => {
          if (!collected.some((c) => c.imageUrl === url)) {
            collected.push({
              colorwayId: cw.id,
              imageUrl: url,
              isPrimary: collected.length === 0,
              displayOrder: collected.length,
            });
          }
        });
      });
    }
    return collected;
  }, [existingProduct]);

  const [managedImages, setManagedImages] = React.useState<ManagedImageItem[]>(initialManagedImages);

  const [reserveShowroomPairs, setReserveShowroomPairs] = React.useState(
    existingProduct?.reserveShowroomPairs ?? false,
  );
  const [priceETB, setPriceETB] = React.useState<number | "">(existingProduct?.priceETB ?? "");
  const [compareAtPriceETB, setCompareAtPriceETB] = React.useState<number | "">(
    existingProduct?.compareAtPriceETB ?? "",
  );
  const [cogsETB, setCogsETB] = React.useState<number | "">(existingProduct?.cogsETB ?? "");
  const [freeAddisDelivery, setFreeAddisDelivery] = React.useState(
    existingProduct?.freeAddisDelivery ?? false,
  );
  const [status, setStatus] = React.useState<ProductStatus>(existingProduct?.status ?? "active");
  const [featuredTrending, setFeaturedTrending] = React.useState(
    existingProduct?.featuredTrending ?? false,
  );
  const [featuredNewDrop, setFeaturedNewDrop] = React.useState(
    existingProduct?.featuredNewDrop ?? false,
  );
  const [dispatchDepot, setDispatchDepot] = React.useState(existingProduct?.dispatchDepot ?? "");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const activeColorway =
    colorways.find((c) => c.id === activeColorwayId) ?? colorways[0];

  const getColorwayPairs = React.useCallback(
    (cw: ColorwayDraft) =>
      euSizes.reduce((sum, sz) => sum + Math.max(0, Number(cw.stockBySize[sz] ?? 0)), 0),
    [euSizes],
  );

  const totalPairs = React.useMemo(
    () => colorways.reduce((sum, cw) => sum + getColorwayPairs(cw), 0),
    [colorways, getColorwayPairs],
  );

  const numPrice = typeof priceETB === "number" ? priceETB : Number(priceETB) || 0;
  const numCompare =
    typeof compareAtPriceETB === "number" ? compareAtPriceETB : Number(compareAtPriceETB) || 0;
  const numCogs = typeof cogsETB === "number" ? cogsETB : Number(cogsETB) || 0;

  const netProfit = Math.max(0, numPrice - numCogs);
  const grossMarginPct = numPrice > 0 ? ((netProfit / numPrice) * 100).toFixed(1) : "0.0";
  const discountPct = calculateDiscountPercent(numPrice, numCompare);
  const selectedCategoryObj = categories.find((c) => c.slug === categorySlug);

  const previewImages = React.useMemo(() => {
    if (!activeColorway) return managedImages;
    const cwSpecific = managedImages.filter((m) => m.colorwayId === activeColorway.id);
    return cwSpecific.length > 0 ? cwSpecific : managedImages;
  }, [managedImages, activeColorway]);

  const toggleMaterial = (tag: string) => {
    setMaterials((prev) => {
      const next = prev.includes(tag) ? prev.filter((m) => m !== tag) : [...prev, tag];
      if (!materialSummary.trim()) {
        setMaterialSummary(next.join(", "));
      }
      return next;
    });
  };

  const applySizePreset = (presetSizes: readonly number[]) => {
    const sorted = Array.from(new Set(presetSizes)).sort((a, b) => a - b);
    setEuSizes(sorted);
    setColorways((prev) =>
      prev.map((cw) => {
        const nextStock: Record<number, number> = {};
        for (const sz of sorted) {
          nextStock[sz] = cw.stockBySize[sz] ?? 0;
        }
        return { ...cw, stockBySize: nextStock };
      }),
    );
  };

  const handleAddCustomSize = () => {
    const parsed = Math.floor(Number(customSizeInput));
    if (!Number.isFinite(parsed) || parsed < 18 || parsed > 55) {
      addToast({
        title: "Invalid EU Size",
        description: "Enter an EU shoe size between 18 and 55.",
        variant: "warning",
      });
      return;
    }
    if (!euSizes.includes(parsed)) {
      const nextSizes = [...euSizes, parsed].sort((a, b) => a - b);
      setEuSizes(nextSizes);
      setColorways((prev) =>
        prev.map((cw) => ({
          ...cw,
          stockBySize: { ...cw.stockBySize, [parsed]: cw.stockBySize[parsed] ?? 0 },
        })),
      );
    }
    setCustomSizeInput("");
  };

  const handleRemoveSize = (sizeToRemove: number) => {
    if (euSizes.length <= 1) {
      addToast({
        title: "Minimum One Size Required",
        description: "Keep at least one EU size configured for inventory tracking.",
        variant: "warning",
      });
      return;
    }
    setEuSizes((prev) => prev.filter((sz) => sz !== sizeToRemove));
    setColorways((prev) =>
      prev.map((cw) => {
        const nextStock = { ...cw.stockBySize };
        delete nextStock[sizeToRemove];
        return { ...cw, stockBySize: nextStock };
      }),
    );
  };

  const handleAddColorway = () => {
    const nextIdx = colorways.length;
    const preset = COLORWAY_PRESETS[nextIdx % COLORWAY_PRESETS.length]!;
    const newId = `cw-${Date.now()}-${nextIdx}`;
    const newCw: ColorwayDraft = {
      id: newId,
      name: `${preset.name}${nextIdx >= COLORWAY_PRESETS.length ? ` ${nextIdx + 1}` : ""}`,
      hex: preset.hex,
      secondaryHex: preset.secondaryHex,
      soleHex: preset.soleHex,
      lowStockThreshold: 2,
      stockBySize: Object.fromEntries(euSizes.map((sz) => [sz, 0])),
    };
    setColorways((prev) => [...prev, newCw]);
    setActiveColorwayId(newId);
  };

  const handleRemoveColorway = (cwId: string) => {
    if (colorways.length <= 1) {
      addToast({
        title: "Minimum One Colorway Required",
        description: "Each footwear model must include at least one colorway.",
        variant: "warning",
      });
      return;
    }
    const remaining = colorways.filter((c) => c.id !== cwId);
    setColorways(remaining);
    if (activeColorwayId === cwId && remaining[0]) {
      setActiveColorwayId(remaining[0].id);
    }
    setManagedImages((prev) =>
      prev.map((img) => (img.colorwayId === cwId ? { ...img, colorwayId: null } : img)),
    );
  };

  const updateColorwayField = <K extends keyof ColorwayDraft>(
    cwId: string,
    field: K,
    value: ColorwayDraft[K],
  ) => {
    setColorways((prev) => prev.map((c) => (c.id === cwId ? { ...c, [field]: value } : c)));
  };

  const updateStockCell = (cwId: string, size: number, qty: number) => {
    const safeQty = Math.max(0, Math.floor(Number.isFinite(qty) ? qty : 0));
    setColorways((prev) =>
      prev.map((c) =>
        c.id === cwId
          ? { ...c, stockBySize: { ...c.stockBySize, [size]: safeQty } }
          : c,
      ),
    );
  };

  const fillActiveColorwayStock = (mode: "bell" | "five" | "zero") => {
    if (!activeColorway) return;
    const nextStock: Record<number, number> = {};
    for (const sz of euSizes) {
      if (mode === "zero") {
        nextStock[sz] = 0;
      } else if (mode === "five") {
        nextStock[sz] = 5;
      } else {
        nextStock[sz] = BELL_CURVE_WEIGHTS[sz] ?? 3;
      }
    }
    updateColorwayField(activeColorway.id, "stockBySize", nextStock);
  };

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      errors.name = "Shoe model name is required (at least 2 characters).";
    }
    if (!brand.trim()) {
      errors.brand = "Brand name is required.";
    }
    if (!categorySlug) {
      errors.categorySlug = "Please select a category.";
    }
    if (!gender) {
      errors.gender = "Select target gender (Men, Women, Unisex, or Kids).";
    }
    if (!shoeType.trim()) {
      errors.shoeType = "Select a shoe type (e.g., Sneakers, Formal, Sports).";
    }
    if (numPrice <= 0) {
      errors.priceETB = "Selling price must be greater than 0 ETB.";
    }
    if (numCompare > 0 && numCompare <= numPrice) {
      errors.compareAtPriceETB =
        "Original / compare-at price must be greater than the discounted selling price.";
    }
    if (euSizes.length === 0) {
      errors.euSizes = "Add at least one EU size.";
    }
    if (colorways.length === 0 || colorways.some((c) => !c.name.trim())) {
      errors.colorways = "Every colorway must have a color name.";
    }
    return errors;
  };

  const saveProduct = async (publishStatus: ProductStatus) => {
    if (isSaving) return;

    const errors = validateForm();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      addToast({
        title: "Please Complete Required Fields",
        description: firstError,
        variant: "warning",
      });
      return;
    }

    setIsSaving(true);
    try {
      const badges: string[] = [];
      if (featuredNewDrop) badges.push("NEW DROP");
      if (discountPct > 0) badges.push(`-${discountPct}%`);

      const persistedImages = managedImages.filter(
        (m) => !m.file && m.imageUrl && !m.imageUrl.startsWith("blob:"),
      );

      const preparedColorways: ShoeColorway[] = colorways.map((cw) => {
        const cleanStock: Record<number, number> = {};
        for (const sz of euSizes) {
          cleanStock[sz] = Math.max(0, Math.floor(Number(cw.stockBySize[sz] ?? 0)));
        }

        const cwImages = persistedImages
          .filter((img) => img.colorwayId === cw.id)
          .map((img) => img.imageUrl);
        const fallbackImages =
          cwImages.length > 0
            ? cwImages
            : persistedImages.filter((img) => !img.colorwayId).map((img) => img.imageUrl);

        return {
          id: cw.id,
          name: cw.name.trim(),
          hex: cw.hex,
          secondaryHex: cw.secondaryHex || undefined,
          soleHex: cw.soleHex || undefined,
          images: fallbackImages,
          stockBySize: cleanStock,
          lowStockThreshold: cw.lowStockThreshold,
        };
      });

      const resolvedMaterials =
        materials.length > 0
          ? materials
          : materialSummary
              .split(",")
              .map((m) => m.trim())
              .filter(Boolean);

      const resolvedMaterialText = materialSummary.trim() || resolvedMaterials.join(", ") || null;

      if (isEditing && existingProduct) {
        const updated = await storeService.updateProduct(existingProduct.id, {
          name: name.trim(),
          sku: sku.trim().toUpperCase() || existingProduct.sku,
          categorySlug: categorySlug || existingProduct.categorySlug,
          categoryName: selectedCategoryObj?.name ?? existingProduct.categoryName,
          gender: (gender as GenderCategory) || existingProduct.gender,
          shoeType: shoeType.trim(),
          material: resolvedMaterialText,
          brand: brand.trim(),
          tagline: tagline.trim(),
          description: description.trim(),
          priceETB: numPrice,
          compareAtPriceETB: numCompare > numPrice ? numCompare : undefined,
          cogsETB: numCogs > 0 ? numCogs : undefined,
          badges: badges.length > 0 ? badges : existingProduct.badges,
          status: publishStatus,
          featuredTrending,
          featuredNewDrop,
          isOnSale: discountPct > 0,
          freeAddisDelivery,
          reserveShowroomPairs,
          dispatchDepot: dispatchDepot.trim() || existingProduct.dispatchDepot,
          colorways: preparedColorways,
          specs: {
            ...existingProduct.specs,
            upperMesh:
              existingProduct.specs.upperMesh || resolvedMaterials[0] || resolvedMaterialText || "",
            materials: resolvedMaterials,
          },
        });

        // Sync any persisted image assignments pointing to newly added colorways
        const savedExistingIds = new Set(existingProduct.colorways.map((c) => c.id));
        const imagesNeedingLink = managedImages.filter(
          (img) => img.id && img.colorwayId && !savedExistingIds.has(img.colorwayId),
        );
        for (const img of imagesNeedingLink) {
          const matchedColorway =
            updated.colorways.find((c) => c.id === img.colorwayId) ??
            updated.colorways.find((_, idx) => colorways[idx]?.id === img.colorwayId);
          if (img.id && matchedColorway) {
            await linkProductImageColorway(updated.id, img.id, matchedColorway.id);
          }
        }

        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["product"] });
        addToast({
          title: "Shoe Model Updated",
          description: `${name} (${colorways.length} colors, ${totalPairs} pairs) updated cleanly.`,
          variant: "success",
        });
      } else {
        const id = `prod-${Date.now()}`;
        const resolvedSku =
          sku.trim() ||
          `AG-${categorySlug ? categorySlug.slice(0, 3).toUpperCase() : "SHOE"}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newShoe: ShoeProduct = {
          id,
          slug: `${slugify(name)}-${Math.floor(100 + Math.random() * 900)}`,
          sku: resolvedSku.toUpperCase(),
          name: name.trim(),
          brand: brand.trim(),
          categorySlug,
          categoryName: selectedCategoryObj?.name ?? "Footwear",
          gender: (gender as GenderCategory) || "Unisex",
          shoeType: shoeType.trim(),
          material: resolvedMaterialText ?? "",
          tagline: tagline.trim(),
          description: description.trim(),
          priceETB: numPrice,
          compareAtPriceETB: numCompare > numPrice ? numCompare : undefined,
          cogsETB: numCogs > 0 ? numCogs : undefined,
          rating: 5.0,
          reviewCount: 0,
          badges: badges.length > 0 ? badges : ["New Release"],
          status: publishStatus,
          featuredTrending,
          featuredNewDrop,
          isOnSale: discountPct > 0,
          freeAddisDelivery,
          reserveShowroomPairs,
          dispatchDepot: dispatchDepot.trim() || "Bole Medhanialem Flagship Hub (Primary)",
          colorways: preparedColorways,
          specs: {
            upperMesh: resolvedMaterials[0] ?? resolvedMaterialText ?? "",
            cushioning: resolvedMaterials[1] ?? "Responsive Dual-Density Foam",
            outsoleGrip: resolvedMaterials[2] ?? "High-Traction Rubber Outsole",
            weightGrams: 245,
            heelDropMm: 8,
            fitAdvice:
              gender === "Kids"
                ? "Kids EU sizing with roomy toe box for growing feet."
                : "Fits true to Continental EU sizing.",
            materials: resolvedMaterials,
          },
          createdAt: new Date().toISOString(),
        };

        const created = await storeService.createProduct(newShoe);

        // Upload staged Cloudinary images grouped by target colorway
        const stagedItems = managedImages.filter((m) => Boolean(m.file));
        if (stagedItems.length > 0) {
          try {
            const grouped = new Map<string, ManagedImageItem[]>();
            for (const item of stagedItems) {
              const targetKey = item.colorwayId || "__shared__";
              const bucket = grouped.get(targetKey) ?? [];
              bucket.push(item);
              grouped.set(targetKey, bucket);
            }

            const allUploaded: ShoeProduct["productImages"] = [];

            for (const [groupKey, groupItems] of grouped.entries()) {
              const formData = new FormData();
              groupItems.forEach((item) => formData.append("images", item.file!));

              const primaryIdx = groupItems.findIndex((item) => item.isPrimary);
              if (primaryIdx >= 0) {
                formData.append("primaryIndex", String(primaryIdx));
              }

              if (groupKey !== "__shared__") {
                const matchedCw =
                  created.colorways.find((c) => c.id === groupKey) ??
                  created.colorways[colorways.findIndex((c) => c.id === groupKey)];
                if (matchedCw) {
                  formData.append("colorwayId", matchedCw.id);
                }
              }

              const uploaded = await storeService.uploadProductImages(created.id, formData);
              allUploaded.push(...uploaded);
            }

            const orderedUploaded = [...allUploaded].sort(
              (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.displayOrder - b.displayOrder,
            );
            await useCatalogStore.getState().updateProduct(created.id, {
              productImages: orderedUploaded,
            });
          } catch (uploadErr) {
            await queryClient.invalidateQueries({ queryKey: ["products"] });
            await queryClient.invalidateQueries({ queryKey: ["product"] });
            const uploadMsg =
              uploadErr instanceof Error
                ? uploadErr.message
                : "Could not upload product images to Cloudinary.";
            addToast({
              title: "Product Created, Image Upload Failed",
              description: `${uploadMsg} You can retry uploading photos on the edit page.`,
              variant: "error",
            });
            router.push(`/admin/products/${created.id}/edit`);
            return;
          }
        }

        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["product"] });
        addToast({
          title:
            publishStatus === "active"
              ? "Shoe Model Published to Storefront!"
              : "Saved as Draft",
          description: `${newShoe.name} (${colorways.length} colors, ${totalPairs} pairs) added to your catalog.`,
          variant: "success",
        });
      }

      router.push("/admin/products");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save shoe model.";
      addToast({
        title: "Error Saving Shoe Model",
        description: message,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted) {
    return <AdminProductFormSkeleton />;
  }

  const errorCount = Object.keys(fieldErrors).length;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card lg:flex-row lg:items-center">
        <div>
          <nav className="mb-1.5 flex items-center gap-1.5 font-label text-xs text-muted-foreground">
            <Link href="/admin" className="hover:text-primary">
              Admin Dashboard
            </Link>
            <span>/</span>
            <Link href="/admin/products" className="hover:text-primary">
              Shoe Catalog
            </Link>
            <span>/</span>
            <span className="font-bold text-primary">
              {isEditing ? "Edit Footwear Model" : "Add New Footwear Model"}
            </span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
              {isEditing ? `Edit: ${existingProduct?.name}` : "Add New Footwear Model"}
            </h1>
            <Badge variant="soft">Store HQ • Bole Hub</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
            Configure shoe attributes, multi-colorway swatches, Cloudinary photos, custom EU size
            ranges, and per-(colorway, size) inventory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild variant="ghost" size="sm" disabled={isSaving}>
            <Link href="/admin/products">Discard</Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => saveProduct("draft")}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Bookmark className="size-4" />}{" "}
            Save Draft
          </Button>
          <Button
            type="button"
            variant="cta"
            disabled={isSaving}
            onClick={() => saveProduct("active")}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Publish to Storefront"}
          </Button>
        </div>
      </div>

      {/* Validation Alert Summary */}
      {errorCount > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-label font-bold">
              Please resolve {errorCount} required field {errorCount === 1 ? "issue" : "issues"} before
              saving:
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {Object.values(fieldErrors).map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* 12-Column Split: Form Sections (8) + Sticky Live Preview (4) */}
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-12">
        {/* LEFT COLUMN (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
          {/* A. Basic Information & Shoe Attributes */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <Edit3 className="size-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    Basic Product Identity &amp; Shoe Attributes
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Model name, brand, shoe type, demographic, material, and description.
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Section 01</Badge>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-8">
                  <label className="mb-1.5 block font-label text-xs font-bold">
                    Shoe Model Name <span className="text-cta">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) {
                        setFieldErrors((p) => {
                          const next = { ...p };
                          delete next.name;
                          return next;
                        });
                      }
                    }}
                    placeholder="e.g., Entoto Horizon Carbon Runner"
                    className={cn(fieldErrors.name && "border-destructive")}
                  />
                  {fieldErrors.name ? (
                    <p className="mt-1 text-[11px] font-medium text-destructive">{fieldErrors.name}</p>
                  ) : null}
                </div>
                <div className="md:col-span-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="font-label text-xs font-bold">SKU / Style Code</label>
                    <button
                      type="button"
                      onClick={() =>
                        setSku(
                          `AG-${categorySlug ? categorySlug.slice(0, 3).toUpperCase() : "SHOE"}-${Math.floor(100 + Math.random() * 899)}`,
                        )
                      }
                      className="inline-flex items-center gap-1 font-label text-[11px] font-bold text-cta hover:underline cursor-pointer"
                    >
                      <RefreshCw className="size-3" /> Auto-Gen
                    </button>
                  </div>
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g., AG-RUN-42"
                    className="font-mono font-bold text-primary uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-label text-xs font-bold">
                    Brand <span className="text-cta">*</span>
                  </label>
                  <Input
                    list="brand-suggestions"
                    value={brand}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      if (fieldErrors.brand) {
                        setFieldErrors((p) => {
                          const next = { ...p };
                          delete next.brand;
                          return next;
                        });
                      }
                    }}
                    placeholder="Select or type a brand (e.g., Addis Performance Lab)"
                    className={cn(fieldErrors.brand && "border-destructive")}
                  />
                  <datalist id="brand-suggestions">
                    {BRAND_SUGGESTIONS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                  {fieldErrors.brand ? (
                    <p className="mt-1 text-[11px] font-medium text-destructive">
                      {fieldErrors.brand}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block font-label text-xs font-bold">
                    Category Taxonomy <span className="text-cta">*</span>
                  </label>
                  <select
                    value={categorySlug}
                    onChange={(e) => {
                      setCategorySlug(e.target.value);
                      if (fieldErrors.categorySlug) {
                        setFieldErrors((p) => {
                          const next = { ...p };
                          delete next.categorySlug;
                          return next;
                        });
                      }
                    }}
                    className={cn(
                      "h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none",
                      fieldErrors.categorySlug && "border-destructive",
                    )}
                  >
                    <option value="">Select Category...</option>
                    {categories
                      .filter((c) => !["men", "women"].includes(c.slug))
                      .map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                  {fieldErrors.categorySlug ? (
                    <p className="mt-1 text-[11px] font-medium text-destructive">
                      {fieldErrors.categorySlug}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-label text-xs font-bold">
                    Gender <span className="text-cta">*</span>
                  </label>
                  <div
                    className={cn(
                      "grid h-11 grid-cols-4 gap-1 rounded-lg bg-surface-low p-1",
                      fieldErrors.gender && "ring-1 ring-destructive",
                    )}
                  >
                    {SHOE_GENDERS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setGender(g);
                          if (g === "Kids" && !isEditing && euSizes.every((s) => s >= 38)) {
                            applySizePreset(KIDS_EU_SIZES);
                          }
                          if (fieldErrors.gender) {
                            setFieldErrors((p) => {
                              const next = { ...p };
                              delete next.gender;
                              return next;
                            });
                          }
                        }}
                        className={cn(
                          "rounded-md font-label text-xs font-bold transition-all cursor-pointer",
                          gender === g
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  {fieldErrors.gender ? (
                    <p className="mt-1 text-[11px] font-medium text-destructive">
                      {fieldErrors.gender}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block font-label text-xs font-bold">
                    Shoe Type <span className="text-cta">*</span>
                  </label>
                  <div className="relative">
                    <Layers className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
                    <select
                      value={shoeType}
                      onChange={(e) => {
                        setShoeType(e.target.value);
                        if (fieldErrors.shoeType) {
                          setFieldErrors((p) => {
                            const next = { ...p };
                            delete next.shoeType;
                            return next;
                          });
                        }
                      }}
                      className={cn(
                        "h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-sm text-foreground focus:border-primary focus:outline-none",
                        fieldErrors.shoeType && "border-destructive",
                      )}
                    >
                      {SHOE_TYPES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                      {!SHOE_TYPES.includes(shoeType as (typeof SHOE_TYPES)[number]) && shoeType ? (
                        <option value={shoeType}>{shoeType}</option>
                      ) : null}
                    </select>
                  </div>
                  {fieldErrors.shoeType ? (
                    <p className="mt-1 text-[11px] font-medium text-destructive">
                      {fieldErrors.shoeType}
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">
                  Editorial Tagline / Subtitle
                </label>
                <Input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g., Featherweight marathon plate engineered for high-altitude endurance"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">
                  Product Description
                </label>
                <Textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional — enter detailed product description, cushioning profile, and craftsmanship heritage..."
                />
              </div>
            </div>
          </section>

          {/* B. Available Colors & Material Mix */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <Palette className="size-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    Available Colors &amp; Materials
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Add or remove multiple shoe colorways and specify construction materials.
                  </p>
                </div>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={handleAddColorway}>
                <Plus className="size-3.5" /> Add Color
              </Button>
            </div>

            <div className="space-y-3">
              {colorways.map((cw, idx) => {
                const isSelected = activeColorway?.id === cw.id;
                const pairsInCw = getColorwayPairs(cw);

                return (
                  <div
                    key={cw.id}
                    onClick={() => setActiveColorwayId(cw.id)}
                    className={cn(
                      "rounded-xl border p-4 transition-all",
                      isSelected
                        ? "border-primary bg-primary-light/20 shadow-xs"
                        : "border-border bg-surface-low/50 hover:border-border",
                    )}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-4 rounded-full border border-border shadow-2xs"
                          style={{ backgroundColor: cw.hex }}
                        />
                        <span className="font-label text-xs font-bold text-foreground">
                          Colorway #{idx + 1}
                        </span>
                        <Badge variant="soft" className="text-[10px]">
                          {pairsInCw} pairs
                        </Badge>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={colorways.length <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveColorway(cw.id);
                        }}
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-35"
                      >
                        <Trash2 className="size-3.5" /> Remove
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                      <div className="md:col-span-5">
                        <label className="mb-1 block font-label text-[11px] font-bold">
                          Color Name *
                        </label>
                        <Input
                          value={cw.name}
                          onChange={(e) => {
                            updateColorwayField(cw.id, "name", e.target.value);
                            if (fieldErrors.colorways) {
                              setFieldErrors((p) => {
                                const next = { ...p };
                                delete next.colorways;
                                return next;
                              });
                            }
                          }}
                          placeholder="e.g., Midnight Navy / White"
                          className="h-10"
                        />
                      </div>

                      <div className="md:col-span-7">
                        <label className="mb-1 block font-label text-[11px] font-bold">
                          Swatch Hex Colors (Primary / Accent / Sole)
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          {(
                            [
                              { label: "Primary", key: "hex" as const, val: cw.hex },
                              { label: "Accent", key: "secondaryHex" as const, val: cw.secondaryHex },
                              { label: "Sole", key: "soleHex" as const, val: cw.soleHex },
                            ] as const
                          ).map((sw) => (
                            <label
                              key={sw.key}
                              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
                            >
                              <input
                                type="color"
                                value={sw.val}
                                onChange={(e) => updateColorwayField(cw.id, sw.key, e.target.value)}
                                className="size-4 cursor-pointer rounded-full border-none bg-transparent"
                              />
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                {sw.label}
                              </span>
                              <span className="font-mono text-[10px] font-bold">{sw.val}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-3 rounded-xl bg-surface-low/60 p-4">
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">
                  Primary Shoe Material Summary
                </label>
                <Input
                  value={materialSummary}
                  onChange={(e) => setMaterialSummary(e.target.value)}
                  placeholder="e.g., Full-Grain Ethiopian Leather / Breathable Mesh / Rubber Outsole"
                />
              </div>

              <div>
                <label className="mb-2 block font-label text-xs font-bold">
                  Material Composition Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {MATERIAL_TAGS.map((tag) => {
                    const active = materials.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleMaterial(tag)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-label text-xs font-bold transition-all cursor-pointer",
                          active
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "border border-border bg-surface text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {active ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* C. Multi-Angle Studio Photography & Cloudinary Storage */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <Camera className="size-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    Multi-Angle Studio Photography
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Upload multiple product images, preview before saving, reorder angles, and assign photos to specific colors.
                  </p>
                </div>
              </div>
              <Badge variant="soft">{managedImages.length} of 12 Photos Ready</Badge>
            </div>

            <ProductImageUploader
              productId={existingProduct?.id}
              images={managedImages}
              onChange={setManagedImages}
              colorways={colorways.map((c) => ({ id: c.id, name: c.name, hex: c.hex }))}
              savedColorwayIds={existingProduct?.colorways.map((c) => c.id) ?? []}
              maxImages={12}
            />
          </section>

          {/* D. EU Sizes & Per-(Color, Size) Inventory Matrix */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <Package className="size-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    EU Sizes &amp; Color-by-Size Inventory Matrix
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Add or remove EU sizes and track stock separately for every size and color combination.
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 self-start rounded-full bg-surface-container px-4 py-1.5">
                <span className="font-label text-xs font-semibold text-foreground">
                  Total Pairs:
                </span>
                <span className="font-display text-sm font-extrabold text-primary">
                  {totalPairs} pairs
                </span>
              </div>
            </div>

            {/* EU Size Range Controls + Add Custom Size */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-low p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 font-label text-[11px] font-bold text-muted-foreground uppercase">
                  <Ruler className="size-3.5 text-primary" /> Size Range:
                </span>
                <button
                  type="button"
                  onClick={() => applySizePreset(EU_SIZES)}
                  className="rounded-full bg-surface px-3 py-1 font-label text-xs font-bold text-primary shadow-xs hover:bg-surface-container cursor-pointer"
                >
                  Core EU (38–46)
                </button>
                <button
                  type="button"
                  onClick={() => applySizePreset(ADULT_EU_SIZES)}
                  className="rounded-full bg-surface px-3 py-1 font-label text-xs font-bold text-primary shadow-xs hover:bg-surface-container cursor-pointer"
                >
                  Adult EU (36–46)
                </button>
                <button
                  type="button"
                  onClick={() => applySizePreset(KIDS_EU_SIZES)}
                  className="rounded-full bg-surface px-3 py-1 font-label text-xs font-bold text-primary shadow-xs hover:bg-surface-container cursor-pointer"
                >
                  Kids EU (28–36)
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={18}
                  max={55}
                  value={customSizeInput}
                  onChange={(e) => setCustomSizeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomSize();
                    }
                  }}
                  placeholder="EU (e.g. 47)"
                  className="h-8 w-28 text-xs font-bold"
                />
                <Button type="button" size="sm" variant="secondary" onClick={handleAddCustomSize}>
                  <Plus className="size-3.5" /> Add Size
                </Button>
              </div>
            </div>

            {/* Quick Fill for Active Colorway */}
            {activeColorway ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-surface-low/60 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full border border-border"
                    style={{ backgroundColor: activeColorway.hex }}
                  />
                  <span className="font-label text-[11px] font-bold text-foreground">
                    Quick Fill ({activeColorway.name || "Selected Color"}):
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fillActiveColorwayStock("bell")}
                    className="rounded-full bg-surface px-3 py-1 font-label text-xs font-bold text-primary shadow-xs hover:bg-surface-container cursor-pointer"
                  >
                    Bell Curve
                  </button>
                  <button
                    type="button"
                    onClick={() => fillActiveColorwayStock("five")}
                    className="rounded-full bg-surface px-3 py-1 font-label text-xs font-bold text-primary shadow-xs hover:bg-surface-container cursor-pointer"
                  >
                    Set All 5 Prs
                  </button>
                  <button
                    type="button"
                    onClick={() => fillActiveColorwayStock("zero")}
                    className="rounded-full bg-surface px-3 py-1 font-label text-xs font-bold text-destructive shadow-xs hover:bg-red-50 cursor-pointer"
                  >
                    Reset to 0
                  </button>
                </div>
              </div>
            ) : null}

            {/* 2D Matrix Table: EU Sizes x Colorways */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-surface-low font-label text-xs font-bold text-muted-foreground uppercase">
                    <th className="rounded-l-lg px-4 py-2.5 whitespace-nowrap">EU Size</th>
                    {colorways.map((cw) => (
                      <th key={cw.id} className="px-3 py-2.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className="size-2.5 rounded-full border border-border"
                            style={{ backgroundColor: cw.hex }}
                          />
                          <span className="max-w-28 truncate">{cw.name || "Color"}</span>
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Size Total</th>
                    <th className="rounded-r-lg px-3 py-2.5 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {euSizes.map((sz) => {
                    const rowTotal = colorways.reduce(
                      (sum, cw) => sum + Math.max(0, Number(cw.stockBySize[sz] ?? 0)),
                      0,
                    );
                    return (
                      <tr key={sz} className="hover:bg-surface-low/40">
                        <td className="px-4 py-2.5 font-display font-bold text-foreground whitespace-nowrap">
                          EU {sz}
                        </td>
                        {colorways.map((cw) => (
                          <td key={`${sz}-${cw.id}`} className="px-3 py-2.5 text-center">
                            <input
                              type="number"
                              min={0}
                              aria-label={`${cw.name} EU ${sz} stock quantity`}
                              value={cw.stockBySize[sz] ?? 0}
                              onChange={(e) =>
                                updateStockCell(cw.id, sz, Math.max(0, Number(e.target.value) || 0))
                              }
                              className="h-9 w-20 rounded-lg border border-border bg-surface-low text-center font-mono text-sm font-bold text-foreground focus:border-primary focus:outline-none"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-primary whitespace-nowrap">
                          {rowTotal} prs
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={euSizes.length <= 1}
                            onClick={() => handleRemoveSize(sz)}
                            title={`Remove EU ${sz}`}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-surface-container/60 p-4">
              <input
                type="checkbox"
                checked={reserveShowroomPairs}
                onChange={(e) => setReserveShowroomPairs(e.target.checked)}
                className="mt-1 size-4 accent-primary"
              />
              <div>
                <span className="block font-label text-xs font-bold text-foreground">
                  Reserve 1 pair of Size 41 &amp; 42 for Bole Showroom walk-in try-ons
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Keeps 2 physical pairs available for in-store shoppers testing fit.
                </span>
              </div>
            </label>
          </section>

          {/* E. Ethiopian Birr Financials */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <Wallet className="size-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    Pricing &amp; Ethiopian Birr Financials
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Set selling price (ETB), optional pre-discount MSRP, and inspect gross margins.
                  </p>
                </div>
              </div>
              <Badge variant="soft">15% VAT Included</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">
                  Selling Price (ETB) <span className="text-cta">*</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  value={priceETB}
                  placeholder="0"
                  onChange={(e) => {
                    setPriceETB(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)));
                    if (fieldErrors.priceETB) {
                      setFieldErrors((p) => {
                        const next = { ...p };
                        delete next.priceETB;
                        return next;
                      });
                    }
                  }}
                  className={cn(
                    "font-display text-base font-bold text-primary",
                    fieldErrors.priceETB && "border-destructive",
                  )}
                />
                {fieldErrors.priceETB ? (
                  <p className="mt-1 text-[11px] font-medium text-destructive">
                    {fieldErrors.priceETB}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">
                  Original / Compare-at Price (ETB)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={compareAtPriceETB}
                  placeholder="Optional (must exceed selling price)"
                  onChange={(e) => {
                    setCompareAtPriceETB(
                      e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                    );
                    if (fieldErrors.compareAtPriceETB) {
                      setFieldErrors((p) => {
                        const next = { ...p };
                        delete next.compareAtPriceETB;
                        return next;
                      });
                    }
                  }}
                  className={cn(
                    "font-display text-base font-semibold",
                    fieldErrors.compareAtPriceETB && "border-destructive",
                  )}
                />
                {discountPct > 0 ? (
                  <p className="mt-1 font-label text-[11px] font-bold text-cta">
                    Customer saves {discountPct}% ({formatETBPrefix(numCompare - numPrice)})
                  </p>
                ) : fieldErrors.compareAtPriceETB ? (
                  <p className="mt-1 text-[11px] font-medium text-destructive">
                    {fieldErrors.compareAtPriceETB}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">
                  Production Cost / Pair (ETB)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={cogsETB}
                  placeholder="0"
                  onChange={(e) =>
                    setCogsETB(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))
                  }
                  className="font-display text-base font-semibold"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-xl bg-surface-container/70 p-4 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <TrendingUp className="size-6 text-primary" />
                <div>
                  <p className="font-label text-xs font-bold text-primary">
                    Proprietor Real-Time Unit Economics
                  </p>
                  <p className="text-xs text-foreground">
                    Gross Margin: <strong className="text-primary">{grossMarginPct}%</strong> • Net
                    profit per pair:{" "}
                    <strong className="text-cta">{netProfit.toLocaleString()} ETB</strong>
                  </p>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-surface px-3.5 py-2 text-xs font-bold shadow-xs">
                <input
                  type="checkbox"
                  checked={freeAddisDelivery}
                  onChange={(e) => setFreeAddisDelivery(e.target.checked)}
                  className="size-4 accent-cta"
                />
                Free Addis Express (&gt;3,500 ETB)
              </label>
            </div>
          </section>
        </div>

        {/* RIGHT STICKY SIDEBAR (4 cols): Live Storefront Card Preview + Publishing */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:col-span-4">
          {/* Live Storefront Preview */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-label text-xs font-bold text-primary">
                <span className="size-2 animate-ping rounded-full bg-cta" /> Live Storefront Preview
              </span>
              <span className="font-label text-[10px] text-muted-foreground">Mobile &amp; Web</span>
            </div>

            <div className="rounded-xl border border-border bg-surface-low p-3.5">
              <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-lg bg-surface p-3">
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {featuredNewDrop ? <Badge variant="default">NEW DROP</Badge> : null}
                  {discountPct > 0 ? <Badge variant="cta">-{discountPct}%</Badge> : null}
                </div>
                <span className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-surface text-muted-foreground shadow-xs">
                  <Heart className="size-4" />
                </span>
                {previewImages[0]?.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewImages[0].imageUrl}
                    alt={name || "Footwear Preview"}
                    className="size-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground/50">
                    <Camera className="size-8 stroke-[1.5]" />
                    <span className="mt-1 font-label text-[11px] font-medium">
                      No Image Uploaded
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-label text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {brand || selectedCategoryObj?.name || "Footwear"} • {shoeType}
                  </span>
                  <div className="flex items-center gap-1">
                    {colorways.map((cw) => (
                      <button
                        key={cw.id}
                        type="button"
                        onClick={() => setActiveColorwayId(cw.id)}
                        title={cw.name}
                        className={cn(
                          "size-3 rounded-full border border-border cursor-pointer",
                          activeColorway?.id === cw.id && "ring-2 ring-primary ring-offset-1",
                        )}
                        style={{ backgroundColor: cw.hex }}
                      />
                    ))}
                  </div>
                </div>
                <h3 className="truncate font-display text-base font-bold text-foreground">
                  {name || "Untitled Footwear Model"}
                </h3>
                <div className="flex flex-wrap gap-1">
                  {euSizes.slice(0, 6).map((sz) => {
                    const qty = activeColorway?.stockBySize[sz] ?? 0;
                    return (
                      <span
                        key={sz}
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                          qty > 0
                            ? "bg-surface text-foreground border border-border"
                            : "bg-muted text-muted-foreground/40 line-through",
                        )}
                      >
                        {sz}
                      </span>
                    );
                  })}
                  {euSizes.length > 6 ? (
                    <span className="px-1 font-label text-[10px] text-muted-foreground">
                      +{euSizes.length - 6}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-base font-extrabold text-primary">
                    {formatETBPrefix(numPrice)}
                  </span>
                  {numCompare > numPrice ? (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatETBPrefix(numCompare)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between pt-1.5 font-label text-[11px]">
                  <span className="font-semibold text-primary">
                    {totalPairs} pairs ({colorways.length}{" "}
                    {colorways.length === 1 ? "color" : "colors"})
                  </span>
                  <span className="font-bold text-cta">{gender || "Unisex"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Publishing Status */}
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h3 className="font-display text-base font-bold text-foreground">Publishing Status</h3>
            <div>
              <label className="mb-1 block font-label text-xs font-semibold text-muted-foreground">
                Catalog State
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
                className="h-10 w-full rounded-lg border border-border bg-surface-low px-3 font-label text-xs font-bold text-primary"
              >
                <option value="active">Active (Live on Storefront)</option>
                <option value="draft">Draft (Admin Preview Only)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="space-y-2.5 text-xs">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={featuredTrending}
                  onChange={(e) => setFeaturedTrending(e.target.checked)}
                  className="size-4 accent-primary"
                />
                <span>Feature in &ldquo;Trending Footwear&rdquo; on Homepage</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={featuredNewDrop}
                  onChange={(e) => setFeaturedNewDrop(e.target.checked)}
                  className="size-4 accent-primary"
                />
                <span>Include in &ldquo;New Drops &amp; Limited Silhouettes&rdquo;</span>
              </label>
            </div>
          </div>

          {/* Fulfillment Logistics */}
          <div className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              <h3 className="font-display text-base font-bold text-foreground">
                Fulfillment Logistics
              </h3>
            </div>
            <select
              value={dispatchDepot}
              onChange={(e) => setDispatchDepot(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface-low px-3 text-xs text-foreground"
            >
              <option value="">Select fulfillment depot...</option>
              <option value="Bole Medhanialem Flagship Hub (Primary)">
                Bole Medhanialem Flagship Hub (Primary)
              </option>
              <option value="Kazanchis Sub-depot Warehouse">
                Kazanchis Sub-depot Warehouse
              </option>
              <option value="Regional Cargo Express (Hawassa/Bahir Dar)">
                Regional Cargo Express (Hawassa/Bahir Dar)
              </option>
            </select>
          </div>

          {/* Sticky Publish Box */}
          <div className="space-y-2.5 rounded-2xl border border-border bg-surface p-5 shadow-md">
            <Button
              type="button"
              variant="cta"
              size="lg"
              className="w-full"
              disabled={isSaving}
              onClick={() => saveProduct(status)}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              {isSaving
                ? "Saving Footwear..."
                : isEditing
                  ? "Update Footwear Model"
                  : "Publish Shoe to Storefront"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={isSaving}
              onClick={() => saveProduct("draft")}
            >
              {isSaving ? "Saving..." : "Save as Draft"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
