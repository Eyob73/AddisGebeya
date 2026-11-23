"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Camera,
  Check,
  CheckCircle2,
  Edit3,
  Heart,
  ImagePlus,
  MapPin,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Rocket,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { EU_SIZES, HERO_ASSETS } from "@/data/mock-footwear";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import type { GenderCategory, ProductStatus, ShoeProduct } from "@/types/store.types";
import { calculateDiscountPercent, formatETBPrefix, slugify } from "@/utils/format";
import { cn } from "@/lib/utils";

const MATERIAL_TAGS = [
  "Full-grain Ethiopian Cowhide",
  "Jacquard Breathable Mesh",
  "Nitrogen-infused EVA Foam",
  "Vibram Rubber Lugs",
  "Recycled Poly Laces",
  "Vegetable-Tanned Insole",
];

const DEFAULT_STUDIO_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCUaiG8O_DLd0YbSpf3vgJniH-AnPgPDp2VKpsskAXMxc8Sf9QDZIMXxpp0WTvMI0Lx4_vum8mGzz6vu5O1U8yoEhp0tMrNsGJqZpLN7Fx4MBmSqRDJHmLW9FlcsPZRYfuWzkvi4SeIY5ZTgMMoyb4vvvBQxGSFCkQIIZ7hADHBITf2n8SwctcpPasERCRhOOUiwb97EdhdUYq-DqxVVm9_jDeADMS7964w_drvSw",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCjHczMhbwMAhvhAVtUwwv3NtbP-0OGYgHbAp3Mi-t42TtLe3lX72pGEtoLwWf7PRH8c50OWaDbJNmBngw9e6uSK2gnQsk1va3ki8YdJ46BrzAxG-ecFQII2ZPJV30llXX6ckLT0bbTCtMgK-sBMsN1NSCG5FGHPmeDHRLjNvBLvIPa44SO5552FkQenBeJsD4yAqvGm5RMtKdP0JrumJEZalSYEUN75N30tzU_mw",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAVgUtKIzuvkxXHu-20rvKAzPUrwegEojPUinD8sGUbW5FkX52HHQKsO_brAj4mmOyUd8peGibu9LylAqhvdgW15ei5OdHNsvq88Su3IhGVOp13mOrFm2GDu8iJ-PQ67rTqHCBIAMb-w9TOTpUPdJ0JpDUHZfJeIfBGK1a06KFCg6kCI13WEhA_ijYfn7tHKsAM_aKHAqW-DAEjhTU9a7O4t3jXBhCLdT6BwKBUcQ",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBwzoEB_F0cRmxcMPvp7oA-ZQIZ_UNzbNSBxb4szwC_9wiAPWwg7jPURZwEgLQEoRbDIjAsgs1hStxylhkMviAV4ItQR_eprt9tkvHdCnn3J7kujQYClM2ugSaIjquqR0JPpU6myj7qQGDEikV0eSVOXtnPED5o-mIQDwyLDbhEFt-T9bSugC_u-8BRTj6oEm_hJEoIwjyspq_8uRnbAhRYXJNUZFpWs4d5-ZP8LA",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAI29Qea7tYm_7KVT8oM0kw63OJ6qJE_tvt7UHfa62DILpwDEGCMMbGItg2Pv0Xv4jlAUYSvcOzBSUIsSG0CdHcHmFyzQjOkNW7UrOiDyEk5Qk62WzL3iRd515bQ7AdzfAitufkCKRDxGkOl0tsY7zX8YYgWfOm3wBAdC1ViBzgFCsH52689FG21RWnIBUVq2h3JoOSh5K-K7eujR2Tr7camyp1u4kCJ40hnDFwjg",
];

const BELL_PRESET: Record<number, number> = {
  38: 2,
  39: 3,
  40: 4,
  41: 5,
  42: 5,
  43: 4,
  44: 3,
  45: 1,
  46: 1,
};

const HEAVY_PRESET: Record<number, number> = {
  38: 3,
  39: 4,
  40: 6,
  41: 8,
  42: 8,
  43: 7,
  44: 5,
  45: 2,
  46: 2,
};

interface ProductFormViewProps {
  existingProduct?: ShoeProduct;
}

export function ProductFormView({ existingProduct }: ProductFormViewProps) {
  const router = useRouter();
  const { categories, addProduct, updateProduct } = useCatalogStore();
  const addToast = useUiStore((s) => s.addToast);
  const isEditing = Boolean(existingProduct);

  const initialCw = existingProduct?.colorways[0];

  const [name, setName] = React.useState(
    existingProduct?.name ?? "Entoto Horizon Carbon Runner",
  );
  const [sku, setSku] = React.useState(existingProduct?.sku ?? "AG-RUN-09");
  const [categorySlug, setCategorySlug] = React.useState(
    existingProduct?.categorySlug ?? "running",
  );
  const [gender, setGender] = React.useState<GenderCategory>(
    existingProduct?.gender ?? "Unisex",
  );
  const [brand, setBrand] = React.useState(
    existingProduct?.brand ?? "Addis Performance Lab",
  );
  const [tagline, setTagline] = React.useState(
    existingProduct?.tagline ??
      "Featherweight marathon plate engineered for high-altitude endurance and Addis hill training.",
  );
  const [description, setDescription] = React.useState(
    existingProduct?.description ??
      "Designed in Addis Ababa and crafted with local marathon heritage, integrating dual-density nitrogen-infused EVA cushioning with a rigid carbon-fiber propulsion plate.",
  );
  const [colorwayName, setColorwayName] = React.useState(
    initialCw?.name ?? "Dark Obsidian / Sunset Clay",
  );
  const [primaryHex, setPrimaryHex] = React.useState(initialCw?.hex ?? "#0E5A6B");
  const [secondaryHex, setSecondaryHex] = React.useState(initialCw?.secondaryHex ?? "#B13A0A");
  const [soleHex, setSoleHex] = React.useState(initialCw?.soleHex ?? "#F7F7F4");
  const [materials, setMaterials] = React.useState<string[]>(
    existingProduct?.specs.materials ?? [
      "Full-grain Ethiopian Cowhide",
      "Jacquard Breathable Mesh",
      "Nitrogen-infused EVA Foam",
      "Vibram Rubber Lugs",
    ],
  );
  const [images, setImages] = React.useState<string[]>(
    initialCw?.images.length ? initialCw.images : DEFAULT_STUDIO_IMAGES,
  );
  const [stockBySize, setStockBySize] = React.useState<Record<number, number>>(
    initialCw?.stockBySize ?? BELL_PRESET,
  );
  const [reserveShowroomPairs, setReserveShowroomPairs] = React.useState(
    existingProduct?.reserveShowroomPairs ?? true,
  );
  const [priceETB, setPriceETB] = React.useState(existingProduct?.priceETB ?? 5800);
  const [compareAtPriceETB, setCompareAtPriceETB] = React.useState(
    existingProduct?.compareAtPriceETB ?? 6800,
  );
  const [cogsETB, setCogsETB] = React.useState(existingProduct?.cogsETB ?? 2424);
  const [freeAddisDelivery, setFreeAddisDelivery] = React.useState(
    existingProduct?.freeAddisDelivery ?? true,
  );
  const [status, setStatus] = React.useState<ProductStatus>(
    existingProduct?.status ?? "active",
  );
  const [featuredTrending, setFeaturedTrending] = React.useState(
    existingProduct?.featuredTrending ?? true,
  );
  const [featuredNewDrop, setFeaturedNewDrop] = React.useState(
    existingProduct?.featuredNewDrop ?? true,
  );
  const [dispatchDepot, setDispatchDepot] = React.useState(
    existingProduct?.dispatchDepot ?? "Bole Medhanialem Flagship Hub (Primary)",
  );

  const totalPairs = Object.values(stockBySize).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const netProfit = Math.max(0, priceETB - cogsETB);
  const grossMarginPct = priceETB > 0 ? ((netProfit / priceETB) * 100).toFixed(1) : "0.0";
  const discountPct = calculateDiscountPercent(priceETB, compareAtPriceETB);
  const selectedCategoryObj = categories.find((c) => c.slug === categorySlug);

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setImages((prev) => [reader.result as string, ...prev].slice(0, 6));
        }
      };
      reader.readAsDataURL(file);
    });
    addToast({
      title: "Studio Photo Uploaded",
      description: "Preview updated in the multi-angle gallery and storefront card.",
      variant: "success",
    });
  };

  const toggleMaterial = (tag: string) => {
    setMaterials((prev) =>
      prev.includes(tag) ? prev.filter((m) => m !== tag) : [...prev, tag],
    );
  };

  const saveProduct = (publishStatus: ProductStatus) => {
    if (!name.trim() || priceETB <= 0) {
      addToast({
        title: "Missing Required Details",
        description: "Please provide a shoe model name and a valid ETB retail price.",
        variant: "warning",
      });
      return;
    }

    const badges: string[] = [];
    if (featuredNewDrop) badges.push("NEW DROP");
    if (discountPct > 0) badges.push(`-${discountPct}%`);

    const primaryColorway = {
      id: initialCw?.id ?? `cw-${Date.now()}`,
      name: colorwayName.trim() || "Signature Colorway",
      hex: primaryHex,
      secondaryHex,
      soleHex,
      images: images.length > 0 ? images : [HERO_ASSETS.heroSneaker],
      stockBySize,
      lowStockThreshold: 2,
    };

    if (isEditing && existingProduct) {
      updateProduct(existingProduct.id, {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        categorySlug,
        categoryName: selectedCategoryObj?.name ?? existingProduct.categoryName,
        gender,
        brand,
        tagline,
        description,
        priceETB,
        compareAtPriceETB: compareAtPriceETB > priceETB ? compareAtPriceETB : undefined,
        cogsETB,
        badges: badges.length > 0 ? badges : existingProduct.badges,
        status: publishStatus,
        featuredTrending,
        featuredNewDrop,
        isOnSale: discountPct > 0,
        freeAddisDelivery,
        reserveShowroomPairs,
        dispatchDepot,
        colorways: [primaryColorway, ...existingProduct.colorways.slice(1)],
        specs: {
          ...existingProduct.specs,
          materials,
        },
      });
      addToast({
        title: "Shoe Model Updated",
        description: `${name} changes are live across the storefront and inventory matrix.`,
        variant: "success",
      });
    } else {
      const id = `prod-${Date.now()}`;
      const newShoe: ShoeProduct = {
        id,
        slug: `${slugify(name)}-${Math.floor(100 + Math.random() * 900)}`,
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        brand,
        categorySlug,
        categoryName: selectedCategoryObj?.name ?? "Running & Performance",
        gender,
        tagline,
        description,
        priceETB,
        compareAtPriceETB: compareAtPriceETB > priceETB ? compareAtPriceETB : undefined,
        cogsETB,
        rating: 5.0,
        reviewCount: 1,
        badges: badges.length > 0 ? badges : ["New Release"],
        status: publishStatus,
        featuredTrending,
        featuredNewDrop,
        isOnSale: discountPct > 0,
        freeAddisDelivery,
        reserveShowroomPairs,
        dispatchDepot,
        colorways: [primaryColorway],
        specs: {
          upperMesh: materials[1] ?? "Engineered Air-Mesh",
          cushioning: materials[2] ?? "NitroPro EVA Foam",
          outsoleGrip: materials[3] ?? "Entoto All-Terrain Rubber",
          weightGrams: 245,
          heelDropMm: 8,
          fitAdvice: "Fits true to Continental EU sizing.",
          materials,
        },
        createdAt: new Date().toISOString(),
      };
      addProduct(newShoe);
      addToast({
        title:
          publishStatus === "active"
            ? "Shoe Model Published to Storefront!"
            : "Saved as Draft",
        description: `${newShoe.name} (${totalPairs} pairs) added to your catalog.`,
        variant: "success",
      });
    }

    router.push("/admin/products");
  };

  const angleLabels = [
    { label: "1. Lateral Profile", tag: "HERO", required: true },
    { label: "2. Top-Down & Toe Box", tag: "Top Angle", required: true },
    { label: "3. Medial Profile", tag: "Inner Arch", required: true },
    { label: "4. Outsole & Tread Grip", tag: "Tread", required: true },
    { label: "5. Heel Counter Detail", tag: "Heel", required: false },
  ];

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
            Configure product specs, multi-angle studio photos, ETB pricing &amp; margins, and
            EU size-level inventory for online and Bole showroom dispatch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/products">Discard</Link>
          </Button>
          <Button type="button" variant="secondary" onClick={() => saveProduct("draft")}>
            <Bookmark className="size-4" /> Save Draft
          </Button>
          <Button type="button" variant="cta" onClick={() => saveProduct("active")}>
            <Rocket className="size-4" /> {isEditing ? "Save Changes" : "Publish to Storefront"}
          </Button>
        </div>
      </div>

      {/* 12-Column Split: Form Sections (8) + Sticky Live Preview (4) */}
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-12">
        {/* LEFT COLUMN (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
          {/* A. Basic Information */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <Edit3 className="size-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    Basic Product Identity
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Core taxonomy, naming, and editorial copy for catalog listings.
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
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Entoto Horizon Carbon Runner"
                  />
                </div>
                <div className="md:col-span-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="font-label text-xs font-bold">SKU / Style Code</label>
                    <button
                      type="button"
                      onClick={() =>
                        setSku(`AG-${categorySlug.slice(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 89)}`)
                      }
                      className="inline-flex items-center gap-1 font-label text-[11px] font-bold text-cta hover:underline cursor-pointer"
                    >
                      <RefreshCw className="size-3" /> Auto-Gen
                    </button>
                  </div>
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="font-mono font-bold text-primary uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block font-label text-xs font-bold">
                    Category Taxonomy *
                  </label>
                  <select
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    {categories
                      .filter((c) => !["men", "women"].includes(c.slug))
                      .map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block font-label text-xs font-bold">
                    Target Demographic
                  </label>
                  <div className="grid h-11 grid-cols-3 gap-1 rounded-lg bg-surface-low p-1">
                    {(["Men", "Women", "Unisex"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={cn(
                          "rounded-md font-label text-xs font-bold transition-all cursor-pointer",
                          gender === g
                            ? "bg-surface text-primary shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block font-label text-xs font-bold">
                    Brand Line / Collection
                  </label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option>Addis Performance Lab</option>
                    <option>Bole Heritage Series</option>
                    <option>Abyssinia Luxury Leather</option>
                    <option>Entoto Trail Lab</option>
                    <option>Daily Flight</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">
                  Editorial Tagline / Subtitle
                </label>
                <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
              </div>

              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">
                  Comprehensive Product Narrative
                </label>
                <Textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* B. Multi-Angle Studio Photography */}
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
                    Upload clean studio angles to showcase every detail on the product page.
                  </p>
                </div>
              </div>
              <Badge variant="soft">{images.length} of 6 Angles Ready</Badge>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-between gap-4 rounded-xl border border-dashed border-primary/40 bg-surface-low/70 p-5 transition-colors hover:bg-surface-container/60 sm:flex-row">
              <div className="flex items-center gap-3.5">
                <div className="flex size-11 items-center justify-center rounded-full bg-surface text-primary shadow-sm">
                  <Upload className="size-5" />
                </div>
                <div>
                  <p className="font-label text-xs font-bold text-foreground">
                    Drop high-res shoe photos or <span className="text-cta underline">browse files</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Recommended 2000×2000px isolated PNG or WebP studio renders
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-surface px-4 py-2 font-label text-xs font-bold text-primary shadow-xs">
                Select Photos
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageFileUpload}
                className="hidden"
              />
            </label>

            <div className="mt-5 grid grid-cols-2 gap-3.5 md:grid-cols-3">
              {angleLabels.map((slot, idx) => (
                <div
                  key={slot.label}
                  className="flex flex-col rounded-xl border border-border/70 bg-surface-low/60 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant={idx === 0 ? "cta" : "soft"} className="text-[10px]">
                      {slot.tag}
                    </Badge>
                    <span className="font-label text-[10px] text-muted-foreground">
                      {slot.required ? "Required" : "Recommended"}
                    </span>
                  </div>
                  <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-surface p-2">
                    {images[idx] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={images[idx]}
                        alt={slot.label}
                        className="size-full object-contain"
                      />
                    ) : (
                      <ImagePlus className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="truncate font-label text-[11px] font-bold text-foreground">
                      {slot.label}
                    </span>
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* C. Size-Specific Inventory Matrix */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <Package className="size-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    Size-Specific Inventory Matrix
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Allocate exact pairs per Continental EU size. 0-pair sizes are blocked on the
                    storefront.
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 self-start rounded-full bg-surface-container px-4 py-1.5">
                <span className="font-label text-xs font-semibold text-foreground">
                  Total Initial Pairs:
                </span>
                <span className="font-display text-sm font-extrabold text-primary">
                  {totalPairs} pairs
                </span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-surface-low p-3">
              <span className="font-label text-[11px] font-bold text-muted-foreground uppercase">
                Quick Fill Presets:
              </span>
              <button
                type="button"
                onClick={() => setStockBySize({ ...BELL_PRESET })}
                className="rounded-full bg-surface px-3 py-1 font-label text-xs font-bold text-primary shadow-xs hover:bg-surface-container cursor-pointer"
              >
                Bell Curve (28 Prs)
              </button>
              <button
                type="button"
                onClick={() => setStockBySize({ ...HEAVY_PRESET })}
                className="rounded-full bg-surface px-3 py-1 font-label text-xs font-bold text-primary shadow-xs hover:bg-surface-container cursor-pointer"
              >
                Heavy Batch (45 Prs)
              </button>
              <button
                type="button"
                onClick={() =>
                  setStockBySize(
                    Object.fromEntries(EU_SIZES.map((s) => [s, 0])) as Record<number, number>,
                  )
                }
                className="rounded-full bg-surface px-3 py-1 font-label text-xs font-bold text-destructive shadow-xs hover:bg-red-50 cursor-pointer"
              >
                Reset to 0
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-surface-low font-label text-xs font-bold text-muted-foreground uppercase">
                    <th className="rounded-l-lg px-4 py-2.5">EU Size</th>
                    <th className="px-4 py-2.5">Size SKU Suffix</th>
                    <th className="px-4 py-2.5 text-center">Pairs in Stock</th>
                    <th className="rounded-r-lg px-4 py-2.5 text-right">Allocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {EU_SIZES.map((sz) => (
                    <tr key={sz} className="hover:bg-surface-low/40">
                      <td className="px-4 py-2.5 font-display font-bold text-foreground">
                        EU {sz}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {sku}-{sz}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          value={stockBySize[sz] ?? 0}
                          onChange={(e) =>
                            setStockBySize((prev) => ({
                              ...prev,
                              [sz]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="h-9 w-20 rounded-lg border border-border bg-surface-low text-center font-mono text-sm font-bold text-foreground focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {reserveShowroomPairs && (sz === 41 || sz === 42) ? (
                          <Badge variant="cta" className="text-[10px]">
                            1 Display Sample
                          </Badge>
                        ) : (
                          <span className="rounded bg-surface-container px-2 py-0.5 font-label text-[11px] font-semibold text-muted-foreground">
                            Online Direct
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
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

          {/* D. Colorway & Materials */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                <Palette className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  Colorway Definition &amp; Material Mix
                </h2>
                <p className="text-xs text-muted-foreground">
                  Specify swatch triad hex colors and verified material composition tags.
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-xl bg-surface-low/60 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-label text-xs font-bold">
                    Colorway Name
                  </label>
                  <Input
                    value={colorwayName}
                    onChange={(e) => setColorwayName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-label text-xs font-bold">
                    Color Swatch Triad
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { label: "Primary", val: primaryHex, set: setPrimaryHex },
                      { label: "Accent", val: secondaryHex, set: setSecondaryHex },
                      { label: "Sole", val: soleHex, set: setSoleHex },
                    ].map((sw) => (
                      <label
                        key={sw.label}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
                      >
                        <input
                          type="color"
                          value={sw.val}
                          onChange={(e) => sw.set(e.target.value)}
                          className="size-5 cursor-pointer rounded-full border-none bg-transparent"
                        />
                        <span className="font-mono text-[11px] font-semibold">{sw.val}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block font-label text-xs font-bold">
                  Verified Material Composition Tags
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
                    Set retail ETB pricing, discount MSRP, and inspect gross margins.
                  </p>
                </div>
              </div>
              <Badge variant="soft">15% VAT Included</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">
                  Regular Retail Price (ETB) *
                </label>
                <Input
                  type="number"
                  min={0}
                  value={priceETB}
                  onChange={(e) => setPriceETB(Number(e.target.value) || 0)}
                  className="font-display text-base font-bold text-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">
                  Compare-at MSRP (ETB)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={compareAtPriceETB}
                  onChange={(e) => setCompareAtPriceETB(Number(e.target.value) || 0)}
                  className="font-display text-base font-semibold"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold">
                  Production Cost / Pair (ETB)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={cogsETB}
                  onChange={(e) => setCogsETB(Number(e.target.value) || 0)}
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
                <span className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-surface shadow-xs text-muted-foreground">
                  <Heart className="size-4" />
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[0] ?? HERO_ASSETS.heroSneaker}
                  alt={name}
                  className="size-full object-contain"
                />
              </div>

              <div className="mt-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-label text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {selectedCategoryObj?.name ?? "Footwear"}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: primaryHex }} />
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: secondaryHex }} />
                    <span className="size-2.5 rounded-full border border-border" style={{ backgroundColor: soleHex }} />
                  </div>
                </div>
                <h3 className="truncate font-display text-base font-bold text-foreground">
                  {name || "Untitled Footwear Model"}
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-base font-extrabold text-primary">
                    {formatETBPrefix(priceETB)}
                  </span>
                  {compareAtPriceETB > priceETB ? (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatETBPrefix(compareAtPriceETB)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between pt-1.5 font-label text-[11px]">
                  <span className="font-semibold text-primary">{totalPairs} pairs in Addis Hub</span>
                  <span className="font-bold text-cta">Express Next-Day</span>
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
              <option>Bole Medhanialem Flagship Hub (Primary)</option>
              <option>Kazanchis Sub-depot Warehouse</option>
              <option>Regional Cargo Express (Hawassa/Bahir Dar)</option>
            </select>
          </div>

          {/* Sticky Publish Box */}
          <div className="space-y-2.5 rounded-2xl border border-border bg-surface p-5 shadow-md">
            <Button
              type="button"
              variant="cta"
              size="lg"
              className="w-full"
              onClick={() => saveProduct(status)}
            >
              <Rocket className="size-4" />
              {isEditing ? "Update Footwear Model" : "Publish Shoe to Storefront"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => saveProduct("draft")}
            >
              Save as Draft
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

