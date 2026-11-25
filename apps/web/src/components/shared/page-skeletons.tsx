import * as React from "react";
import {
  SkeletonBase,
  SkeletonCircle,
  SkeletonDashboardCard,
  SkeletonProductCard,
  SkeletonProductGrid,
  SkeletonTable,
} from "@/components/ui/skeleton";

// ============================================================================
// 1. Home Page Skeleton
// ============================================================================
export function HomePageSkeleton() {
  return (
    <div className="flex w-full flex-col space-y-16 lg:space-y-24" aria-busy="true" aria-label="Loading home page">
      {/* Hero Banner Skeleton */}
      <section className="relative overflow-hidden bg-surface-low py-12 lg:py-20">
        <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-center gap-10 px-4 lg:grid-cols-12 lg:px-8">
          <div className="space-y-6 lg:col-span-7">
            {/* VIP Eyebrow Badge */}
            <div className="flex items-center gap-2">
              <SkeletonBase className="h-6 w-36 rounded-full" />
              <SkeletonBase className="h-6 w-24 rounded-full" />
            </div>

            {/* Display Heading */}
            <div className="space-y-3">
              <SkeletonBase className="h-10 sm:h-14 w-full max-w-xl rounded-xl" />
              <SkeletonBase className="h-10 sm:h-14 w-4/5 max-w-lg rounded-xl" />
            </div>

            {/* Subtitle Paragraph */}
            <div className="space-y-2 pt-1 max-w-xl">
              <SkeletonBase className="h-4 w-full rounded-md" />
              <SkeletonBase className="h-4 w-5/6 rounded-md" />
              <SkeletonBase className="h-4 w-3/4 rounded-md" />
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 pt-3">
              <SkeletonBase className="h-12 w-48 rounded-full" />
              <SkeletonBase className="h-12 w-40 rounded-full" />
            </div>

            {/* Value Guarantees / Trust Badges */}
            <div className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-4 border-t border-border/60">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <SkeletonCircle className="size-10 rounded-xl" />
                  <div className="space-y-1">
                    <SkeletonBase className="h-3 w-16 rounded-md" />
                    <SkeletonBase className="h-3.5 w-20 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Hero Image Card */}
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/3] sm:aspect-[5/4] w-full overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-2xl">
              <SkeletonBase className="size-full rounded-2xl" />
              <div className="absolute bottom-10 left-10 right-10 rounded-2xl bg-surface/80 backdrop-blur p-4 border border-border/80">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <SkeletonBase className="h-4 w-28 rounded-md" />
                    <SkeletonBase className="h-3 w-40 rounded-md" />
                  </div>
                  <SkeletonBase className="h-8 w-24 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories Strip */}
      <section className="mx-auto w-full max-w-[1360px] px-4 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <SkeletonBase className="h-4 w-32 rounded-md" />
            <SkeletonBase className="h-8 w-64 rounded-xl" />
          </div>
          <SkeletonBase className="h-9 w-28 rounded-full" />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center rounded-2xl border border-border bg-surface p-4 text-center space-y-3"
            >
              <SkeletonCircle className="size-16 sm:size-20" />
              <SkeletonBase className="h-4 w-20 rounded-md" />
              <SkeletonBase className="h-3 w-14 rounded-md" />
            </div>
          ))}
        </div>
      </section>

      {/* Trending Footwear Section */}
      <section className="mx-auto w-full max-w-[1360px] px-4 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <SkeletonBase className="h-4 w-28 rounded-md" />
            <SkeletonBase className="h-8 w-72 rounded-xl" />
          </div>
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBase key={i} className="h-9 w-24 rounded-full shrink-0" />
            ))}
          </div>
        </div>

        <SkeletonProductGrid count={4} columns={4} variant="home" />
      </section>

      {/* Promotional Split Banner */}
      <section className="mx-auto w-full max-w-[1360px] px-4 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 shadow-card flex flex-col justify-between min-h-[260px]"
            >
              <div className="space-y-3 max-w-md">
                <SkeletonBase className="h-5 w-24 rounded-full" />
                <SkeletonBase className="h-8 w-3/4 rounded-xl" />
                <SkeletonBase className="h-4 w-5/6 rounded-md" />
              </div>
              <div className="pt-6">
                <SkeletonBase className="h-11 w-36 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* New Drops Showcase */}
      <section className="mx-auto w-full max-w-[1360px] px-4 lg:px-8 pb-12">
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-2">
            <SkeletonBase className="h-4 w-32 rounded-md" />
            <SkeletonBase className="h-8 w-60 rounded-xl" />
          </div>
          <div className="flex gap-2">
            <SkeletonBase className="size-10 rounded-full" />
            <SkeletonBase className="size-10 rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonProductCard key={i} variant="home" />
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 2. Catalog / Products Listing Page Skeleton
// ============================================================================
export function CatalogPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 lg:px-8 space-y-8" aria-busy="true" aria-label="Loading catalog">
      {/* Breadcrumb & Header */}
      <div className="space-y-4 border-b border-border pb-6">
        <div className="flex items-center gap-2 text-xs">
          <SkeletonBase className="h-3.5 w-12 rounded-md" />
          <span className="text-border">/</span>
          <SkeletonBase className="h-3.5 w-16 rounded-md" />
          <span className="text-border">/</span>
          <SkeletonBase className="h-3.5 w-24 rounded-md" />
        </div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <SkeletonBase className="h-9 w-64 sm:w-80 rounded-xl" />
            <SkeletonBase className="h-4 w-96 max-w-full rounded-md" />
          </div>
          <SkeletonBase className="h-6 w-32 rounded-full" />
        </div>
      </div>

      {/* Main Grid with Sidebar Filter */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Desktop Filter Sidebar */}
        <aside className="hidden lg:col-span-3 lg:block space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <SkeletonBase className="h-5 w-20 rounded-md" />
              <SkeletonBase className="h-4 w-12 rounded-md" />
            </div>

            {/* Categories */}
            <div className="space-y-3">
              <SkeletonBase className="h-4 w-24 rounded-md" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <SkeletonBase className="h-4 w-28 rounded-md" />
                    <SkeletonBase className="h-3 w-6 rounded-md" />
                  </div>
                ))}
              </div>
            </div>

            {/* EU Sizes Matrix */}
            <div className="space-y-3 border-t border-border pt-4">
              <SkeletonBase className="h-4 w-28 rounded-md" />
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonBase key={i} className="h-8 rounded-lg" />
                ))}
              </div>
            </div>

            {/* Color Swatches */}
            <div className="space-y-3 border-t border-border pt-4">
              <SkeletonBase className="h-4 w-20 rounded-md" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCircle key={i} className="size-6" />
                ))}
              </div>
            </div>

            {/* Price Range Slider */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <SkeletonBase className="h-4 w-24 rounded-md" />
                <SkeletonBase className="h-4 w-16 rounded-md" />
              </div>
              <SkeletonBase className="h-3 w-full rounded-full" />
            </div>
          </div>
        </aside>

        {/* Catalog Content Area */}
        <main className="lg:col-span-9 space-y-6">
          {/* Top Control Bar (Search, Sort, Mobile Filter, View Toggle) */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="flex-1 min-w-[200px]">
              <SkeletonBase className="h-10 w-full max-w-sm rounded-xl" />
            </div>
            <div className="flex items-center gap-3">
              <SkeletonBase className="h-10 w-36 rounded-xl" />
              <div className="hidden sm:flex gap-1">
                <SkeletonBase className="size-10 rounded-xl" />
                <SkeletonBase className="size-10 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <SkeletonProductGrid count={8} columns={4} />

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 pt-6">
            <SkeletonBase className="size-10 rounded-xl" />
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBase key={i} className="size-10 rounded-xl" />
            ))}
            <SkeletonBase className="size-10 rounded-xl" />
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// 3. Product Details Page Skeleton
// ============================================================================
export function ProductDetailPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 lg:px-8 space-y-12" aria-busy="true" aria-label="Loading product details">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <SkeletonBase className="h-3.5 w-12 rounded-md" />
        <span className="text-border">/</span>
        <SkeletonBase className="h-3.5 w-20 rounded-md" />
        <span className="text-border">/</span>
        <SkeletonBase className="h-3.5 w-32 rounded-md" />
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
        {/* Left Column: Image Gallery */}
        <div className="space-y-4 lg:col-span-7">
          {/* Main Large Image */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border bg-surface-media/60 p-6 shadow-md flex items-center justify-center">
            <SkeletonBase className="size-full rounded-2xl" />
            <div className="absolute top-4 left-4">
              <SkeletonBase className="h-6 w-24 rounded-full" />
            </div>
            <div className="absolute top-4 right-4">
              <SkeletonCircle className="size-11" />
            </div>
          </div>

          {/* Thumbnail Gallery Row */}
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-xl border border-border bg-surface-media/40 p-2"
              >
                <SkeletonBase className="size-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Product Info & Purchase Controls */}
        <div className="space-y-6 lg:col-span-5">
          {/* Brand & Category Eyebrow */}
          <div className="flex items-center gap-2">
            <SkeletonBase className="h-4 w-20 rounded-md" />
            <span className="text-border">•</span>
            <SkeletonBase className="h-4 w-28 rounded-md" />
          </div>

          {/* Title & Tagline */}
          <div className="space-y-2">
            <SkeletonBase className="h-9 w-4/5 rounded-xl" />
            <SkeletonBase className="h-5 w-3/5 rounded-md" />
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <SkeletonBase className="h-4 w-28 rounded-md" />
            <SkeletonBase className="h-4 w-20 rounded-md" />
          </div>

          {/* Price Box */}
          <div className="flex items-baseline gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <SkeletonBase className="h-9 w-36 rounded-md" />
            <SkeletonBase className="h-5 w-24 rounded-md" />
            <SkeletonBase className="h-6 w-16 rounded-full" />
          </div>

          {/* Color Selector Swatches */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonBase className="h-4 w-28 rounded-md" />
              <SkeletonBase className="h-4 w-20 rounded-md" />
            </div>
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCircle key={i} className="size-10" />
              ))}
            </div>
          </div>

          {/* EU Size Selector Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonBase className="h-4 w-24 rounded-md" />
              <SkeletonBase className="h-4 w-24 rounded-md" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <SkeletonBase key={i} className="h-11 rounded-xl" />
              ))}
            </div>
          </div>

          {/* Quantity and CTA Buttons */}
          <div className="space-y-3 pt-2">
            <div className="flex gap-3">
              <SkeletonBase className="h-12 w-28 rounded-xl" />
              <SkeletonBase className="h-12 flex-1 rounded-xl" />
            </div>
            <SkeletonBase className="h-12 w-full rounded-xl" />
          </div>

          {/* Trust Guarantees */}
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <SkeletonCircle className="size-8 rounded-lg" />
                <SkeletonBase className="h-3.5 w-24 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs / Detailed Specs */}
      <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex gap-4 border-b border-border pb-4">
          <SkeletonBase className="h-8 w-28 rounded-lg" />
          <SkeletonBase className="h-8 w-28 rounded-lg" />
          <SkeletonBase className="h-8 w-28 rounded-lg" />
        </div>
        <div className="space-y-3 max-w-2xl">
          <SkeletonBase className="h-4 w-full rounded-md" />
          <SkeletonBase className="h-4 w-11/12 rounded-md" />
          <SkeletonBase className="h-4 w-4/5 rounded-md" />
        </div>
      </div>

      {/* Related Footwear Grid */}
      <section className="space-y-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <SkeletonBase className="h-4 w-28 rounded-md" />
            <SkeletonBase className="h-7 w-56 rounded-xl" />
          </div>
          <SkeletonBase className="h-8 w-24 rounded-full" />
        </div>
        <SkeletonProductGrid count={4} columns={4} />
      </section>
    </div>
  );
}

// ============================================================================
// 4. Shopping Cart Page Skeleton
// ============================================================================
export function CartPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 lg:px-8 space-y-8" aria-busy="true" aria-label="Loading cart">
      {/* Page Title */}
      <div className="border-b border-border pb-6">
        <SkeletonBase className="h-8 w-56 rounded-xl" />
        <SkeletonBase className="mt-2 h-4 w-72 rounded-md" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Cart Items List */}
        <div className="space-y-4 lg:col-span-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <SkeletonBase className="size-24 shrink-0 rounded-xl" />
                <div className="space-y-2">
                  <SkeletonBase className="h-5 w-44 rounded-md" />
                  <div className="flex gap-2">
                    <SkeletonBase className="h-4 w-20 rounded-md" />
                    <SkeletonBase className="h-4 w-16 rounded-md" />
                  </div>
                  <SkeletonBase className="h-5 w-24 rounded-md" />
                </div>
              </div>

              <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3">
                <SkeletonBase className="h-9 w-28 rounded-xl" />
                <SkeletonBase className="h-4 w-16 rounded-md" />
              </div>
            </div>
          ))}

          {/* Upsell Accessories Carousel Skeleton */}
          <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
            <SkeletonBase className="h-5 w-48 rounded-md" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <SkeletonBase className="size-12 rounded-lg" />
                  <div className="space-y-1 flex-1">
                    <SkeletonBase className="h-3.5 w-20 rounded-md" />
                    <SkeletonBase className="h-3 w-12 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Order Summary Sticky Box */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-6">
            <SkeletonBase className="h-6 w-36 rounded-md" />

            {/* Promo Code Input */}
            <div className="flex gap-2">
              <SkeletonBase className="h-10 flex-1 rounded-xl" />
              <SkeletonBase className="h-10 w-20 rounded-xl" />
            </div>

            {/* Price Calculations */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex justify-between">
                <SkeletonBase className="h-4 w-20 rounded-md" />
                <SkeletonBase className="h-4 w-20 rounded-md" />
              </div>
              <div className="flex justify-between">
                <SkeletonBase className="h-4 w-28 rounded-md" />
                <SkeletonBase className="h-4 w-16 rounded-md" />
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <SkeletonBase className="h-5 w-16 rounded-md" />
                <SkeletonBase className="h-6 w-28 rounded-md" />
              </div>
            </div>

            {/* Checkout Button */}
            <SkeletonBase className="h-12 w-full rounded-full" />

            {/* Payment & Security Logos */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <SkeletonBase className="h-5 w-14 rounded-md" />
              <SkeletonBase className="h-5 w-14 rounded-md" />
              <SkeletonBase className="h-5 w-14 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. Checkout Page Skeleton
// ============================================================================
export function CheckoutPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 lg:px-8 space-y-8" aria-busy="true" aria-label="Loading checkout">
      <div className="border-b border-border pb-4">
        <SkeletonBase className="h-7 w-48 rounded-xl" />
        <SkeletonBase className="mt-1 h-4 w-64 rounded-md" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Form: Customer Details, Address, Payment */}
        <div className="space-y-8 lg:col-span-7">
          {/* Section 1: Customer Contact Info */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
            <SkeletonBase className="h-5 w-44 rounded-md" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <SkeletonBase className="h-3.5 w-20 rounded-md" />
                <SkeletonBase className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <SkeletonBase className="h-3.5 w-24 rounded-md" />
                <SkeletonBase className="h-10 w-full rounded-xl" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <SkeletonBase className="h-3.5 w-24 rounded-md" />
                <SkeletonBase className="h-10 w-full rounded-xl" />
              </div>
            </div>
          </div>

          {/* Section 2: Addis Delivery Address */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
            <SkeletonBase className="h-5 w-52 rounded-md" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <SkeletonBase className="h-3.5 w-16 rounded-md" />
                <SkeletonBase className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <SkeletonBase className="h-3.5 w-24 rounded-md" />
                <SkeletonBase className="h-10 w-full rounded-xl" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <SkeletonBase className="h-3.5 w-36 rounded-md" />
                <SkeletonBase className="h-10 w-full rounded-xl" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <SkeletonBase className="h-3.5 w-32 rounded-md" />
                <SkeletonBase className="h-20 w-full rounded-xl" />
              </div>
            </div>
          </div>

          {/* Section 3: Delivery Speed Cards */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
            <SkeletonBase className="h-5 w-40 rounded-md" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border p-4 space-y-2">
                  <div className="flex justify-between">
                    <SkeletonBase className="h-4 w-28 rounded-md" />
                    <SkeletonBase className="h-4 w-14 rounded-md" />
                  </div>
                  <SkeletonBase className="h-3 w-40 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Payment Methods */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
            <SkeletonBase className="h-5 w-48 rounded-md" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border p-4 space-y-2">
                  <SkeletonCircle className="size-8" />
                  <SkeletonBase className="h-4 w-20 rounded-md" />
                  <SkeletonBase className="h-3 w-28 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sticky Order Summary */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-6">
            <SkeletonBase className="h-6 w-36 rounded-md" />

            {/* Items Summary */}
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <SkeletonBase className="size-16 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <SkeletonBase className="h-4 w-32 rounded-md" />
                    <SkeletonBase className="h-3 w-20 rounded-md" />
                  </div>
                  <SkeletonBase className="h-4 w-16 rounded-md" />
                </div>
              ))}
            </div>

            {/* Total Price Breakdown */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex justify-between">
                <SkeletonBase className="h-4 w-20 rounded-md" />
                <SkeletonBase className="h-4 w-20 rounded-md" />
              </div>
              <div className="flex justify-between">
                <SkeletonBase className="h-4 w-24 rounded-md" />
                <SkeletonBase className="h-4 w-16 rounded-md" />
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <SkeletonBase className="h-5 w-16 rounded-md" />
                <SkeletonBase className="h-7 w-32 rounded-md" />
              </div>
            </div>

            {/* Place Order Button */}
            <SkeletonBase className="h-12 w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. About Us Page Skeleton
// ============================================================================
export function AboutPageSkeleton() {
  return (
    <div className="flex w-full flex-col space-y-16" aria-busy="true" aria-label="Loading about page">
      {/* Editorial Hero */}
      <section className="w-full bg-surface-low py-14 lg:py-20">
        <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-center gap-10 px-4 lg:grid-cols-12 lg:px-8">
          <div className="space-y-5 lg:col-span-6">
            <SkeletonBase className="h-6 w-32 rounded-full" />
            <SkeletonBase className="h-10 sm:h-14 w-full rounded-xl" />
            <SkeletonBase className="h-10 sm:h-14 w-3/4 rounded-xl" />
            <div className="space-y-2 pt-2">
              <SkeletonBase className="h-4 w-full rounded-md" />
              <SkeletonBase className="h-4 w-11/12 rounded-md" />
              <SkeletonBase className="h-4 w-4/5 rounded-md" />
            </div>
            <div className="flex gap-4 pt-3">
              <SkeletonBase className="h-12 w-44 rounded-full" />
              <SkeletonBase className="h-12 w-40 rounded-full" />
            </div>
          </div>
          <div className="lg:col-span-6">
            <SkeletonBase className="h-80 sm:h-96 w-full rounded-2xl" />
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto w-full max-w-[1360px] px-4 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-2">
          <SkeletonBase className="h-4 w-36 rounded-md" />
          <SkeletonBase className="h-8 w-72 rounded-xl" />
          <SkeletonBase className="h-4 w-full rounded-md" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-3">
              <SkeletonCircle className="size-12 rounded-xl" />
              <SkeletonBase className="h-5 w-48 rounded-md" />
              <SkeletonBase className="h-4 w-full rounded-md" />
              <SkeletonBase className="h-4 w-4/5 rounded-md" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 7. Contact Us Page Skeleton
// ============================================================================
export function ContactPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-4 py-10 lg:px-8 space-y-8" aria-busy="true" aria-label="Loading contact page">
      <div className="space-y-2 max-w-xl">
        <SkeletonBase className="h-6 w-36 rounded-full" />
        <SkeletonBase className="h-9 w-72 rounded-xl" />
        <SkeletonBase className="h-4 w-full rounded-md" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Info Cards */}
        <div className="space-y-4 lg:col-span-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
              <SkeletonCircle className="size-11 rounded-xl" />
              <div className="space-y-2 flex-1">
                <SkeletonBase className="h-3 w-28 rounded-md" />
                <SkeletonBase className="h-4 w-44 rounded-md" />
              </div>
            </div>
          ))}
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8 shadow-card space-y-5">
            <SkeletonBase className="h-6 w-44 rounded-md" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <SkeletonBase className="h-3.5 w-20 rounded-md" />
                <SkeletonBase className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <SkeletonBase className="h-3.5 w-24 rounded-md" />
                <SkeletonBase className="h-10 w-full rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <SkeletonBase className="h-3.5 w-24 rounded-md" />
              <SkeletonBase className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <SkeletonBase className="h-3.5 w-32 rounded-md" />
              <SkeletonBase className="h-28 w-full rounded-xl" />
            </div>
            <SkeletonBase className="h-11 w-44 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 8. Auth Page Skeleton (Login, Register, Forgot Password, Reset Password)
// ============================================================================
export function AuthPageSkeleton({ type = "login" }: { type?: "login" | "register" | "forgot" | "reset" }) {
  return (
    <div className="w-full max-w-md space-y-6" aria-busy="true" aria-label="Loading authentication">
      <div className="flex flex-col items-center text-center space-y-3">
        <SkeletonCircle className="size-14" />
        <SkeletonBase className="h-5 w-36 rounded-full" />
        <SkeletonBase className="h-7 w-60 rounded-xl" />
        <SkeletonBase className="h-4 w-72 rounded-md" />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-8 space-y-4">
        {type === "register" ? (
          <>
            <div className="space-y-1.5">
              <SkeletonBase className="h-3.5 w-20 rounded-md" />
              <SkeletonBase className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <SkeletonBase className="h-3.5 w-24 rounded-md" />
              <SkeletonBase className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <SkeletonBase className="h-3.5 w-24 rounded-md" />
              <SkeletonBase className="h-10 w-full rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SkeletonBase className="h-10 rounded-xl" />
              <SkeletonBase className="h-10 rounded-xl" />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <SkeletonBase className="h-3.5 w-24 rounded-md" />
              <SkeletonBase className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <SkeletonBase className="h-3.5 w-20 rounded-md" />
              <SkeletonBase className="h-10 w-full rounded-xl" />
            </div>
          </>
        )}

        <SkeletonBase className="h-11 w-full rounded-full mt-4" />

        {type === "login" && (
          <div className="pt-4 border-t border-border space-y-2">
            <SkeletonBase className="h-3 w-32 rounded-md mx-auto" />
            <div className="grid grid-cols-2 gap-2">
              <SkeletonBase className="h-9 rounded-xl" />
              <SkeletonBase className="h-9 rounded-xl" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 9. User Account / Profile Page Skeleton
// ============================================================================
export function AccountPageSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading account">
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonDashboardCard key={i} />
        ))}
      </div>

      {/* Recent Orders Preview */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <SkeletonBase className="h-6 w-36 rounded-md" />
          <SkeletonBase className="h-4 w-20 rounded-md" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border/70">
              <div className="space-y-1">
                <SkeletonBase className="h-4 w-28 rounded-md" />
                <SkeletonBase className="h-3 w-36 rounded-md" />
              </div>
              <SkeletonBase className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Profile Form */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
        <SkeletonBase className="h-6 w-44 rounded-md" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonBase className="h-3.5 w-24 rounded-md" />
              <SkeletonBase className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <SkeletonBase className="h-10 w-36 rounded-full" />
      </div>
    </div>
  );
}

// ============================================================================
// 10. Order History Page Skeleton
// ============================================================================
export function OrderHistoryPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading orders">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBase key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <SkeletonBase className="h-5 w-28 rounded-md" />
                <SkeletonBase className="h-5 w-20 rounded-full" />
                <SkeletonBase className="h-3.5 w-24 rounded-md" />
              </div>
              <SkeletonBase className="h-6 w-24 rounded-md" />
            </div>
            <div className="flex items-center gap-4">
              <SkeletonBase className="size-16 rounded-xl shrink-0" />
              <div className="space-y-1.5 flex-1">
                <SkeletonBase className="h-4 w-48 rounded-md" />
                <SkeletonBase className="h-3 w-28 rounded-md" />
              </div>
              <SkeletonBase className="h-9 w-28 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 11. Order Tracking Page Skeleton
// ============================================================================
export function OrderTrackingPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading tracking">
      {/* Search Input Box */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-3">
        <div className="flex gap-3">
          <SkeletonBase className="h-10 flex-1 rounded-xl" />
          <SkeletonBase className="h-10 w-32 rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBase className="h-3 w-20 rounded-md" />
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBase key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      </div>

      {/* Timeline Steps Card */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-6">
        <div className="flex justify-between border-b border-border pb-4">
          <div className="space-y-1">
            <SkeletonBase className="h-6 w-32 rounded-md" />
            <SkeletonBase className="h-3.5 w-44 rounded-md" />
          </div>
          <SkeletonBase className="h-7 w-28 rounded-full" />
        </div>

        {/* 4 Timeline steps */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center text-center space-y-2">
              <SkeletonCircle className="size-10" />
              <SkeletonBase className="h-4 w-20 rounded-md" />
              <SkeletonBase className="h-3 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 12. Wishlist Page Skeleton
// ============================================================================
export function WishlistPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-4 py-10 lg:px-8 space-y-8" aria-busy="true" aria-label="Loading wishlist">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <SkeletonBase className="h-5 w-28 rounded-full" />
          <SkeletonBase className="h-8 w-64 rounded-xl" />
          <SkeletonBase className="h-4 w-80 rounded-md" />
        </div>
        <SkeletonBase className="h-9 w-32 rounded-xl" />
      </div>

      <SkeletonProductGrid count={4} columns={4} />
    </div>
  );
}

// ============================================================================
// 13. Admin Dashboard Overview Skeleton
// ============================================================================
export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading admin dashboard">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <SkeletonBase className="h-7 w-64 rounded-xl" />
          <SkeletonBase className="h-3.5 w-72 rounded-md" />
        </div>
        <div className="flex gap-2">
          <SkeletonBase className="h-9 w-28 rounded-xl" />
          <SkeletonBase className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonDashboardCard key={i} />
        ))}
      </div>

      {/* Verification Tool Card */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
        <SkeletonBase className="h-6 w-56 rounded-md" />
        <div className="flex gap-3">
          <SkeletonBase className="h-10 flex-1 rounded-xl" />
          <SkeletonBase className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonBase className="h-6 w-36 rounded-md" />
          <SkeletonBase className="h-4 w-20 rounded-md" />
        </div>
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}

// ============================================================================
// 14. Admin Management Table Page Skeleton (Products, Orders, Customers)
// ============================================================================
export function AdminTablePageSkeleton({
  title = "Management",
  hasCreateButton = true,
}: {
  title?: string;
  hasCreateButton?: boolean;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={`Loading ${title}`}>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <SkeletonBase className="h-7 w-48 rounded-xl" />
          <SkeletonBase className="h-3.5 w-64 rounded-md" />
        </div>
        {hasCreateButton && <SkeletonBase className="h-10 w-36 rounded-full" />}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <SkeletonBase className="h-10 w-full max-w-sm rounded-xl" />
        <div className="flex gap-2">
          <SkeletonBase className="h-10 w-32 rounded-xl" />
          <SkeletonBase className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* DataTable Skeleton */}
      <SkeletonTable rows={6} columns={5} />
    </div>
  );
}

// ============================================================================
// 15. Admin Inventory Matrix Skeleton
// ============================================================================
export function AdminInventorySkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading inventory">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <SkeletonBase className="h-7 w-52 rounded-xl" />
          <SkeletonBase className="h-3.5 w-64 rounded-md" />
        </div>
        <div className="flex gap-2">
          <SkeletonBase className="h-10 w-28 rounded-xl" />
          <SkeletonBase className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <SkeletonBase className="h-10 w-72 rounded-xl" />
        <SkeletonBase className="h-8 w-40 rounded-full" />
      </div>

      <SkeletonTable rows={7} columns={10} />
    </div>
  );
}

// ============================================================================
// 16. Admin Reports / Analytics Skeleton
// ============================================================================
export function AdminReportsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading reports">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <SkeletonBase className="h-7 w-48 rounded-xl" />
          <SkeletonBase className="h-3.5 w-64 rounded-md" />
        </div>
        <SkeletonBase className="h-10 w-36 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonDashboardCard key={i} />
        ))}
      </div>

      {/* Sales Chart Skeleton */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-6">
        <div className="flex justify-between items-center">
          <SkeletonBase className="h-6 w-44 rounded-md" />
          <div className="flex gap-2">
            <SkeletonBase className="h-8 w-16 rounded-lg" />
            <SkeletonBase className="h-8 w-16 rounded-lg" />
          </div>
        </div>

        {/* Chart Bars Skeleton */}
        <div className="flex items-end justify-between gap-4 h-64 pt-6 px-4 border-b border-border">
          {[40, 65, 55, 80, 70, 95].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <SkeletonBase
                style={{ height: `${h}%` }}
                className="w-full max-w-[48px] rounded-t-lg"
              />
              <SkeletonBase className="h-3 w-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 17. Admin Settings Skeleton
// ============================================================================
export function AdminSettingsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading settings">
      <div className="space-y-1.5">
        <SkeletonBase className="h-7 w-44 rounded-xl" />
        <SkeletonBase className="h-3.5 w-72 rounded-md" />
      </div>

      {Array.from({ length: 3 }).map((_, sIdx) => (
        <div key={sIdx} className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
          <SkeletonBase className="h-6 w-48 rounded-md" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, fIdx) => (
              <div key={fIdx} className="space-y-1.5">
                <SkeletonBase className="h-3.5 w-24 rounded-md" />
                <SkeletonBase className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <SkeletonBase className="h-11 w-40 rounded-full" />
    </div>
  );
}

// ============================================================================
// 18. Admin Product Form (Create / Edit) Skeleton
// ============================================================================
export function AdminProductFormSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading product editor">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <SkeletonBase className="h-7 w-56 rounded-xl" />
          <SkeletonBase className="h-3.5 w-64 rounded-md" />
        </div>
        <div className="flex gap-3">
          <SkeletonBase className="h-10 w-24 rounded-full" />
          <SkeletonBase className="h-10 w-36 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
            <SkeletonBase className="h-6 w-40 rounded-md" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <SkeletonBase className="h-3.5 w-24 rounded-md" />
                <SkeletonBase className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <SkeletonBase className="h-3.5 w-20 rounded-md" />
                <SkeletonBase className="h-10 w-full rounded-xl" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <SkeletonBase className="h-3.5 w-28 rounded-md" />
                <SkeletonBase className="h-24 w-full rounded-xl" />
              </div>
            </div>
          </div>

          {/* Size stock matrix skeleton */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
            <SkeletonBase className="h-6 w-44 rounded-md" />
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <SkeletonBase className="h-3 w-10 rounded-md mx-auto" />
                  <SkeletonBase className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4">
            <SkeletonBase className="h-6 w-32 rounded-md" />
            <SkeletonBase className="aspect-square w-full rounded-xl" />
            <SkeletonBase className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
