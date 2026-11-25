"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Headphones,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
  Upload,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CategoryCard } from "@/components/shared/category-card";
import { ProductCard } from "@/components/shared/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SkeletonBase, SkeletonProductGrid } from "@/components/ui/skeleton";
import {
  getAvailableSizesForProduct,
  HERO_ASSETS,
} from "@/data/mock-footwear";
import {
  useAllReviewsQuery,
  useCategoriesQuery,
  useProductsQuery,
  useStoreSettingsQuery,
} from "@/hooks/use-store-queries";
import { storeService } from "@/services/store.service";
import { useAuthStore } from "@/stores/auth.store";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import { formatETB } from "@/utils/format";
import { cn } from "@/lib/utils";
import { DEFAULT_FALLBACK_IMAGE, getCardImageUrl } from "@/utils/cloudinary";

const TRENDING_TABS = [
  { id: "all", label: "All Releases" },
  { id: "running", label: "Running" },
  { id: "sneakers", label: "Streetwear" },
  { id: "formal-leather", label: "Formal" },
  { id: "boots", label: "Boots & Trail" },
];

export function HomePageView() {
  const [activeTab, setActiveTab] = React.useState("all");
  const [dropOffset, setDropOffset] = React.useState(0);
  const [vipEmail, setVipEmail] = React.useState("");

  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const { data: liveSettings } = useStoreSettingsQuery();
  const storeSettings = useCatalogStore((s) => s.settings);
  const settings = liveSettings ?? storeSettings;

  const heroImageUrl = settings.heroImageUrl?.trim() || HERO_ASSETS.heroSneaker;
  const heroBadgeText = settings.heroBadgeText?.trim() || "Addis Stock Ready";
  const heroCardSubtitle = settings.heroCardSubtitle?.trim() || "New Arrival • Track Spec";
  const heroCardTitle = settings.heroCardTitle?.trim() || "Addis Velocity Pro Nitro";
  const heroCardPriceText = settings.heroCardPriceText?.trim() || "5,850 ETB";
  const heroCardHref = settings.heroCardHref?.trim() || "/products/addis-velocity-pro-nitro";

  const [isHeroEditOpen, setIsHeroEditOpen] = React.useState(false);
  const [isUploadingHeroImage, setIsUploadingHeroImage] = React.useState(false);
  const [isSavingHero, setIsSavingHero] = React.useState(false);
  const heroFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [heroForm, setHeroForm] = React.useState({
    heroImageUrl: "",
    heroBadgeText: "",
    heroCardSubtitle: "",
    heroCardTitle: "",
    heroCardPriceText: "",
    heroCardHref: "",
  });

  const { data: allProducts = [], isLoading: isProductsLoading } = useProductsQuery();
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategoriesQuery();
  const { data: realReviews = [] } = useAllReviewsQuery();
  const addToast = useUiStore((s) => s.addToast);

  const openHeroEditor = () => {
    if (!isAdmin) return;
    setHeroForm({
      heroImageUrl,
      heroBadgeText,
      heroCardSubtitle,
      heroCardTitle,
      heroCardPriceText,
      heroCardHref,
    });
    setIsHeroEditOpen(true);
  };

  const handleHeroImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast({
        title: "Invalid File Type",
        description: "Please upload a JPG, PNG, or WebP image.",
        variant: "warning",
      });
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast({
        title: "File Too Large",
        description: "Hero image must be smaller than 5 MB.",
        variant: "warning",
      });
      e.target.value = "";
      return;
    }

    setIsUploadingHeroImage(true);
    try {
      const { url } = await storeService.uploadHeroImage(file);
      setHeroForm((f) => ({ ...f, heroImageUrl: url }));
      addToast({
        title: "Hero Image Uploaded",
        description: "Image uploaded to Cloudinary. Click Save Changes to publish.",
        variant: "success",
      });
    } catch (err: unknown) {
      addToast({
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "Could not upload hero image.",
        variant: "error",
      });
    } finally {
      setIsUploadingHeroImage(false);
      e.target.value = "";
    }
  };

  const handleHeroSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (
      !heroForm.heroBadgeText.trim() ||
      !heroForm.heroCardSubtitle.trim() ||
      !heroForm.heroCardTitle.trim() ||
      !heroForm.heroCardPriceText.trim() ||
      !heroForm.heroCardHref.trim()
    ) {
      addToast({
        title: "Required Text Missing",
        description: "Please fill in all hero badge and showcase card text fields.",
        variant: "warning",
      });
      return;
    }

    setIsSavingHero(true);
    try {
      await storeService.updateStoreSettings({
        heroImageUrl: heroForm.heroImageUrl.trim() || null,
        heroBadgeText: heroForm.heroBadgeText.trim(),
        heroCardSubtitle: heroForm.heroCardSubtitle.trim(),
        heroCardTitle: heroForm.heroCardTitle.trim(),
        heroCardPriceText: heroForm.heroCardPriceText.trim(),
        heroCardHref: heroForm.heroCardHref.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      setIsHeroEditOpen(false);
      addToast({
        title: "Homepage Hero Updated",
        description: "The homepage showcase image and texts have been saved.",
        variant: "success",
      });
    } catch (err: unknown) {
      addToast({
        title: "Update Failed",
        description: err instanceof Error ? err.message : "Failed to save homepage hero changes.",
        variant: "error",
      });
    } finally {
      setIsSavingHero(false);
    }
  };

  const featuredCategories = React.useMemo(
    () => categories.filter((c) => c.featured).slice(0, 6),
    [categories],
  );

  const trendingProducts = React.useMemo(() => {
    const filtered =
      activeTab === "all"
        ? allProducts.filter((p) => p.featuredTrending)
        : allProducts.filter((p) => p.categorySlug === activeTab);
    return (filtered.length > 0 ? filtered : allProducts).slice(0, 4);
  }, [allProducts, activeTab]);

  const newDropProducts = React.useMemo(() => {
    const drops = allProducts.filter((p) => p.featuredNewDrop);
    return drops.length >= 3 ? drops : allProducts.slice(0, 6);
  }, [allProducts]);

  const visibleDrops = React.useMemo(() => {
    if (newDropProducts.length <= 3) return newDropProducts;
    const out: typeof newDropProducts = [];
    for (let i = 0; i < 3; i++) {
      const candidate = newDropProducts[(dropOffset + i) % newDropProducts.length];
      if (candidate) out.push(candidate);
    }
    return out;
  }, [newDropProducts, dropOffset]);

  const handleVipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vipEmail.trim()) {
      addToast({
        title: "Enter your email or phone",
        description: "Provide your contact info to unlock your 10% welcome code.",
        variant: "warning",
      });
      return;
    }
    setVipEmail("");
    addToast({
      title: "10% VIP Code Unlocked: WELCOME10",
      description: "Apply WELCOME10 at checkout for 10% off your inaugural order.",
      variant: "success",
    });
  };

  return (
    <div className="flex w-full flex-col">
      {/* 1. HERO SECTION: Editorial High-Impact Split */}
      <section className="relative w-full overflow-hidden bg-surface-low">
        <div className="mx-auto max-w-[1360px] px-4 py-10 sm:py-14 lg:px-8 lg:py-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            {/* Left Editorial Copy (7 cols) */}
            <div className="z-10 flex flex-col space-y-5 lg:col-span-7">
              <div className="inline-flex items-center gap-2 self-start rounded-full bg-surface-container px-4 py-1.5">
                <span className="size-2 animate-pulse rounded-full bg-cta" />
                <span className="font-label text-[11px] font-bold tracking-widest text-primary uppercase">
                  Drop 04 // Spring 2025 Edition
                </span>
              </div>

              <div className="space-y-3">
                <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-[72px] lg:leading-[76px]">
                  STEP INTO <br />
                  <span className="text-primary italic">YOUR STYLE.</span>
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Discover footwear that combines athletic performance engineering, uncompromised
                  comfort, and raw city elegance. Handpicked and certified authentic in Addis Ababa.
                </p>
              </div>

              {/* Hero CTAs */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 rounded-full bg-cta px-7 py-3.5 font-label text-sm font-bold tracking-wide text-cta-foreground shadow-md transition-all hover:-translate-y-0.5 hover:bg-cta-hover active:scale-95"
                >
                  <span>Shop Collection</span>
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/category/new-arrivals"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3.5 font-label text-sm font-bold text-primary shadow-card transition-all hover:border-primary hover:bg-surface-container"
                >
                  <Flame className="size-4 text-cta" />
                  <span>Explore New Drops</span>
                </Link>
              </div>

              {/* Micro Trust Bar */}
              <div className="grid grid-cols-2 gap-4 pt-5 sm:grid-cols-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-primary shadow-card">
                    <Zap className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label text-xs font-bold text-foreground">
                      Same-Day Addis
                    </span>
                    <span className="text-xs text-muted-foreground">Express courier</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-primary shadow-card">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label text-xs font-bold text-foreground">
                      100% Genuine
                    </span>
                    <span className="text-xs text-muted-foreground">Certified origins</span>
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-2.5 sm:col-span-1">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-cta shadow-card">
                    <Wallet className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label text-xs font-bold text-foreground">
                      Telebirr &amp; CBE
                    </span>
                    <span className="text-xs text-muted-foreground">Cash on arrival</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Hero Visual Showcase (5 cols) */}
            <div className="relative lg:col-span-5">
              <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 shadow-xl">
                <div className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-primary/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-cta/15 blur-2xl" />

                <div className="relative flex h-[380px] sm:h-[430px] w-full items-center justify-center overflow-hidden rounded-xl bg-surface-container">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroImageUrl}
                    alt={heroCardTitle}
                    className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />

                  {/* Floating Interactive Price Pill */}
                  <Link
                    href={heroCardHref}
                    className="absolute right-4 bottom-4 left-4 flex items-center justify-between rounded-xl border border-border/70 bg-surface/95 p-3.5 shadow-lg backdrop-blur-md transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex flex-col">
                      <span className="font-label text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        {heroCardSubtitle}
                      </span>
                      <span className="font-display text-base font-bold text-foreground">
                        {heroCardTitle}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-display text-base font-extrabold text-primary">
                        {heroCardPriceText}
                      </span>
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover">
                        <ArrowUpRight className="size-4" />
                      </span>
                    </div>
                  </Link>
                </div>

                {/* Top Floating Row: Admin-Only Edit Button + Stock Badge */}
                <div className="pointer-events-none absolute top-7 right-7 left-7 flex items-center justify-between gap-2">
                  {isAdmin ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={openHeroEditor}
                      aria-label="Edit homepage hero showcase"
                      className="pointer-events-auto h-8 gap-1.5 rounded-full border border-border/80 bg-surface/95 px-3 text-xs font-bold text-foreground shadow-md backdrop-blur-md hover:bg-primary hover:text-primary-foreground"
                    >
                      <Pencil className="size-3.5" />
                      <span>Edit</span>
                    </Button>
                  ) : (
                    <span />
                  )}

                  <div className="rounded-full border border-border/60 bg-surface/90 px-3 py-1 shadow-sm backdrop-blur-md">
                    <span className="flex items-center gap-1.5 font-label text-[11px] font-bold text-primary">
                      <span className="size-1.5 rounded-full bg-cta" />
                      {heroBadgeText}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FEATURED CATEGORIES: 6-Grid Bento */}
      <section className="w-full bg-background py-14 lg:py-16">
        <div className="mx-auto max-w-[1360px] px-4 lg:px-8">
          <div className="mb-9 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="font-label text-xs font-bold tracking-widest text-cta uppercase">
                Curated Classifications
              </span>
              <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Explore By Craft &amp; Purpose
              </h2>
            </div>
            <Link
              href="/shop"
              className="group inline-flex items-center gap-1.5 font-label text-xs font-bold text-primary hover:text-primary-hover"
            >
              <span>View All Curated Silhouettes</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {isCategoriesLoading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-card min-h-[180px] space-y-4"
                  >
                    <div className="space-y-2">
                      <SkeletonBase className="h-3 w-20 rounded-md" />
                      <SkeletonBase className="h-6 w-40 rounded-md" />
                    </div>
                    <div className="flex items-center justify-between">
                      <SkeletonBase className="h-4 w-24 rounded-md" />
                      <SkeletonBase className="size-9 rounded-full" />
                    </div>
                  </div>
                ))
              : featuredCategories.map((cat, idx) => (
                  <CategoryCard key={cat.id} category={cat} index={idx} />
                ))}
          </div>
        </div>
      </section>

      {/* 3. TRENDING NOW: Filterable Product Showcase */}
      <section id="trending" className="w-full bg-surface-low py-14 lg:py-16">
        <div className="mx-auto max-w-[1360px] px-4 lg:px-8">
          <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <span className="font-label text-xs font-bold tracking-widest text-cta uppercase">
                In High Demand
              </span>
              <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Trending Footwear
              </h2>
            </div>

            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
              {TRENDING_TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "rounded-full px-4 py-2 font-label text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-surface text-foreground hover:border-primary hover:bg-primary-light",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {isProductsLoading ? (
            <SkeletonProductGrid count={4} columns={4} variant="home" />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {trendingProducts.map((product) => (
                <ProductCard key={product.id} product={product} variant="home" />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. MID-PAGE EDITORIAL BANNER: The Addis Run Lab */}
      <section className="w-full bg-background py-14 lg:py-16">
        <div className="mx-auto max-w-[1360px] px-4 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-primary-deep text-white shadow-2xl">
            <div className="grid min-h-[460px] grid-cols-1 lg:grid-cols-12">
              {/* Left Text Block */}
              <div className="z-10 flex flex-col justify-between space-y-8 p-8 sm:p-12 lg:col-span-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-cta" />
                    <span className="font-label text-xs font-bold tracking-widest text-banner-accent uppercase">
                      The Addis Run Lab
                    </span>
                  </div>
                  <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[44px] lg:leading-[50px]">
                    YOUR NEXT FAVORITE PAIR IS HERE.
                  </h2>
                  <p className="max-w-md text-sm leading-relaxed text-banner-muted/90">
                    Rooted in the legendary altitude endurance of Ethiopian athletes and sculpted
                    for the fast-paced streets of Bole and Kazanchis. Built with zero compromise on
                    breathability and stability.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-8">
                    <div>
                      <span className="font-display text-3xl font-extrabold text-banner-warm">
                        2,400m
                      </span>
                      <p className="text-xs text-banner-accent/80">Altitude Proven</p>
                    </div>
                    <div>
                      <span className="font-display text-3xl font-extrabold text-banner-warm">
                        &lt; 185g
                      </span>
                      <p className="text-xs text-banner-accent/80">Ultralight Chassis</p>
                    </div>
                  </div>
                  <div>
                    <Link
                      href="/category/running"
                      className="inline-flex items-center gap-2 rounded-full bg-cta px-7 py-3.5 font-label text-sm font-bold text-white shadow-lg transition-all hover:bg-cta-hover"
                    >
                      <span>Shop The Highland Edit</span>
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Right Editorial Visual */}
              <div className="relative min-h-[340px] lg:col-span-7 lg:min-h-full">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url("${HERO_ASSETS.runLabBanner}")` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-primary-deep via-primary-deep/35 to-transparent" />

                <div className="absolute right-6 bottom-6 hidden max-w-xs rounded-xl border border-white/20 bg-surface/95 p-4 text-foreground shadow-xl backdrop-blur-xl sm:block">
                  <div className="flex items-center gap-1.5 font-label text-[11px] font-bold text-cta uppercase">
                    <MapPin className="size-3.5" />
                    <span>Entoto Ridge • Altitude 2,800m</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    &ldquo;Tested against steep pine gravel tracks. The grip response on the Addis
                    Velocity series is unmatched.&rdquo;
                  </p>
                  <div className="mt-2.5 flex items-center justify-between font-label text-[11px]">
                    <span className="font-bold text-primary">Kenna B., Marathon Pacer</span>
                    <span className="text-muted-foreground">Verified Test</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. NEW DROPS & LIMITED SILHOUETTES */}
      <section id="new-drops" className="w-full bg-surface-low py-14 lg:py-16">
        <div className="mx-auto max-w-[1360px] px-4 lg:px-8">
          <div className="mb-9 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="font-label text-xs font-bold tracking-widest text-primary uppercase">
                Weekly Fresh Stock
              </span>
              <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                New Drops &amp; Limited Silhouettes
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous new drops"
                onClick={() =>
                  setDropOffset((prev) =>
                    prev === 0 ? Math.max(0, newDropProducts.length - 1) : prev - 1,
                  )
                }
                className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-card transition-colors hover:bg-surface-container cursor-pointer"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next new drops"
                onClick={() => setDropOffset((prev) => (prev + 1) % newDropProducts.length)}
                className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-colors hover:bg-primary-hover cursor-pointer"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>

          {isProductsLoading ? (
            <SkeletonProductGrid count={3} columns={3} variant="home" />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {visibleDrops.map((drop) => {
                const sizes = getAvailableSizesForProduct(drop);
                return (
                  <div
                    key={drop.id}
                    className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-card transition-all hover:shadow-card-hover"
                  >
                    <div className="space-y-3.5">
                      <Link
                        href={`/products/${drop.slug}`}
                        className="relative flex h-64 items-center justify-center overflow-hidden rounded-lg bg-surface-media"
                      >
                        <Badge
                          variant={drop.isOnSale ? "cta" : "default"}
                          className="absolute top-3 left-3 z-10"
                        >
                          {drop.badges[0] ?? "Limited Drop"}
                        </Badge>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getCardImageUrl(drop.colorways[0]?.images[0])}
                          alt={drop.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                          }}
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </Link>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-label text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                            {drop.brand}
                          </span>
                          <span className="font-display text-base font-extrabold text-primary">
                            {formatETB(drop.priceETB)}
                          </span>
                        </div>
                        <Link href={`/products/${drop.slug}`}>
                          <h3 className="font-display text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                            {drop.name}
                          </h3>
                        </Link>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{drop.tagline}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3.5">
                      <span className="font-label text-[11px] font-semibold text-muted-foreground">
                        Sizes: {sizes.slice(0, 5).join(" • ")}
                      </span>
                      <Link
                        href={`/products/${drop.slug}`}
                        className="inline-flex items-center gap-1 font-label text-xs font-bold text-primary hover:text-primary-hover"
                      >
                        <span>Reserve Pair</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 6. WHY SHOP WITH US: 4 Trust Pillars */}
      <section className="w-full bg-background py-14 lg:py-16">
        <div className="mx-auto max-w-[1360px] px-4 lg:px-8">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <span className="font-label text-xs font-bold tracking-widest text-cta uppercase">
              The AddisGebeya Promise
            </span>
            <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Engineered Authenticity, Seamless Service
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every silhouette is physically verified by our Bole footwear specialists before
              doorstep dispatch.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: ShieldCheck,
                title: "100% Quality Footwear",
                desc: "Guaranteed genuine leather, technical mesh, and factory-authorized foam cushioning. Zero counterfeits tolerated.",
                footer: "Verified Serial Codes",
                ctaAccent: false,
              },
              {
                icon: Wallet,
                title: "Secure Local Payment",
                desc: "Effortless checkout via Telebirr, CBE Birr QR, direct Awash transfer, or inspect & pay Cash on Delivery.",
                footer: "Pay on Doorstep Available",
                ctaAccent: true,
              },
              {
                icon: Truck,
                title: "Addis & Regional Speed",
                desc: "Same-day motorbike dispatch across Addis Ababa. Reliable 48-hour secure cargo to Hawassa, Bahir Dar & Adama.",
                footer: "Free Over 3,500 ETB",
                ctaAccent: false,
              },
              {
                icon: Headphones,
                title: "Dedicated Concierge",
                desc: "Need sizing advice or fit comparison? Direct telephone and WhatsApp consultation from our Bole showroom staff.",
                footer: "Instant WhatsApp Help",
                ctaAccent: true,
              },
            ].map(({ icon: Icon, title, desc, footer, ctaAccent }) => (
              <div
                key={title}
                className="flex flex-col justify-between space-y-3 rounded-xl border border-border bg-surface p-6 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <div className="space-y-3">
                  <div
                    className={cn(
                      "flex size-12 items-center justify-center rounded-xl bg-surface-low",
                      ctaAccent ? "text-cta" : "text-primary",
                    )}
                  >
                    <Icon className="size-6" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 pt-2 font-label text-xs font-bold",
                    ctaAccent ? "text-cta" : "text-primary",
                  )}
                >
                  <span>{footer}</span>
                  {ctaAccent && title.includes("Concierge") ? (
                    <MessageCircle className="size-3.5" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. VERIFIED ADDIS REVIEWS */}
      <section className="w-full bg-surface-low py-14 lg:py-16">
        <div className="mx-auto max-w-[1360px] px-4 lg:px-8">
          <div className="mb-9 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="font-label text-xs font-bold tracking-widest text-cta uppercase">
                Community Voices
              </span>
              <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Verified Addis Reviews
              </h2>
            </div>

            <div className="flex items-center gap-2.5 self-start rounded-full border border-border bg-surface px-4 py-2 shadow-card md:self-auto">
              <div className="flex text-cta">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-cta text-cta" />
                ))}
              </div>
              <span className="font-label text-xs font-bold text-foreground">
                4.92 / 5.0 Rating Across 1,480+ Orders
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {realReviews.slice(0, 4).map((review) => (
              <div
                key={review.id}
                className="flex flex-col justify-between space-y-4 rounded-xl border border-border bg-surface p-6 shadow-card"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-0.5 text-cta">
                    {Array.from({ length: review.rating || 5 }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-cta text-cta" />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed italic text-muted-foreground line-clamp-3">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  {review.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={review.photoUrl}
                      alt={review.authorName}
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">
                      {review.authorInitials}
                    </div>
                  )}
                  <div>
                    <p className="font-label text-xs font-bold text-foreground">{review.authorName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {review.location} • EU {review.purchasedSize}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. NEWSLETTER & VIP CLUB INVITATION */}
      <section className="w-full bg-background py-14 lg:py-16">
        <div className="mx-auto max-w-[1360px] px-4 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-deep via-primary to-primary-hover p-8 text-white shadow-xl sm:p-12 lg:p-16">
            <div className="pointer-events-none absolute -right-20 -bottom-20 size-96 rounded-full bg-cta/25 blur-3xl" />
            <div className="pointer-events-none absolute -top-20 -left-20 size-80 rounded-full bg-banner-accent/15 blur-2xl" />

            <div className="relative z-10 mx-auto max-w-2xl space-y-5 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 backdrop-blur-sm">
                <ShieldCheck className="size-4 text-banner-warm" />
                <span className="font-label text-xs font-bold tracking-wider text-banner-warm uppercase">
                  AddisGebeya VIP Circle
                </span>
              </div>

              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[42px] lg:leading-[48px]">
                BE FIRST TO KNOW WHEN THE NEXT SNEAKER DROPS.
              </h2>

              <p className="mx-auto max-w-lg text-sm text-banner-muted/90 sm:text-base">
                Get 10% off your inaugural footwear order, early access to weekly limited sneaker
                runs, and invites to Bole private styling sessions.
              </p>

              <form
                onSubmit={handleVipSubmit}
                className="mx-auto flex max-w-md flex-col items-center gap-2.5 pt-2 sm:flex-row"
              >
                <div className="relative w-full">
                  <Mail className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={vipEmail}
                    onChange={(e) => setVipEmail(e.target.value)}
                    placeholder="Enter your email address..."
                    aria-label="VIP Circle email"
                    className="h-12 w-full rounded-full bg-surface pr-4 pl-11 text-sm text-foreground placeholder:text-muted-foreground shadow-inner focus:ring-2 focus:ring-cta focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="h-12 w-full shrink-0 rounded-full bg-cta px-7 font-label text-xs font-bold tracking-wider uppercase text-white shadow-md transition-colors hover:bg-cta-hover sm:w-auto cursor-pointer"
                >
                  Claim 10%
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-1 font-label text-xs text-banner-accent/80">
                <span className="flex items-center gap-1">
                  <Lock className="size-3.5" /> No spam ever
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <XCircle className="size-3.5" /> Unsubscribe anytime
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Zap className="size-3.5" /> Instant coupon code
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Admin-Only Right Hero Showcase Editor */}
      {isAdmin ? (
        <ModalDialog
          open={isHeroEditOpen}
          onClose={() => setIsHeroEditOpen(false)}
          title="Edit Homepage Hero Showcase"
          description="Only administrators can edit the right-side hero image and featured card text."
          className="max-w-xl"
        >
          <form onSubmit={handleHeroSave} className="space-y-4 text-xs">
            <div className="space-y-2">
              <label className="block font-semibold text-foreground">
                Right-Side Hero Image Preview
              </label>
              <div className="relative h-48 w-full overflow-hidden rounded-xl border border-border bg-surface-container">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroForm.heroImageUrl.trim() || HERO_ASSETS.heroSneaker}
                  alt={heroForm.heroCardTitle || "Homepage hero preview"}
                  className="size-full object-cover"
                />
              </div>
              <input
                ref={heroFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleHeroImageFileChange}
                className="hidden"
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingHeroImage || isSavingHero}
                  onClick={() => heroFileInputRef.current?.click()}
                >
                  {isUploadingHeroImage ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  <span>{isUploadingHeroImage ? "Uploading..." : "Upload New Image"}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isUploadingHeroImage || isSavingHero}
                  onClick={() =>
                    setHeroForm((f) => ({ ...f, heroImageUrl: HERO_ASSETS.heroSneaker }))
                  }
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset Default Image</span>
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-foreground">Image URL</label>
              <Input
                value={heroForm.heroImageUrl}
                onChange={(e) =>
                  setHeroForm((f) => ({ ...f, heroImageUrl: e.target.value }))
                }
                placeholder="https://... or /images/..."
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block font-semibold text-foreground">
                  Top Stock Badge Text *
                </label>
                <Input
                  value={heroForm.heroBadgeText}
                  onChange={(e) =>
                    setHeroForm((f) => ({ ...f, heroBadgeText: e.target.value }))
                  }
                  placeholder="Addis Stock Ready"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block font-semibold text-foreground">
                  Bottom Card Subtitle *
                </label>
                <Input
                  value={heroForm.heroCardSubtitle}
                  onChange={(e) =>
                    setHeroForm((f) => ({ ...f, heroCardSubtitle: e.target.value }))
                  }
                  placeholder="New Arrival • Track Spec"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block font-semibold text-foreground">
                  Featured Card Title *
                </label>
                <Input
                  value={heroForm.heroCardTitle}
                  onChange={(e) =>
                    setHeroForm((f) => ({ ...f, heroCardTitle: e.target.value }))
                  }
                  placeholder="Addis Velocity Pro Nitro"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block font-semibold text-foreground">
                  Price / Highlight Text *
                </label>
                <Input
                  value={heroForm.heroCardPriceText}
                  onChange={(e) =>
                    setHeroForm((f) => ({ ...f, heroCardPriceText: e.target.value }))
                  }
                  placeholder="5,850 ETB"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-foreground">
                Featured Card Link Path *
              </label>
              <Input
                value={heroForm.heroCardHref}
                onChange={(e) =>
                  setHeroForm((f) => ({ ...f, heroCardHref: e.target.value }))
                }
                placeholder="/products/addis-velocity-pro-nitro"
                required
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSavingHero}
                onClick={() => setIsHeroEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="cta"
                size="sm"
                disabled={isSavingHero || isUploadingHeroImage}
              >
                {isSavingHero ? <Loader2 className="size-3.5 animate-spin" /> : null}
                <span>{isSavingHero ? "Saving..." : "Save Changes"}</span>
              </Button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
