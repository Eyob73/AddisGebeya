"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Droplets,
  Flame,
  Leaf,
  Mountain,
  Plus,
  Recycle,
  RefreshCw,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Star,
  ThumbsUp,
  Truck,
  Wallet,
  Wind,
  Zap,
  ZoomIn,
} from "lucide-react";
import { ColorSelector } from "@/components/shared/color-selector";
import { PriceDisplay } from "@/components/shared/price-display";
import { ProductCard } from "@/components/shared/product-card";
import { Rating } from "@/components/shared/rating";
import { SizeGuideModal } from "@/components/shared/size-guide-modal";
import { SizeSelector } from "@/components/shared/size-selector";
import { WishlistButton } from "@/components/shared/wishlist-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea } from "@/components/ui/input";
import { HERO_ASSETS } from "@/data/mock-footwear";
import {
  useProductDetailQuery,
  useProductReviewsQuery,
  useProductsQuery,
} from "@/hooks/use-store-queries";
import { storeService } from "@/services/store.service";
import { useAuthStore } from "@/stores/auth.store";
import { useCartStore } from "@/stores/cart.store";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import { ProductDetailPageSkeleton } from "@/components/shared/page-skeletons";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FALLBACK_IMAGE,
  getDetailImageUrl,
  getThumbnailImageUrl,
} from "@/utils/cloudinary";

const GALLERY_LABELS = ["Profile", "Side View", "Top Box", "Sole Tread", "Heel Unit", "On-Foot"];

export function ProductDetailView({ slug }: { slug: string }) {
  const router = useRouter();
  const { data: product, isLoading } = useProductDetailQuery(slug);
  const { data: allProducts = [] } = useProductsQuery();
  const { data: dbReviews = [], refetch: refetchReviews } = useProductReviewsQuery(product?.id);
  const addItem = useCartStore((s) => s.addItem);
  const addToast = useUiStore((s) => s.addToast);
  const user = useAuthStore((s) => s.user);

  const [selectedColorId, setSelectedColorId] = React.useState<string>("");
  const [activeImageIdx, setActiveImageIdx] = React.useState(0);
  const [manualSize, setManualSize] = React.useState<number | null>(null);
  const [quantity, setQuantity] = React.useState(1);
  const [addedFeedback, setAddedFeedback] = React.useState(false);
  const [openAccordion, setOpenAccordion] = React.useState<number | null>(0);
  const [activeTab, setActiveTab] = React.useState<"overview" | "materials" | "fit" | "care">(
    "overview",
  );
  const [reviewFilter, setReviewFilter] = React.useState<"all" | "photos" | "five">("all");
  const [sizeGuideOpen, setSizeGuideOpen] = React.useState(false);
  const [zoomOpen, setZoomOpen] = React.useState(false);
  const [reviewModalOpen, setReviewModalOpen] = React.useState(false);
  const [reviewTitle, setReviewTitle] = React.useState("");
  const [reviewBody, setReviewBody] = React.useState("");
  const [reviewRating, setReviewRating] = React.useState(5);

  const activeColorway = React.useMemo(() => {
    if (!product) return undefined;
    if (selectedColorId) {
      const explicit = product.colorways.find((c) => c.id === selectedColorId);
      if (explicit) return explicit;
    }
    return (
      product.colorways.find((c) =>
        Object.values(c.stockBySize).some((qty) => Number(qty) > 0),
      ) ?? product.colorways[0]
    );
  }, [product, selectedColorId]);

  const configuredSizes = React.useMemo(() => {
    if (!activeColorway) return [];
    const keys = Object.keys(activeColorway.stockBySize)
      .map((sz) => Number(sz))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
    return keys;
  }, [activeColorway]);

  const availableSizes = React.useMemo(() => {
    if (!activeColorway) return [];
    return Object.entries(activeColorway.stockBySize)
      .filter(([, q]) => q > 0)
      .map(([sz]) => Number(sz))
      .sort((a, b) => a - b);
  }, [activeColorway]);

  const selectedSize =
    manualSize !== null && availableSizes.includes(manualSize)
      ? manualSize
      : availableSizes.includes(42)
        ? 42
        : (availableSizes[0] ?? null);

  const sizeStock = selectedSize && activeColorway ? (activeColorway.stockBySize[selectedSize] ?? 0) : 0;
  const maxAllowedQty = Math.min(5, Math.max(1, sizeStock));

  const handleSelectColorway = (cwId: string) => {
    setSelectedColorId(cwId);
    setActiveImageIdx(0);
    setQuantity(1);
  };

  const productReviews = React.useMemo(() => {
    if (!product) return [];
    const list = dbReviews;
    if (reviewFilter === "photos") return list.filter((r) => Boolean(r.photoUrl));
    if (reviewFilter === "five") return list.filter((r) => r.rating === 5);
    return list;
  }, [product, dbReviews, reviewFilter]);

  const relatedProducts = React.useMemo(() => {
    if (!product) return [];
    return allProducts.filter((p) => p.id !== product.id).slice(0, 4);
  }, [allProducts, product]);

  if (isLoading) {
    return <ProductDetailPageSkeleton />;
  }

  if (!product || !activeColorway) {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-16 lg:px-8">
        <EmptyState
          icon={ShoppingBag}
          title="Shoe Model Not Found"
          description="This footwear release may have been archived or moved. Explore our live Addis Ababa footwear vault."
          action={
            <Button asChild>
              <Link href="/shop">Browse Footwear Vault</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const unassignedProductImages =
    product.productImages?.filter((img) => !img.colorwayId).map((img) => img.imageUrl) ?? [];
  const allProductImageUrls = product.productImages?.map((img) => img.imageUrl) ?? [];
  const galleryImages =
    activeColorway.images.length > 0
      ? activeColorway.images
      : unassignedProductImages.length > 0
        ? unassignedProductImages
        : allProductImageUrls.length > 0
          ? allProductImageUrls
          : [HERO_ASSETS.heroSneaker];
  const currentHeroImage = galleryImages[activeImageIdx] ?? galleryImages[0];

  const handleAddToBag = (buyNow = false) => {
    if (!selectedSize || sizeStock <= 0) {
      addToast({
        title: "Please select an available EU size",
        description: "Sold-out sizes cannot be purchased. Choose an in-stock size.",
        variant: "warning",
      });
      return;
    }

    const result = addItem(product, activeColorway.id, selectedSize, quantity, sizeStock);
    if (!result.ok) {
      addToast({ title: "Cannot Add Pair", description: result.message, variant: "warning" });
      return;
    }

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
    addToast({ title: "Added to Shopping Bag", description: result.message, variant: "success" });

    if (buyNow) {
      router.push("/checkout");
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !reviewTitle.trim() || !reviewBody.trim()) return;
    const author = user?.name ?? "Addis Runner";
    try {
      await storeService.addReview({
        productId: product.id,
        authorName: author,
        location: user?.subCity ? `Addis Ababa, ${user.subCity.split(" ")[0]}` : "Addis Ababa, Bole",
        purchasedSize: selectedSize ?? 42,
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewBody.trim(),
      });
      await refetchReviews();
      setReviewTitle("");
      setReviewBody("");
      setReviewModalOpen(false);
      addToast({
        title: "Review Published",
        description: "Thank you for sharing your fit experience with AddisGebeya!",
        variant: "success",
      });
    } catch {
      addToast({
        title: "Submission Error",
        description: "Could not submit review. Please try again.",
        variant: "error",
      });
    }
  };

  return (
    <div className="flex w-full flex-col">
      {/* Top Bole Special Delivery Bar */}
      <div className="w-full border-b border-border/70 bg-surface-low px-4 py-2 text-xs lg:px-8">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-cta-light font-bold text-cta-text">
              <Zap className="size-3" />
            </span>
            <span className="font-bold text-foreground">BOLE SPECIAL:</span>
            <span>
              Same-day hand delivery to Bole, Kazanchis, CMC &amp; Sarbet if ordered before 3:00 PM
            </span>
          </div>
          <div className="hidden items-center gap-4 font-label text-xs font-bold text-primary md:flex">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3.5" /> Addis Authentic Escrow
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Truck className="size-3.5" /> Free Delivery in Addis Ababa
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1360px] px-4 py-7 lg:px-8">
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-1.5 font-label text-xs text-muted-foreground"
        >
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <ChevronRight className="size-3.5" />
          <Link href={`/category/${product.categorySlug}`} className="hover:text-primary">
            {product.categoryName}
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="truncate font-bold text-foreground">{product.name}</span>
        </nav>

        {/* Two-Column Master Product Section */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
          {/* LEFT COLUMN: Footwear Gallery (7 cols) */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:col-span-7">
            <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-card">
              {/* Overlay Badges */}
              <div className="absolute top-5 left-5 z-10 flex flex-col items-start gap-1.5">
                {product.badges.find((b) => b.trim().toLowerCase() !== "ethiopian made") ? (
                  <Badge variant="cta">
                    {product.badges.find((b) => b.trim().toLowerCase() !== "ethiopian made")}
                  </Badge>
                ) : null}
                <Badge variant="default">
                  <ShieldCheck className="size-3" /> 100% Genuine Certified
                </Badge>
              </div>

              {/* Zoom Trigger */}
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                aria-label="Zoom product image"
                className="absolute top-5 right-5 z-10 flex size-10 items-center justify-center rounded-full border border-border/70 bg-surface/90 text-primary shadow-md backdrop-blur-md transition-all hover:bg-primary hover:text-white cursor-pointer"
              >
                <ZoomIn className="size-4" />
              </button>

              {/* Main Hero Display Frame */}
              <div className="relative flex h-[360px] sm:h-[480px] w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-surface-low/80 to-surface-container/40">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
                  <span className="font-display text-[110px] sm:text-[150px] font-extrabold tracking-widest text-primary uppercase">
                    ADDIS
                  </span>
                </div>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getDetailImageUrl(currentHeroImage)}
                  alt={`${product.name} — ${activeColorway.name}`}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                  }}
                  className="max-h-[380px] w-4/5 select-none object-contain drop-shadow-[0_24px_34px_rgba(0,65,79,0.18)] transition-transform duration-500 group-hover:scale-105"
                />

                <div className="absolute right-4 bottom-4 left-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface/85 px-3 py-1.5 font-label text-[11px] backdrop-blur-sm">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    In Stock at Bole Showroom
                  </span>
                  <span className="font-mono text-muted-foreground">SKU: {product.sku}</span>
                </div>
              </div>
            </div>

            {/* Perspective Thumbnails */}
            {galleryImages.length > 1 ? (
              <div className="grid grid-cols-5 gap-2.5 sm:grid-cols-6">
                {galleryImages.map((imgUrl, idx) => (
                  <button
                    key={`${imgUrl}-${idx}`}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={cn(
                      "group/thumb overflow-hidden rounded-xl border bg-surface p-1.5 transition-all cursor-pointer",
                      activeImageIdx === idx
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/60",
                    )}
                  >
                    <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-surface-low p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getThumbnailImageUrl(imgUrl)}
                        alt={`${product.name} angle ${idx + 1}`}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                        }}
                        className="size-full object-contain transition-transform group-hover/thumb:scale-105"
                      />
                    </div>
                    <span className="mt-1 block truncate text-center font-label text-[10px] font-semibold text-muted-foreground">
                      {GALLERY_LABELS[idx] ?? `View ${idx + 1}`}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {/* 3 Athletic Feature Callouts Strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                  <Wind className="size-5" />
                </div>
                <div>
                  <p className="font-label text-[10px] font-bold text-muted-foreground uppercase">
                    Upper Mesh
                  </p>
                  <p className="font-display text-xs font-bold text-foreground">
                    {product.specs.upperMesh}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cta-light text-cta-text">
                  <Zap className="size-5" />
                </div>
                <div>
                  <p className="font-label text-[10px] font-bold text-muted-foreground uppercase">
                    Cushioning
                  </p>
                  <p className="font-display text-xs font-bold text-foreground">
                    {product.specs.cushioning}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
                  <Mountain className="size-5" />
                </div>
                <div>
                  <p className="font-label text-[10px] font-bold text-muted-foreground uppercase">
                    Outsole Grip
                  </p>
                  <p className="font-display text-xs font-bold text-foreground">
                    {product.specs.outsoleGrip}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Purchase Buy Box (5 cols) */}
          <div className="lg:col-span-5">
            <div className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-label text-xs font-extrabold tracking-widest text-primary uppercase">
                  {product.brand} • {product.shoeType || product.categoryName}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="soft">{product.gender}</Badge>
                  <span className="inline-flex items-center gap-1 rounded-full bg-cta-light px-2.5 py-0.5 font-label text-[11px] font-bold text-cta-text">
                    <Flame className="size-3.5" /> {sizeStock > 0 ? `${sizeStock} in stock` : "High Demand"}
                  </span>
                </div>
              </div>

              <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                {product.name}
              </h1>

              {(product.material || product.specs.materials.length > 0) ? (
                <p className="font-label text-xs font-medium text-muted-foreground">
                  Material:{" "}
                  <span className="font-semibold text-foreground">
                    {product.material || product.specs.materials.join(" • ")}
                  </span>
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Rating rating={product.rating} variant="full" />
                <span className="text-muted-foreground">•</span>
                <a
                  href="#reviews-section"
                  className="font-label text-xs font-bold text-primary underline underline-offset-4 hover:text-primary-hover"
                >
                  {product.reviewCount} verified Ethiopian reviews
                </a>
              </div>

              {/* ETB Pricing Bar */}
              <div className="rounded-xl bg-surface-low p-4">
                <PriceDisplay
                  priceETB={product.priceETB}
                  compareAtPriceETB={product.compareAtPriceETB}
                  size="hero"
                  showSavingsBadge
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Inclusive of 15% Ethiopian VAT. Free delivery across Addis Ababa.
                </p>
              </div>

              {/* Colorway Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-label font-bold tracking-wider text-muted-foreground uppercase">
                    Colorway:
                  </span>
                  <span className="font-label font-bold text-foreground">
                    {activeColorway.name}
                  </span>
                </div>
                <ColorSelector
                  colorways={product.colorways}
                  selectedColorwayId={activeColorway.id}
                  onSelect={handleSelectColorway}
                  size="md"
                />
              </div>

              {/* Size-Specific Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-label text-xs">
                    <span className="font-bold tracking-wider text-muted-foreground uppercase">
                      Select Size (EU):
                    </span>
                    <span className="font-bold text-cta">
                      {selectedSize ? `EU ${selectedSize} (${sizeStock} pairs left)` : "Sold Out"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSizeGuideOpen(true)}
                    className="inline-flex items-center gap-1 font-label text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    <Ruler className="size-3.5" /> Size Guide &amp; Fit
                  </button>
                </div>

                <SizeSelector
                  stockBySize={activeColorway.stockBySize}
                  sizes={configuredSizes}
                  selectedSize={selectedSize}
                  onSelect={(sz) => {
                    setManualSize(sz);
                    setQuantity(1);
                  }}
                />

                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span>{product.specs.fitAdvice}</span>
                </p>
              </div>

              {/* Quantity Picker */}
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-label text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Quantity:
                </span>
                <div className="flex items-center rounded-full border border-border bg-surface-low p-1">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex size-8 items-center justify-center rounded-full bg-surface font-bold text-foreground hover:bg-surface-container cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-display text-sm font-bold text-foreground">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((q) => Math.min(maxAllowedQty, q + 1))}
                    className="flex size-8 items-center justify-center rounded-full bg-surface font-bold text-foreground hover:bg-surface-container cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <span className="font-label text-xs text-muted-foreground">
                  Max {maxAllowedQty} {maxAllowedQty === 1 ? "pair" : "pairs"} available
                </span>
              </div>

              {/* Primary CTAs */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={!selectedSize || sizeStock <= 0}
                    onClick={() => handleAddToBag(false)}
                    className={cn(
                      "flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 font-label text-sm font-bold text-white shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                      addedFeedback ? "bg-emerald-600" : "bg-cta hover:bg-cta-hover",
                    )}
                  >
                    {addedFeedback ? (
                      <>
                        <Check className="size-5" />
                        <span>Added to Bag!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="size-5" />
                        <span>Add to Shopping Bag</span>
                      </>
                    )}
                  </button>
                  <WishlistButton productId={product.id} productName={product.name} size="lg" />
                </div>

                <Button
                  type="button"
                  size="lg"
                  disabled={!selectedSize || sizeStock <= 0}
                  onClick={() => handleAddToBag(true)}
                  className="w-full"
                >
                  <Zap className="size-4" />
                  <span>Buy Now</span>
                </Button>
              </div>

              {/* Value Propositions Accordions */}
              <div className="space-y-2 pt-2">
                {[
                  {
                    icon: Truck,
                    title: "Fast Addis Delivery: 3-6 hrs / Next-day",
                    body: "We dispatch with dedicated motorcycle couriers throughout all 10 sub-cities in Addis Ababa. Outer areas (Akaki, Kaliti, Sebeta) and regional hubs arrive within 24-48 hours.",
                  },
                  {
                    icon: Wallet,
                    title: "Telebirr, CBE Birr or Cash On Delivery",
                    body: "Inspect and try on your sneakers before completing payment. We accept Telebirr QR, CBE Birr mobile transfer, Awash Bank, or cash directly to our delivery courier.",
                  },
                  {
                    icon: RefreshCw,
                    title: "Size Exchange at Bole Showroom",
                    body: "If the fit isn't 100% ideal, visit our flagship lounge near Bole Medhanialem or request a free courier size exchange at your doorstep within 7 days.",
                  },
                ].map((acc, idx) => {
                  const Icon = acc.icon;
                  const open = openAccordion === idx;
                  return (
                    <div key={acc.title} className="rounded-xl bg-surface-low p-3.5">
                      <button
                        type="button"
                        onClick={() => setOpenAccordion(open ? null : idx)}
                        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Icon className="size-4" />
                          </span>
                          <span className="font-display text-xs sm:text-sm font-bold text-foreground">
                            {acc.title}
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            open && "rotate-180",
                          )}
                        />
                      </button>
                      {open ? (
                        <p className="mt-2.5 pl-10 text-xs leading-relaxed text-muted-foreground">
                          {acc.body}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* DETAILED PRODUCT TABS */}
        <section className="mt-14 rounded-2xl border border-border bg-surface p-6 shadow-card lg:p-8">
          <div className="no-scrollbar flex items-center gap-2.5 overflow-x-auto pb-2">
            {[
              { id: "overview" as const, label: "Engineering & Technology" },
              { id: "materials" as const, label: "Materials & Sustainability" },
              { id: "fit" as const, label: "Size & Fit Recommendations" },
              { id: "care" as const, label: "Care & Maintenance" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "shrink-0 rounded-full px-5 py-2.5 font-label text-xs font-bold transition-all cursor-pointer",
                  activeTab === t.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-surface-low text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" ? (
            <div className="mt-6 grid grid-cols-1 items-center gap-8 md:grid-cols-12">
              <div className="space-y-4 md:col-span-7">
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Engineered for High-Altitude Paces and City Demands
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {product.description}
                </p>
                <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-surface-low p-4">
                    <span className="font-display text-sm font-bold text-primary">
                      {product.specs.cushioning}
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reinforced medial arch support engineered for all-day Addis comfort.
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-low p-4">
                    <span className="font-display text-sm font-bold text-primary">
                      {product.specs.outsoleGrip}
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Formulated for wet tarmac, highland gravel, and urban cobblestone.
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-low p-4">
                    <span className="font-display text-sm font-bold text-primary">
                      Weight: {product.specs.weightGrams} Grams
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Balanced lightweight footprint measured on standard size EU 42.
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-low p-4">
                    <span className="font-display text-sm font-bold text-primary">
                      Heel Drop: {product.specs.heelDropMm}mm
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Biomechanical balance optimized for smooth heel-to-toe transition.
                    </p>
                  </div>
                </div>
              </div>
              <div className="md:col-span-5">
                <div className="relative h-72 overflow-hidden rounded-xl bg-surface-container shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={HERO_ASSETS.techExploded}
                    alt="Technical footwear structure"
                    className="size-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 rounded-lg bg-surface/90 px-3 py-1.5 text-xs font-bold text-primary backdrop-blur-md">
                    {product.specs.cushioning} Architecture
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "materials" ? (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                {
                  icon: Recycle,
                  title: product.specs.materials[0] ?? "78% Recycled Poly Yarn",
                  desc: "Selected for breathable structural integrity, abrasion resistance, and lower environmental footprint.",
                },
                {
                  icon: Droplets,
                  title: product.specs.materials[1] ?? "Low-Impact Botanical Dyes",
                  desc: "Colorways are treated with water-saving non-toxic finishes calibrated for vivid longevity.",
                },
                {
                  icon: Leaf,
                  title: product.specs.materials[2] ?? "Organic Ortholite Insole",
                  desc: "Anti-microbial footbed delivering persistent step-in cushioning from Bole to Entoto.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="space-y-2 rounded-xl bg-surface-low p-5">
                  <div className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h4 className="font-display text-sm font-bold text-foreground">{title}</h4>
                  <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "fit" ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col items-start justify-between gap-4 rounded-xl bg-surface-low p-5 md:flex-row md:items-center">
                <div>
                  <h4 className="font-display text-base font-bold text-foreground">
                    Fit Recommendation &amp; Anatomy
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">{product.specs.fitAdvice}</p>
                </div>
                <Button type="button" size="sm" onClick={() => setSizeGuideOpen(true)}>
                  View Complete Ethiopian Size Grid
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 text-xs text-muted-foreground sm:grid-cols-3">
                <div className="rounded-xl bg-surface-container/60 p-4">
                  <span className="mb-1 block font-bold text-foreground">Standard / Narrow Feet</span>
                  Order your exact standard EU size for a locked-in performance fit.
                </div>
                <div className="rounded-xl bg-surface-container/60 p-4">
                  <span className="mb-1 block font-bold text-foreground">Wide Forefoot</span>
                  We recommend ordering one full EU size up for long-distance marathon comfort.
                </div>
                <div className="rounded-xl bg-surface-container/60 p-4">
                  <span className="mb-1 block font-bold text-foreground">In-Between Sizes</span>
                  If you normally wear 42.5, opt for EU 43 or test two sizes with our Bole courier.
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "care" ? (
            <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                Wipe off dust or road dirt after wear using a damp microfiber cloth and mild soapy
                water or the AddisGebeya Pro Foam Sneaker Cleaner Kit.
              </li>
              <li>
                Never machine wash or tumble dry; high heat compromises nitrogen cushioning foams
                and natural leather adhesives.
              </li>
              <li>
                Remove insoles to air-dry naturally at room temperature away from direct midday sun.
              </li>
            </ul>
          ) : null}
        </section>

        {/* VERIFIED CUSTOMER REVIEWS */}
        <section
          id="reviews-section"
          className="mt-14 rounded-2xl border border-border bg-surface p-6 shadow-card lg:p-8"
        >
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
                Customer Feedback &amp; Experiences
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                From runners climbing Entoto trails to stylish daily wear across Bole and Kazanchis.
              </p>
            </div>
            <Button type="button" onClick={() => setReviewModalOpen(true)}>
              Write a Review
            </Button>
          </div>

          {/* Rating Breakdown */}
          <div className="mb-8 grid grid-cols-1 items-center gap-6 rounded-xl bg-surface-low p-6 lg:grid-cols-12">
            <div className="flex flex-col items-center text-center lg:col-span-4">
              <span className="font-display text-6xl font-extrabold leading-none text-primary">
                {product.rating.toFixed(1)}
              </span>
              <div className="mt-2 flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-5 fill-amber-500 text-amber-500" />
                ))}
              </div>
              <span className="mt-1.5 font-label text-xs font-semibold text-muted-foreground">
                Based on {product.reviewCount} Ethiopian verified buyers
              </span>
              <span className="mt-1 font-label text-xs font-bold text-emerald-600">
                98% would recommend to a friend
              </span>
            </div>

            <div className="space-y-2 lg:col-span-8">
              {[
                { label: "5 Stars", pct: 88, count: Math.round(product.reviewCount * 0.88) },
                { label: "4 Stars", pct: 9, count: Math.round(product.reviewCount * 0.09) },
                { label: "3 Stars", pct: 2, count: Math.round(product.reviewCount * 0.02) },
                { label: "2 Stars", pct: 1, count: Math.max(0, Math.round(product.reviewCount * 0.01)) },
                { label: "1 Star", pct: 0, count: 0 },
              ].map((bar) => (
                <div key={bar.label} className="flex items-center gap-3 font-label text-xs">
                  <span className="w-14 font-bold text-foreground">{bar.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${bar.pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-muted-foreground">
                    {bar.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Community Runner Photo Strip */}
          {productReviews.some((r) => r.photoUrl) ? (
            <div className="mb-8">
              <h3 className="mb-3 font-display text-base font-bold text-foreground">
                Photos from Addis Ababa Runners
              </h3>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                {productReviews
                  .filter((r) => r.photoUrl)
                  .slice(0, 6)
                  .map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square overflow-hidden rounded-xl bg-surface-container shadow-xs"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.photoUrl}
                        alt={`Runner photo by ${photo.authorName}`}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute right-1.5 bottom-1.5 rounded bg-surface/85 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                        {photo.authorName.split(" ")[0]}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {/* Review Filter Pills */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "all" as const, label: `All Reviews (${productReviews.length})` },
                { id: "photos" as const, label: "With Photos" },
                { id: "five" as const, label: "5 Stars Only" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setReviewFilter(pill.id)}
                  className={cn(
                    "rounded-full px-4 py-1.5 font-label text-xs font-bold transition-colors cursor-pointer",
                    reviewFilter === pill.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-low text-muted-foreground hover:text-foreground",
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Review Feed */}
          <div className="space-y-4">
            {productReviews.map((rev) => (
              <div key={rev.id} className="space-y-2.5 rounded-xl bg-surface-low/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">
                      {rev.authorInitials}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-display text-sm font-bold text-foreground">
                          {rev.authorName}
                        </h4>
                        {rev.verified ? (
                          <Badge variant="success">Verified Buyer</Badge>
                        ) : null}
                      </div>
                      <p className="font-label text-[11px] text-muted-foreground">
                        {rev.location} • Purchased Size: EU {rev.purchasedSize} • {rev.dateLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {Array.from({ length: rev.rating }).map((_, i) => (
                      <Star key={i} className="size-4 fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                </div>
                <h5 className="font-display text-sm font-bold text-foreground">
                  &ldquo;{rev.title}&rdquo;
                </h5>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {rev.comment}
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await storeService.markHelpful(rev.id);
                      refetchReviews();
                      addToast({
                        title: "Feedback Recorded",
                        description: "Thanks for rating this review as helpful.",
                        variant: "success",
                      });
                    }}
                    className="inline-flex items-center gap-1.5 font-label text-xs font-semibold text-muted-foreground hover:text-primary cursor-pointer"
                  >
                    <ThumbsUp className="size-3.5" />
                    Helpful ({rev.helpfulCount})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COMPLETE THE LOOK / RELATED FOOTWEAR */}
        <section className="mt-14 pb-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <span className="font-label text-xs font-bold tracking-widest text-cta uppercase">
                Curated Performance Pairings
              </span>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
                Complete the Look &amp; Similar Drops
              </h2>
            </div>
            <Link
              href="/shop"
              className="font-label text-xs font-bold text-primary hover:underline"
            >
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} variant="catalog" />
            ))}
          </div>
        </section>
      </div>

      {/* Modals */}
      <SizeGuideModal
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        selectedSize={selectedSize}
      />

      <ModalDialog
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        title={`${product.name} — ${activeColorway.name}`}
        className="max-w-3xl"
      >
        <div className="flex items-center justify-center rounded-xl bg-surface-low p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getDetailImageUrl(currentHeroImage)}
            alt={product.name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
            }}
            className="max-h-[60vh] w-full object-contain"
          />
        </div>
      </ModalDialog>

      <ModalDialog
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`Review ${product.name}`}
        description="Share your sizing, comfort, and Addis delivery experience."
        className="max-w-lg"
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block font-label text-xs font-bold text-foreground">
              Your Rating
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="p-1 cursor-pointer"
                >
                  <Star
                    className={cn(
                      "size-6",
                      star <= reviewRating
                        ? "fill-amber-500 text-amber-500"
                        : "text-border",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block font-label text-xs font-bold text-foreground">
              Headline
            </label>
            <Input
              required
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              placeholder="e.g., Super light for morning Entoto runs"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-label text-xs font-bold text-foreground">
              Your Experience
            </label>
            <Textarea
              required
              value={reviewBody}
              onChange={(e) => setReviewBody(e.target.value)}
              placeholder="How did it fit? How fast was delivery?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setReviewModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="cta">
              <Plus className="size-4" /> Publish Review
            </Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
