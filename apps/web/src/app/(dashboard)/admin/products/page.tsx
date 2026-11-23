"use client";

import * as React from "react";
import Link from "next/link";
import { Edit3, ExternalLink, PlusCircle, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ConfirmationDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getProductTotalStock } from "@/data/mock-footwear";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import type { ShoeProduct } from "@/types/store.types";
import { formatETB } from "@/utils/format";

export default function AdminProductsPage() {
  const { products, categories, deleteProduct, updateProduct } = useCatalogStore();
  const addToast = useUiStore((s) => s.addToast);

  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [pendingDelete, setPendingDelete] = React.useState<ShoeProduct | null>(null);

  const filteredProducts = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q)) {
        return false;
      }
      if (categoryFilter !== "all" && p.categorySlug !== categoryFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [products, query, categoryFilter, statusFilter]);

  const columns: DataTableColumn<ShoeProduct>[] = [
    {
      key: "shoe",
      header: "Shoe Model",
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-surface-media p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.colorways[0]?.images[0]}
              alt={p.name}
              className="size-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-foreground">{p.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {p.sku} • {p.colorways.length} colorway{p.colorways.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (p) => (
        <div>
          <span className="font-semibold text-foreground">{p.categoryName}</span>
          <span className="block text-xs text-muted-foreground">{p.gender}</span>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price (ETB)",
      align: "right",
      render: (p) => (
        <div>
          <span className="font-display font-extrabold text-primary">{formatETB(p.priceETB)}</span>
          {p.compareAtPriceETB ? (
            <span className="block text-xs text-muted-foreground line-through">
              {formatETB(p.compareAtPriceETB)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "stock",
      header: "Total Pairs",
      align: "center",
      render: (p) => {
        const total = getProductTotalStock(p);
        return (
          <Badge variant={total === 0 ? "destructive" : total <= 8 ? "warning" : "soft"}>
            {total} pairs
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (p) => (
        <button
          type="button"
          onClick={() => {
            const next = p.status === "active" ? "draft" : "active";
            updateProduct(p.id, { status: next });
            addToast({
              title: "Catalog Status Updated",
              description: `${p.name} is now ${next}.`,
            });
          }}
          className="cursor-pointer"
          title="Click to toggle Active / Draft"
        >
          <Badge variant={p.status === "active" ? "success" : "outline"}>{p.status}</Badge>
        </button>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (p) => (
        <div className="inline-flex items-center gap-1.5">
          <Link
            href={`/products/${p.slug}`}
            title="View on Storefront"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary"
          >
            <ExternalLink className="size-3.5" />
          </Link>
          <Link
            href={`/admin/products/${p.id}/edit`}
            title="Edit shoe"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Edit3 className="size-3.5" />
          </Link>
          <button
            type="button"
            title="Delete shoe"
            onClick={() => setPendingDelete(p)}
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive cursor-pointer"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Product Management
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage all {products.length} AddisGebeya Shoes silhouettes, ETB pricing, and publishing
            status.
          </p>
        </div>
        <Button asChild variant="cta">
          <Link href="/admin/products/new">
            <PlusCircle className="size-4" /> Add New Shoe Model
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by shoe name, SKU, or brand..."
            className="pl-10"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-11 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-foreground"
        >
          <option value="all">All Categories</option>
          {categories
            .filter((c) => !["men", "women"].includes(c.slug))
            .map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-foreground"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filteredProducts}
        rowKey={(p) => p.id}
        emptyMessage="No shoe models match your filter."
      />

      <ConfirmationDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        destructive
        confirmLabel="Delete Shoe Model"
        title={`Delete "${pendingDelete?.name}"?`}
        description="This permanently removes the shoe model and its size stock matrix from your store catalog."
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteProduct(pendingDelete.id);
          addToast({
            title: "Product Deleted",
            description: `${pendingDelete.name} was removed from the catalog.`,
            variant: "warning",
          });
        }}
      />
    </div>
  );
}

