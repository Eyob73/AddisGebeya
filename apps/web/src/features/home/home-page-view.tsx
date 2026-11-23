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
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  Truck,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { CategoryCard } from "@/components/shared/category-card";
import { ProductCard } from "@/components/shared/product-card";
import { Badge } from "@/components/ui/badge";
import {
  getAvailableSizesForProduct,
  HERO_ASSETS,
  HOME_TESTIMONIALS,
} from "@/data/mock-footwear";
import { useCategoriesQuery, useProductsQuery } from "@/hooks/use-store-queries";
import { useUiStore } from "@/stores/ui.store";
import { formatETB } from "@/utils/format";
import { cn } from "@/lib/utils";

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

  const { data: allProducts = [] } = useProductsQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const addToast = useUiStore((s) => s.addToast);

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
                    src={HERO_ASSETS.heroSneaker}
                    alt="Addis Velocity Pro Nitro running sneaker"
                    className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />

                  {/* Floating Interactive Price Pill */}
                  <Link
                    href="/products/addis-velocity-pro-nitro"
                    className="absolute right-4 bottom-4 left-4 flex items-center justify-between rounded-xl border border-border/70 bg-surface/95 p-3.5 shadow-lg backdrop-blur-md transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex flex-col">
                      <span className="font-label text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        New Arrival • Track Spec
                      </span>
                      <span className="font-display text-base font-bold text-foreground">
                        Addis Velocity Pro Nitro
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-display text-base font-extrabold text-primary">
                        5,850 ETB
                      </span>
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover">
                        <ArrowUpRight className="size-4" />
                      </span>
                    </div>
                  </Link>
                </div>

                {/* Floating Micro Stock Badge */}
                <div className="absolute top-7 right-7 rounded-full border border-border/60 bg-surface/90 px-3 py-1 shadow-sm backdrop-blur-md">
                  <span className="flex items-center gap-1.5 font-label text-[11px] font-bold text-primary">
                    <span className="size-1.5 rounded-full bg-cta" />
                    Addis Stock Ready
                  </span>
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
            {featuredCategories.map((cat, idx) => (
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

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {trendingProducts.map((product) => (
              <ProductCard key={product.id} product={product} variant="home" />
            ))}
          </div>
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
                    <span className="font-label text-xs font-bold tracking-widest text-[#B0ECFF] uppercase">
                      The Addis Run Lab
                    </span>
                  </div>
                  <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[44px] lg:leading-[50px]">
                    YOUR NEXT FAVORITE PAIR IS HERE.
                  </h2>
                  <p className="max-w-md text-sm leading-relaxed text-[#EBF6F8]/90">
                    Rooted in the legendary altitude endurance of Ethiopian athletes and sculpted
                    for the fast-paced streets of Bole and Kazanchis. Built with zero compromise on
                    breathability and stability.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-8">
                    <div>
                      <span className="font-display text-3xl font-extrabold text-[#FFDBD0]">
                        2,400m
                      </span>
                      <p className="text-xs text-[#91D0E4]">Altitude Proven</p>
                    </div>
                    <div>
                      <span className="font-display text-3xl font-extrabold text-[#FFDBD0]">
                        &lt; 185g
                      </span>
                      <p className="text-xs text-[#91D0E4]">Ultralight Chassis</p>
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
                        src={drop.colorways[0]?.images[0]}
                        alt={drop.name}
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
            {HOME_TESTIMONIALS.map((review) => (
              <div
                key={review.name}
                className="flex flex-col justify-between space-y-4 rounded-xl border border-border bg-surface p-6 shadow-card"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-0.5 text-cta">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-cta text-cta" />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed italic text-muted-foreground">
                    &ldquo;{review.quote}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={review.avatar}
                    alt={review.name}
                    className="size-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-label text-xs font-bold text-foreground">{review.name}</p>
                    <p className="text-[11px] text-muted-foreground">Bought: {review.bought}</p>
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
            <div className="pointer-events-none absolute -top-20 -left-20 size-80 rounded-full bg-[#B0ECFF]/15 blur-2xl" />

            <div className="relative z-10 mx-auto max-w-2xl space-y-5 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 backdrop-blur-sm">
                <ShieldCheck className="size-4 text-[#FFDBD0]" />
                <span className="font-label text-xs font-bold tracking-wider text-[#FFDBD0] uppercase">
                  AddisGebeya VIP Circle
                </span>
              </div>

              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[42px] lg:leading-[48px]">
                BE FIRST TO KNOW WHEN THE NEXT SNEAKER DROPS.
              </h2>

              <p className="mx-auto max-w-lg text-sm text-[#EBF6F8]/90 sm:text-base">
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

              <div className="flex flex-wrap items-center justify-center gap-4 pt-1 font-label text-xs text-[#91D0E4]">
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
    </div>
  );
}
