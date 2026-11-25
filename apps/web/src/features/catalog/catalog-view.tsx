"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Filter,
  Grid2X2,
  Grid3X3,
  Headphones,
  Home,
  MessageCircle,
  Percent,
  RefreshCw,
  Ruler,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { ProductGrid } from "@/components/shared/product-grid";
import { SizeGuideModal } from "@/components/shared/size-guide-modal";
import { Button } from "@/components/ui/button";
import { SkeletonBase } from "@/components/ui/skeleton";
import { EU_SIZES } from "@/data/mock-footwear";
import { useCategoriesQuery, useProductsQuery } from "@/hooks/use-store-queries";
import type { ProductQueryFilters } from "@/services/store.service";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import { SHOE_GENDERS, SHOE_TYPES } from "@/types/store.types";
import { cn } from "@/lib/utils";

const COLOR_TONES = [
  { label: "Midnight Navy", hex: "#14284B" },
  { label: "Coral Red", hex: "#D4441A" },
  { label: "Obsidian", hex: "#11202B" },
  { label: "Pure White", hex: "#FFFFFF" },
  { label: "Desert Sand", hex: "#D4B59E" },
  { label: "Slate Grey", hex: "#5B6670" },
];

interface CatalogViewProps {
  initialCategorySlug?: string;
  pageTitle?: string;
  pageSubtitle?: string;
  heroBannerImage?: string;
}

export function CatalogView({
  initialCategorySlug = "all",
  pageTitle = "Curated Footwear Vault",
  pageSubtitle,
  heroBannerImage,
}: CatalogViewProps) {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";

  const [manualSearch, setManualSearch] = React.useState<string | null>(null);
  const search = manualSearch ?? urlQuery;
  const setSearch = (val: string) => setManualSearch(val);

  const [categorySlug, setCategorySlug] = React.useState(initialCategorySlug);
  const [gender, setGender] = React.useState<string>("All");
  const [shoeType, setShoeType] = React.useState<string>("All");
  const [brand, setBrand] = React.useState<string>("All");
  const [selectedSize, setSelectedSize] = React.useState<number | undefined>(undefined);
  const [selectedColor, setSelectedColor] = React.useState<string | undefined>(undefined);
  const [minPrice, setMinPrice] = React.useState<number>(0);
  const [maxPrice, setMaxPrice] = React.useState<number>(25000);
  const [inStockOnly, setInStockOnly] = React.useState<boolean>(true);
  const [onSaleOnly, setOnSaleOnly] = React.useState<boolean>(initialCategorySlug === "sale");
  const [sortBy, setSortBy] =
    React.useState<NonNullable<ProductQueryFilters["sortBy"]>>("featured");
  const [gridCols, setGridCols] = React.useState<3 | 4>(4);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(8);
  const [sizeGuideOpen, setSizeGuideOpen] = React.useState(false);

  const { isMobileFilterOpen, setMobileFilterOpen } = useUiStore();
  const allStoreProducts = useCatalogStore((s) => s.products);
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategoriesQuery();

  const filters: ProductQueryFilters = React.useMemo(
    () => ({
      search: search || undefined,
      categorySlug,
      gender,
      shoeType: shoeType === "All" ? undefined : shoeType,
      brand,
      size: selectedSize,
      colorHex: selectedColor,
      minPrice,
      maxPrice,
      inStockOnly,
      onSaleOnly,
      sortBy,
    }),
    [
      search,
      categorySlug,
      gender,
      shoeType,
      brand,
      selectedSize,
      selectedColor,
      minPrice,
      maxPrice,
      inStockOnly,
      onSaleOnly,
      sortBy,
    ],
  );

  const { data: products = [], isLoading } = useProductsQuery(filters);

  const brands = React.useMemo(() => {
    const set = new Set(allStoreProducts.map((p) => p.brand));
    return ["All", ...Array.from(set)];
  }, [allStoreProducts]);

  const filterSizes = React.useMemo(() => {
    const sizeSet = new Set<number>(EU_SIZES);
    for (const p of allStoreProducts) {
      for (const cw of p.colorways) {
        for (const sz of Object.keys(cw.stockBySize)) {
          const parsed = Number(sz);
          if (Number.isFinite(parsed) && parsed > 0) sizeSet.add(parsed);
        }
      }
    }
    return Array.from(sizeSet).sort((a, b) => a - b);
  }, [allStoreProducts]);

  const sizeStockMap = React.useMemo(() => {
    const map: Record<number, number> = {};
    for (const sz of filterSizes) {
      map[sz] = allStoreProducts.reduce(
        (acc, p) => acc + p.colorways.reduce((s, cw) => s + (cw.stockBySize[sz] ?? 0), 0),
        0,
      );
    }
    return map;
  }, [allStoreProducts, filterSizes]);

  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = products.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage,
  );

  const activeFilterCount =
    (categorySlug !== "all" ? 1 : 0) +
    (gender !== "All" ? 1 : 0) +
    (shoeType !== "All" ? 1 : 0) +
    (brand !== "All" ? 1 : 0) +
    (selectedSize ? 1 : 0) +
    (selectedColor ? 1 : 0) +
    (onSaleOnly ? 1 : 0) +
    (search ? 1 : 0);

  const resetAllFilters = () => {
    setSearch("");
    setCategorySlug(initialCategorySlug === "all" ? "all" : initialCategorySlug);
    setGender("All");
    setShoeType("All");
    setBrand("All");
    setSelectedSize(undefined);
    setSelectedColor(undefined);
    setMinPrice(0);
    setMaxPrice(25000);
    setInStockOnly(true);
    setOnSaleOnly(false);
    setCurrentPage(1);
  };

  const sidebarContent = (
    <div className="space-y-5">
      <div className="space-y-6 rounded-xl border border-border bg-surface p-5 shadow-card">
        {/* Category Filter */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-label text-xs font-extrabold tracking-wider text-primary uppercase">
              Category
            </h3>
            <span className="font-label text-[11px] text-muted-foreground">
              {categories.length} types
            </span>
          </div>
          <div className="space-y-1">
            {isCategoriesLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <SkeletonBase className="h-4 w-28 rounded-md" />
                  <SkeletonBase className="h-4 w-6 rounded-md" />
                </div>
              ))
            ) : (
              [
                { slug: "all", name: "All Footwear" },
                ...categories.filter((c) => !["men", "women"].includes(c.slug)),
              ].map((cat) => {
                const checked = categorySlug === cat.slug;
                const count =
                  cat.slug === "all"
                    ? allStoreProducts.length
                    : allStoreProducts.filter((p) => p.categorySlug === cat.slug).length;
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => {
                      setCategorySlug(cat.slug);
                      setCurrentPage(1);
                    }}
                    className="flex w-full items-center justify-between rounded-lg py-1.5 text-left transition-colors hover:text-primary cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-sm border transition-colors",
                          checked
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-surface-low",
                        )}
                      >
                        {checked ? <Check className="size-3" /> : null}
                      </span>
                      <span className={cn("text-sm", checked ? "font-bold text-primary" : "")}>
                        {cat.name}
                      </span>
                    </span>
                    <span className="rounded-full bg-surface-low px-2 py-0.5 font-label text-[11px] font-semibold text-muted-foreground">
                      {count}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Gender Filter */}
        <div className="space-y-2.5">
          <h3 className="font-label text-xs font-extrabold tracking-wider text-primary uppercase">
            Gender
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {["All", ...SHOE_GENDERS].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGender(g);
                  setCurrentPage(1);
                }}
                className={cn(
                  "rounded-lg py-1.5 px-2.5 font-label text-xs font-bold transition-all cursor-pointer",
                  gender === g
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-surface-low text-foreground hover:bg-surface-container",
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Shoe Type Filter */}
        <div className="space-y-2">
          <h3 className="font-label text-xs font-extrabold tracking-wider text-primary uppercase">
            Shoe Type
          </h3>
          <select
            value={shoeType}
            onChange={(e) => {
              setShoeType(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by shoe type"
            className="h-10 w-full rounded-lg border border-border bg-surface-low px-3 text-xs font-semibold text-foreground focus:border-primary focus:outline-none cursor-pointer"
          >
            <option value="All">All Shoe Styles</option>
            {SHOE_TYPES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div className="h-px bg-border" />

        {/* Brand Filter */}
        <div className="space-y-2">
          <h3 className="font-label text-xs font-extrabold tracking-wider text-primary uppercase">
            Brand / Line
          </h3>
          <select
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by brand"
            className="h-10 w-full rounded-lg border border-border bg-surface-low px-3 text-xs font-semibold text-foreground focus:border-primary focus:outline-none cursor-pointer"
          >
            {brands.map((b) => (
              <option key={b} value={b}>
                {b === "All" ? "All AddisGebeya Lines" : b}
              </option>
            ))}
          </select>
        </div>

        <div className="h-px bg-border" />

        {/* EU Size Selector Grid */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-label text-xs font-extrabold tracking-wider text-primary uppercase">
              <Ruler className="size-3.5 text-cta" /> Size (EU)
            </h3>
            <button
              type="button"
              onClick={() => setSizeGuideOpen(true)}
              className="font-label text-[11px] font-bold text-cta hover:underline cursor-pointer"
            >
              Size Chart
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {filterSizes.map((sz) => {
              const totalPairs = sizeStockMap[sz] ?? 0;
              const isOut = totalPairs <= 0;
              const isSelected = selectedSize === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  disabled={isOut}
                  onClick={() => {
                    setSelectedSize(isSelected ? undefined : sz);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-lg border py-2 text-center transition-all",
                    isOut &&
                    "cursor-not-allowed border-border/60 bg-muted/50 text-muted-foreground/45 overflow-hidden",
                    !isOut &&
                    !isSelected &&
                    "cursor-pointer border-border bg-surface-low/60 text-foreground hover:border-primary hover:bg-surface-container",
                    isSelected &&
                    "cursor-pointer border-primary bg-primary text-primary-foreground shadow-sm",
                  )}
                >
                  {isOut ? (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="h-px w-[140%] -rotate-45 bg-muted-foreground/40" />
                    </span>
                  ) : null}
                  <span className="font-label text-xs font-bold">{sz}</span>
                  <span
                    className={cn(
                      "text-[10px]",
                      isSelected
                        ? "text-banner-accent"
                        : isOut
                          ? "text-muted-foreground/60"
                          : totalPairs <= 4
                            ? "text-cta"
                            : "text-primary",
                    )}
                  >
                    {isOut ? "Sold out" : isSelected ? "Selected" : "In stock"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Price Range in ETB */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-label text-xs font-extrabold tracking-wider text-primary uppercase">
              Price Range
            </h3>
            <span className="font-label text-xs font-bold text-primary">ETB</span>
          </div>
          <input
            type="range"
            min={0}
            max={25000}
            step={250}
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(Number(e.target.value));
              setCurrentPage(1);
            }}
            aria-label="Maximum price in ETB"
            className="w-full accent-primary cursor-pointer"
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-surface-low/60 p-2">
              <span className="block font-label text-[10px] text-muted-foreground uppercase">
                Min ETB
              </span>
              <input
                type="number"
                value={minPrice}
                min={0}
                max={maxPrice}
                onChange={(e) => setMinPrice(Number(e.target.value) || 0)}
                className="w-full bg-transparent font-display text-sm font-bold text-foreground focus:outline-none"
              />
            </div>
            <div className="rounded-lg border border-border bg-surface-low/60 p-2">
              <span className="block font-label text-[10px] text-muted-foreground uppercase">
                Max ETB
              </span>
              <input
                type="number"
                value={maxPrice}
                min={minPrice}
                max={50000}
                onChange={(e) => setMaxPrice(Number(e.target.value) || 25000)}
                className="w-full bg-transparent font-display text-sm font-bold text-foreground focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Color Swatches */}
        <div className="space-y-2.5">
          <h3 className="font-label text-xs font-extrabold tracking-wider text-primary uppercase">
            Color Tone
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {COLOR_TONES.map((tone) => {
              const active = selectedColor === tone.hex;
              return (
                <button
                  key={tone.hex}
                  type="button"
                  onClick={() => {
                    setSelectedColor(active ? undefined : tone.hex);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-2 text-left transition-all cursor-pointer",
                    active
                      ? "border-primary bg-primary-light font-bold text-primary"
                      : "border-border/70 bg-surface-low/50 text-foreground hover:bg-surface-container",
                  )}
                >
                  <span
                    className="size-4 shrink-0 rounded-full border border-border shadow-xs"
                    style={{ backgroundColor: tone.hex }}
                  />
                  <span className="truncate font-label text-[11px]">{tone.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Availability & Sale */}
        <div className="space-y-2.5">
          <h3 className="font-label text-xs font-extrabold tracking-wider text-primary uppercase">
            Availability
          </h3>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => {
                setInStockOnly(e.target.checked);
                setCurrentPage(1);
              }}
              className="size-4 rounded accent-primary"
            />
            <span className="font-medium text-foreground">In Stock Only (Addis Hub)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={onSaleOnly}
              onChange={(e) => {
                setOnSaleOnly(e.target.checked);
                setCurrentPage(1);
              }}
              className="size-4 rounded accent-cta"
            />
            <span className="inline-flex items-center gap-1 font-bold text-cta">
              On Sale (12%+ Off) <Percent className="size-3.5" />
            </span>
          </label>
        </div>
      </div>

      {/* Telegram VIP Drop Alert Widget */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-deep p-5 text-white shadow-md">
        <div className="relative z-10 space-y-2">
          <span className="block font-label text-[10px] font-bold tracking-wider text-banner-accent uppercase">
            Exclusive Drops
          </span>
          <h4 className="font-display text-base font-bold leading-snug">
            Addis Sneaker Telegram Bot
          </h4>
          <p className="text-xs leading-relaxed text-banner-muted/85">
            Get 15-minute early notifications before rare size runs sell out in Bole.
          </p>
          <Link
            href="/contact"
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-cta px-4 py-1.5 font-label text-[11px] font-bold uppercase text-white shadow-sm hover:bg-cta-hover transition-colors"
          >
            <span>Join Channel</span>
            <Send className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex w-full flex-col">
      {/* Top Flash Drop Promo Banner */}
      <div className="w-full bg-primary-deep px-4 py-2 text-white lg:px-8">
        <div className="mx-auto flex max-w-[1360px] flex-col items-center justify-between gap-1.5 text-center md:flex-row md:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="rounded-full bg-cta px-2.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider">
              Flash Drop
            </span>
            <span className="text-banner-muted">
              Addis Ababa Express Dispatch: Order within <strong className="text-banner-warm">03h 42m</strong>{" "}
              for same-day delivery across Bole, Kazanchis &amp; Sarbet.
            </span>
          </div>
          <div className="hidden items-center gap-4 font-label text-[11px] text-banner-muted lg:flex">
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-banner-warm" /> Guaranteed 100% Authentic
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <RefreshCw className="size-3.5 text-banner-accent" /> Size Exchange
            </span>
          </div>
        </div>
      </div>

      {/* Category Editorial Banner (if viewing category page) */}
      {heroBannerImage ? (
        <div className="relative h-52 sm:h-64 w-full overflow-hidden bg-primary-deep">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-50"
            style={{ backgroundImage: `url("${heroBannerImage}")` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-deep via-primary-deep/75 to-transparent" />
          <div className="relative z-10 mx-auto flex h-full max-w-[1360px] flex-col justify-center px-4 text-white lg:px-8">
            <nav
              aria-label="Breadcrumb"
              className="mb-2 flex items-center gap-2 font-label text-xs text-banner-accent"
            >
              <Link href="/" className="hover:text-white">
                Home
              </Link>
              <span>/</span>
              <Link href="/shop" className="hover:text-white">
                Shop All
              </Link>
              <span>/</span>
              <span className="font-bold text-white">{pageTitle}</span>
            </nav>
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {pageTitle}
            </h1>
            {pageSubtitle ? (
              <p className="mt-2 max-w-xl text-sm text-banner-muted/90">{pageSubtitle}</p>
            ) : null}
          </div>
        </div>
      ) : (
        /* Breadcrumb & Catalog Title Hero Bar */
        <section className="w-full border-b border-border bg-surface px-4 py-5 shadow-xs lg:px-8">
          <div className="mx-auto flex max-w-[1360px] flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="space-y-1">
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-2 font-label text-xs text-muted-foreground"
              >
                <Link href="/" className="inline-flex items-center gap-1 hover:text-primary">
                  <Home className="size-3.5" /> Home
                </Link>
                <span>/</span>
                <span className="font-bold text-primary">{pageTitle}</span>
              </nav>
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
                  {pageTitle}
                </h1>
                <span className="rounded-full bg-primary-light px-3 py-0.5 font-label text-xs font-bold text-primary">
                  Showing {products.length} curated styles
                </span>
              </div>
            </div>

            {/* Quick Category Pills */}
            <div className="no-scrollbar flex max-w-full items-center gap-2 overflow-x-auto pb-1">
              {[
                { slug: "all", label: "All Footwear" },
                { slug: "sneakers", label: "Sneakers" },
                { slug: "running", label: "Running Pro" },
                { slug: "formal-leather", label: "Formal Leather" },
                { slug: "boots", label: "Boots & Trail" },
              ].map((pill) => (
                <button
                  key={pill.slug}
                  type="button"
                  onClick={() => {
                    setCategorySlug(pill.slug);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "rounded-full px-4 py-1.5 font-label text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    categorySlug === pill.slug
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-surface-low text-foreground hover:bg-surface-container",
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Filter & Sort Control Bar */}
      <section className="w-full px-4 py-5 lg:px-8">
        <div className="mx-auto flex max-w-[1360px] flex-col justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-card lg:flex-row lg:items-center">
          {/* Active Filter Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1 font-label text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              <Filter className="size-3.5" /> Active:
            </span>

            {inStockOnly ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-label text-xs font-semibold text-primary">
                <span className="size-1.5 rounded-full bg-cta" />
                In Stock
                <button
                  type="button"
                  onClick={() => setInStockOnly(false)}
                  aria-label="Remove In Stock filter"
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}

            {search ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-label text-xs font-semibold text-primary">
                Query: &ldquo;{search}&rdquo;
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}

            {categorySlug !== "all" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-label text-xs font-semibold text-primary capitalize">
                Category: {categorySlug.replace(/-/g, " ")}
                <button
                  type="button"
                  onClick={() => setCategorySlug("all")}
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}

            {shoeType !== "All" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-label text-xs font-semibold text-primary">
                Style: {shoeType}
                <button
                  type="button"
                  onClick={() => setShoeType("All")}
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}

            {selectedSize ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-label text-xs font-semibold text-primary">
                Size: EU {selectedSize}
                <button
                  type="button"
                  onClick={() => setSelectedSize(undefined)}
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}

            {onSaleOnly ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cta-light px-3 py-1 font-label text-xs font-bold text-cta-text">
                On Sale
                <button
                  type="button"
                  onClick={() => setOnSaleOnly(false)}
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}

            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={resetAllFilters}
                className="ml-1 font-label text-xs font-bold text-cta underline hover:text-cta-hover cursor-pointer"
              >
                Clear all filters
              </button>
            ) : null}
          </div>

          {/* Sort & View Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            <div className="flex items-center gap-2">
              <label
                htmlFor="catalog-sort"
                className="font-label text-xs font-semibold text-muted-foreground"
              >
                Sort by:
              </label>
              <select
                id="catalog-sort"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as NonNullable<ProductQueryFilters["sortBy"]>)
                }
                className="rounded-full border border-border bg-surface-low py-1.5 pr-7 pl-3.5 font-label text-xs font-bold text-foreground focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="featured">Featured Curation</option>
                <option value="newest">Newest Drops</option>
                <option value="best_selling">Best Selling in Addis</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>

            <div className="hidden h-6 w-px bg-border sm:block" />

            <div className="hidden items-center gap-1 rounded-full bg-surface-low p-1 sm:flex">
              <button
                type="button"
                onClick={() => setGridCols(4)}
                aria-label="4-column compact view"
                className={cn(
                  "rounded-full p-1.5 transition-all cursor-pointer",
                  gridCols === 4
                    ? "bg-surface text-primary shadow-sm"
                    : "text-muted-foreground hover:text-primary",
                )}
              >
                <Grid2X2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setGridCols(3)}
                aria-label="3-column editorial view"
                className={cn(
                  "rounded-full p-1.5 transition-all cursor-pointer",
                  gridCols === 3
                    ? "bg-surface text-primary shadow-sm"
                    : "text-muted-foreground hover:text-primary",
                )}
              >
                <Grid3X3 className="size-4" />
              </button>
            </div>

            {/* Mobile Filter Drawer Trigger */}
            <Button
              type="button"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileFilterOpen(true)}
            >
              <SlidersHorizontal className="size-3.5" />
              Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
            </Button>
          </div>
        </div>
      </section>

      {/* Main Catalog Area: Sidebar + Product Grid */}
      <section className="w-full px-4 pb-16 lg:px-8">
        <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Desktop Sticky Sidebar */}
          <aside className="hidden lg:sticky lg:top-28 lg:col-span-3 lg:block">
            {sidebarContent}
          </aside>

          {/* Mobile Filter Drawer */}
          {isMobileFilterOpen ? (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-xs"
                onClick={() => setMobileFilterOpen(false)}
              />
              <div className="relative z-10 flex h-full w-full max-w-xs flex-col overflow-y-auto bg-background p-4 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-foreground">Filter Shoes</h2>
                  <button
                    type="button"
                    onClick={() => setMobileFilterOpen(false)}
                    className="rounded-full bg-surface p-1.5 text-foreground"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                {sidebarContent}
                <div className="sticky bottom-0 mt-4 bg-background pt-3">
                  <Button
                    type="button"
                    variant="cta"
                    className="w-full"
                    onClick={() => setMobileFilterOpen(false)}
                  >
                    Show {products.length} Results
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Product Grid + Pagination + Concierge */}
          <div className="space-y-8 lg:col-span-9">
            <ProductGrid
              products={paginatedProducts}
              columns={gridCols}
              isLoading={isLoading}
              emptyAction={
                <Button type="button" onClick={resetAllFilters}>
                  Reset All Filters
                </Button>
              }
            />

            {/* Pagination Bar */}
            {products.length > 0 ? (
              <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-card sm:flex-row">
                <span className="text-xs text-muted-foreground">
                  Showing{" "}
                  <strong className="text-foreground">
                    {(safePage - 1) * itemsPerPage + 1} -{" "}
                    {Math.min(safePage * itemsPerPage, products.length)}
                  </strong>{" "}
                  of <strong className="text-foreground">{products.length}</strong> footwear
                  releases
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="flex size-9 items-center justify-center rounded-full bg-surface-low text-foreground transition-colors hover:bg-surface-container disabled:opacity-40 cursor-pointer"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "flex size-9 items-center justify-center rounded-full font-label text-xs font-bold transition-colors cursor-pointer",
                          safePage === pageNum
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-surface-low text-foreground hover:bg-surface-container",
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="flex size-9 items-center justify-center rounded-full bg-surface-low text-foreground transition-colors hover:bg-surface-container disabled:opacity-40 cursor-pointer"
                  >
                    ›
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-label text-xs text-muted-foreground">Per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-border bg-surface-low px-2.5 py-1 font-label text-xs font-bold text-foreground cursor-pointer"
                  >
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                  </select>
                </div>
              </div>
            ) : null}

            {/* Bottom Live Concierge Banner */}
            <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-border bg-gradient-to-r from-surface via-surface-low to-surface-container p-6 shadow-card md:flex-row">
              <div className="flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                  <Headphones className="size-7" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="size-2 animate-pulse rounded-full bg-cta" />
                    <span className="font-label text-[11px] font-bold tracking-wider text-cta uppercase">
                      Live Concierge in Addis
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-primary">
                    Can&apos;t find your exact shoe size or colorway?
                  </h3>
                  <p className="max-w-xl text-xs text-muted-foreground">
                    Our in-house Addis stylists are standing by at our Bole flagship studio. We
                    check showroom stock and arrange VIP allocations directly to your door.
                  </p>
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-auto sm:flex-row">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary-hover"
                >
                  <Send className="size-3.5" /> Contact Concierge
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 font-label text-xs font-bold text-white shadow-sm hover:bg-[#20bd5a]"
                >
                  <MessageCircle className="size-3.5" /> WhatsApp Store
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SizeGuideModal
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        selectedSize={selectedSize}
      />
    </div>
  );
}
