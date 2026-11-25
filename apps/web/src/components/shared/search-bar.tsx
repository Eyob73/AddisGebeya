"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useCatalogStore } from "@/stores/catalog.store";
import { formatETB } from "@/utils/format";
import { DEFAULT_FALLBACK_IMAGE, getThumbnailImageUrl } from "@/utils/cloudinary";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  onNavigate?: () => void;
}

export function SearchBar({
  className,
  placeholder = "Search sneakers, boots, running shoes...",
  onNavigate,
}: SearchBarProps) {
  const router = useRouter();
  const products = useCatalogStore((s) => s.products);
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);

  const suggestions = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.status === "active" &&
          (p.name.toLowerCase().includes(q) ||
            p.categoryName.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q)),
      )
      .slice(0, 5);
  }, [products, query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    setFocused(false);
    onNavigate?.();
    if (trimmed) {
      router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/shop");
    }
  };

  return (
    <div className={cn("relative", className)}>
      <form
        onSubmit={handleSubmit}
        className="flex h-10 items-center rounded-full border border-border/80 bg-surface px-3.5 shadow-card transition-all focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15"
      >
        <Search className="mr-2 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          placeholder={placeholder}
          aria-label="Search footwear catalog"
          className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="ml-1 rounded-full p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </form>

      {focused && query.trim().length > 0 ? (
        <div className="absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          {suggestions.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No shoes matched &ldquo;{query}&rdquo;. Press Enter to browse all.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {suggestions.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  onClick={() => {
                    setFocused(false);
                    setQuery("");
                    onNavigate?.();
                  }}
                  className="flex items-center gap-3 p-2.5 transition-colors hover:bg-surface-low"
                >
                  <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-surface-media p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getThumbnailImageUrl(product.colorways[0]?.images[0])}
                      alt={product.name}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                      }}
                      className="size-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{product.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {product.categoryName}
                    </p>
                  </div>
                  <span className="font-display text-xs font-extrabold text-primary whitespace-nowrap">
                    {formatETB(product.priceETB)}
                  </span>
                </Link>
              ))}
              <button
                type="submit"
                onMouseDown={handleSubmit}
                className="w-full bg-surface-low/80 py-2 text-center font-label text-xs font-bold text-primary hover:bg-surface-container cursor-pointer"
              >
                View all results for &ldquo;{query}&rdquo;
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

