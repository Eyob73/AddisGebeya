import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ShoeCategory } from "@/types/store.types";
import { cn } from "@/lib/utils";

interface CategoryCardProps {
  category: ShoeCategory;
  index?: number;
  className?: string;
}

export function CategoryCard({ category, index = 0, className }: CategoryCardProps) {
  const isAlternate = index % 2 === 1;

  return (
    <Link
      href={`/category/${category.slug}`}
      className={cn(
        "group relative flex h-80 sm:h-96 flex-col justify-end overflow-hidden rounded-xl border border-border/60 bg-surface-container p-6 shadow-card transition-all duration-500 hover:shadow-card-hover",
        className,
      )}
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
        style={{ backgroundImage: `url("${category.image}")` }}
      />
      {/* Editorial Gradient Overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t to-transparent",
          isAlternate
            ? "from-[#0F172A]/95 via-[#0F172A]/45"
            : "from-[#0A1529]/95 via-[#0A1529]/40",
        )}
      />

      <div className="relative z-10 text-white">
        <span className="font-label text-[11px] font-bold tracking-widest text-banner-accent uppercase">
          {category.eyebrow}
        </span>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h3 className="font-display text-2xl font-bold tracking-tight">{category.name}</h3>
          <span className="flex size-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-transform duration-300 group-hover:translate-x-1 group-hover:bg-cta">
            <ArrowRight className="size-4" />
          </span>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-white/85">{category.subtitle}</p>
      </div>
    </Link>
  );
}

