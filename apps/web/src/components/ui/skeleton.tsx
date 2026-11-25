import * as React from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// 1. SkeletonBase
// ============================================================================
export interface SkeletonBaseProps extends React.ComponentProps<"div"> {
  variant?: "rounded" | "circle" | "pill" | "sharp";
  animation?: "shimmer" | "pulse" | "none";
}

export function SkeletonBase({
  className,
  variant = "rounded",
  animation = "shimmer",
  ...props
}: SkeletonBaseProps) {
  const variantClass = {
    rounded: "rounded-lg",
    circle: "rounded-full",
    pill: "rounded-full",
    sharp: "rounded-none",
  }[variant];

  const animationClass = {
    shimmer: "skeleton-shimmer",
    pulse: "animate-pulse bg-surface-container/70",
    none: "bg-surface-container/70",
  }[animation];

  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(animationClass, variantClass, className)}
      {...props}
    />
  );
}

// Backwards-compatible alias
export const Skeleton = SkeletonBase;

// ============================================================================
// 2. SkeletonText
// ============================================================================
export interface SkeletonTextProps {
  lines?: number;
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "heading";
  lastLineWidth?: string;
  lineClassName?: string;
  className?: string;
}

export function SkeletonText({
  lines = 1,
  size = "base",
  lastLineWidth = "65%",
  lineClassName,
  className,
}: SkeletonTextProps) {
  const heightClass = {
    xs: "h-2.5",
    sm: "h-3.5",
    base: "h-4",
    lg: "h-5",
    xl: "h-6",
    "2xl": "h-8",
    heading: "h-10",
  }[size];

  if (lines <= 1) {
    return <SkeletonBase className={cn(heightClass, "w-full rounded-md", className)} />;
  }

  // Pre-calculated organic varying widths for realistic multi-line text
  const widths = ["100%", "92%", "96%", "88%", "94%"];

  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => {
        const isLast = i === lines - 1;
        const width = isLast ? lastLineWidth : (widths[i % widths.length] ?? "100%");
        return (
          <SkeletonBase
            key={i}
            style={{ width }}
            className={cn(heightClass, "rounded-md", lineClassName)}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// 3. SkeletonCircle
// ============================================================================
export interface SkeletonCircleProps extends React.ComponentProps<"div"> {
  size?: number | string;
}

export function SkeletonCircle({ size, className, style, ...props }: SkeletonCircleProps) {
  const inlineStyle: React.CSSProperties = {
    ...(typeof size === "number" ? { width: `${size}px`, height: `${size}px` } : {}),
    ...style,
  };

  return (
    <SkeletonBase
      variant="circle"
      style={inlineStyle}
      className={cn("shrink-0", !size && "size-10", className)}
      {...props}
    />
  );
}

// ============================================================================
// 4. SkeletonButton
// ============================================================================
export interface SkeletonButtonProps extends React.ComponentProps<"div"> {
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "pill" | "outline";
  fullWidth?: boolean;
}

export function SkeletonButton({
  size = "default",
  variant = "pill",
  fullWidth = false,
  className,
  ...props
}: SkeletonButtonProps) {
  const sizeClass = {
    sm: "h-8 px-4 text-xs",
    default: "h-10 px-6 text-sm",
    lg: "h-12 px-8 text-base",
    icon: "size-10",
  }[size];

  const radiusClass = variant === "pill" ? "rounded-full" : "rounded-xl";
  const widthClass = size === "icon" ? "" : fullWidth ? "w-full" : "w-32";

  return (
    <SkeletonBase
      className={cn(sizeClass, radiusClass, widthClass, className)}
      {...props}
    />
  );
}

// ============================================================================
// 5. SkeletonCard
// ============================================================================
export interface SkeletonCardProps extends React.ComponentProps<"div"> {
  hasHeader?: boolean;
  hasMedia?: boolean;
  mediaAspectRatio?: string;
  lines?: number;
}

export function SkeletonCard({
  hasHeader = true,
  hasMedia = false,
  mediaAspectRatio = "aspect-[16/9]",
  lines = 2,
  className,
  children,
  ...props
}: SkeletonCardProps) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-surface p-5 shadow-card", className)}
      aria-hidden="true"
      {...props}
    >
      {children ? (
        children
      ) : (
        <div className="space-y-4">
          {hasHeader && (
            <div className="flex items-center justify-between">
              <SkeletonBase className="h-4 w-28 rounded-md" />
              <SkeletonBase className="h-6 w-16 rounded-full" />
            </div>
          )}
          {hasMedia && (
            <SkeletonBase className={cn("w-full rounded-xl", mediaAspectRatio)} />
          )}
          <SkeletonText lines={lines} size="sm" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. SkeletonProductCard
// ============================================================================
export interface SkeletonProductCardProps {
  variant?: "home" | "catalog";
  className?: string;
}

export function SkeletonProductCard({ variant = "catalog", className }: SkeletonProductCardProps) {
  const isHome = variant === "home";
  return (
    <article
      aria-hidden="true"
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-shadow",
        isHome && "hover:shadow-card-hover",
        className,
      )}
    >
      {/* Top Media Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-media/50 p-4">
        <SkeletonBase className="size-full rounded-xl" />
        {/* Badge Placeholder */}
        <div className="absolute top-3 left-3">
          <SkeletonBase className="h-5 w-20 rounded-full" />
        </div>
        {/* Wishlist Button Placeholder */}
        <div className="absolute top-3 right-3">
          <SkeletonBase className="size-9 rounded-full" />
        </div>
      </div>

      {/* Product Content Details */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Color Swatches */}
        <div className="mb-2 flex items-center gap-1.5">
          <SkeletonBase className="size-3 rounded-full" />
          <SkeletonBase className="size-3 rounded-full" />
          <SkeletonBase className="size-3 rounded-full" />
          <SkeletonBase className="ml-1 h-3 w-8 rounded-md" />
        </div>

        {/* Category & Brand Eyebrow */}
        <div className="mb-1 flex items-center gap-2">
          <SkeletonBase className="h-3 w-16 rounded-md" />
          <span className="text-border">•</span>
          <SkeletonBase className="h-3 w-12 rounded-md" />
        </div>

        {/* Product Title */}
        <SkeletonBase className="h-5 w-4/5 rounded-md" />

        {/* Tagline / Subtitle */}
        <SkeletonBase className="mt-1.5 h-3.5 w-3/5 rounded-md" />

        {/* Rating Placeholder */}
        <div className="mt-3 flex items-center gap-2">
          <SkeletonBase className="h-3.5 w-20 rounded-md" />
          <SkeletonBase className="h-3 w-8 rounded-md" />
        </div>

        {/* Price & Discount */}
        <div className="mt-3 flex items-baseline gap-2">
          <SkeletonBase className="h-6 w-24 rounded-md" />
          <SkeletonBase className="h-4 w-16 rounded-md" />
          <SkeletonBase className="h-4 w-10 rounded-full" />
        </div>

        {/* Available Sizes Row */}
        <div className="mt-4 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between mb-2">
            <SkeletonBase className="h-3 w-20 rounded-md" />
            <SkeletonBase className="h-3 w-14 rounded-md" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBase key={i} className="h-7 w-8 rounded-md" />
            ))}
          </div>
        </div>

        {/* Add to Bag CTA Button */}
        <div className="mt-4 pt-2">
          <SkeletonBase className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </article>
  );
}

// ============================================================================
// 7. SkeletonProductGrid
// ============================================================================
export interface SkeletonProductGridProps {
  count?: number;
  columns?: 3 | 4;
  variant?: "home" | "catalog";
  className?: string;
}

export function SkeletonProductGrid({
  count = 8,
  columns = 4,
  variant = "catalog",
  className,
}: SkeletonProductGridProps) {
  const gridCols =
    columns === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5";

  return (
    <div className={cn("grid", gridCols, className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonProductCard key={i} variant={variant} />
      ))}
    </div>
  );
}

// ============================================================================
// 8. SkeletonTable
// ============================================================================
export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 5, className }: SkeletonTableProps) {
  return (
    <div
      className={cn("overflow-x-auto rounded-xl border border-border bg-surface", className)}
      aria-hidden="true"
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-low/80 font-label text-xs font-bold uppercase">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3.5">
                <SkeletonBase className="h-3.5 w-20 rounded-md" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {Array.from({ length: rows }).map((_, rIdx) => (
            <tr key={rIdx} className="hover:bg-surface-low/30">
              {Array.from({ length: columns }).map((_, cIdx) => (
                <td key={cIdx} className="px-4 py-3.5">
                  {cIdx === 0 ? (
                    <div className="flex items-center gap-3">
                      <SkeletonBase className="size-10 shrink-0 rounded-lg" />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <SkeletonBase className="h-4 w-32 rounded-md" />
                        <SkeletonBase className="h-3 w-20 rounded-md" />
                      </div>
                    </div>
                  ) : cIdx === columns - 1 ? (
                    <div className="flex items-center gap-2 justify-end">
                      <SkeletonBase className="size-8 rounded-lg" />
                      <SkeletonBase className="size-8 rounded-lg" />
                    </div>
                  ) : (
                    <SkeletonBase
                      className={cn(
                        "h-4 rounded-md",
                        cIdx % 2 === 0 ? "w-24" : "w-16",
                      )}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// 9. SkeletonImage
// ============================================================================
export interface SkeletonImageProps extends React.ComponentProps<"div"> {
  aspectRatio?: "square" | "video" | "4/3" | "16/9" | "portrait" | "banner";
  showIcon?: boolean;
}

export function SkeletonImage({
  aspectRatio = "4/3",
  showIcon = true,
  className,
  ...props
}: SkeletonImageProps) {
  const aspectClass = {
    square: "aspect-square",
    video: "aspect-video",
    "4/3": "aspect-[4/3]",
    "16/9": "aspect-[16/9]",
    portrait: "aspect-[3/4]",
    banner: "aspect-[21/9]",
  }[aspectRatio];

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-xl bg-surface-media/50",
        aspectClass,
        className,
      )}
      aria-hidden="true"
      {...props}
    >
      <SkeletonBase className="size-full rounded-none" />
      {showIcon && (
        <div className="pointer-events-none absolute flex flex-col items-center justify-center text-muted-foreground/30">
          <ImageIcon className="size-8" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 10. SkeletonForm
// ============================================================================
export interface SkeletonFormProps {
  fields?: number;
  columns?: 1 | 2;
  hasButton?: boolean;
  buttonText?: string;
  className?: string;
}

export function SkeletonForm({
  fields = 4,
  columns = 1,
  hasButton = true,
  className,
}: SkeletonFormProps) {
  return (
    <div className={cn("space-y-4", className)} aria-hidden="true">
      <div
        className={cn(
          "grid gap-4",
          columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
        )}
      >
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <SkeletonBase className="h-3.5 w-24 rounded-md" />
            <SkeletonBase className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
      {hasButton && (
        <div className="pt-2">
          <SkeletonBase className="h-11 w-full sm:w-40 rounded-full" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 11. SkeletonDashboardCard
// ============================================================================
export interface SkeletonDashboardCardProps {
  className?: string;
}

export function SkeletonDashboardCard({ className }: SkeletonDashboardCardProps) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-surface p-5 shadow-card", className)}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <SkeletonBase className="h-3 w-24 rounded-md" />
          <SkeletonBase className="h-7 w-28 rounded-md" />
        </div>
        <SkeletonBase className="size-10 rounded-xl" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
        <SkeletonBase className="h-3 w-16 rounded-md" />
        <SkeletonBase className="h-3 w-20 rounded-md" />
      </div>
    </div>
  );
}
