"use client";

import * as React from "react";
import { AlertTriangle, Download, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EU_SIZES, getColorwayTotalStock } from "@/data/mock-footwear";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";

export default function AdminInventoryPage() {
  const { products, updateSizeStock, bulkRestockProduct } = useCatalogStore();
  const addToast = useUiStore((s) => s.addToast);

  const [query, setQuery] = React.useState("");
  const [onlyLowStock, setOnlyLowStock] = React.useState(false);

  const inventoryRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = products.flatMap((product) =>
      product.colorways.map((colorway) => ({
        product,
        colorway,
        totalPairs: getColorwayTotalStock(colorway.stockBySize),
        hasCritical: EU_SIZES.some((sz) => {
          const val = colorway.stockBySize[sz];
          return val !== undefined && val <= 2;
        }),
      })),
    );

    return rows.filter((row) => {
      if (
        q &&
        !row.product.name.toLowerCase().includes(q) &&
        !row.product.sku.toLowerCase().includes(q) &&
        !row.colorway.name.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (onlyLowStock && !row.hasCritical) return false;
      return true;
    });
  }, [products, query, onlyLowStock]);

  const totalUnits = inventoryRows.reduce((sum, r) => sum + r.totalPairs, 0);

  const handleExportCsv = () => {
    const header = ["Product", "SKU", "Colorway", ...EU_SIZES.map((s) => `EU_${s}`), "Total"];
    const lines = inventoryRows.map((r) =>
      [
        `"${r.product.name}"`,
        r.product.sku,
        `"${r.colorway.name}"`,
        ...EU_SIZES.map((sz) => String(r.colorway.stockBySize[sz] ?? 0)),
        String(r.totalPairs),
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "addisgebeya-inventory-matrix.csv";
    a.click();
    URL.revokeObjectURL(url);
    addToast({ title: "Inventory Exported", description: "Downloaded CSV size audit.", variant: "success" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold text-foreground">
              Size &amp; Color Inventory Matrix
            </h1>
            <Badge variant="soft">{totalUnits} Physical Pairs</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Edit stock quantities per shoe, colorway, and Continental EU size. Setting any size to
            0 immediately disables purchasing on the customer storefront.
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={handleExportCsv}>
          <Download className="size-4" /> Export Size Audit CSV
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by shoe model, SKU, or colorway..."
            className="pl-10"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-surface-low px-4 py-2.5 text-xs font-bold text-foreground">
          <input
            type="checkbox"
            checked={onlyLowStock}
            onChange={(e) => setOnlyLowStock(e.target.checked)}
            className="size-4 accent-cta"
          />
          <AlertTriangle className="size-3.5 text-cta" /> Show Low / Out-of-Stock Only
        </label>
      </div>

      {/* Interactive Matrix Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-low font-label text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <th className="px-4 py-3.5">Shoe Model &amp; Colorway</th>
              {EU_SIZES.map((sz) => (
                <th key={sz} className="px-2 py-3.5 text-center whitespace-nowrap">
                  EU {sz}
                </th>
              ))}
              <th className="px-4 py-3.5 text-right whitespace-nowrap">Total</th>
              <th className="px-4 py-3.5 text-right whitespace-nowrap">Quick Restock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {inventoryRows.map(({ product, colorway, totalPairs }) => (
              <tr key={`${product.id}-${colorway.id}`} className="hover:bg-surface-low/40">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-surface-media p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={colorway.images[0]}
                        alt={product.name}
                        className="size-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold text-foreground">
                        {product.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span
                          className="inline-block size-2.5 rounded-full border border-border"
                          style={{ backgroundColor: colorway.hex }}
                        />
                        <span className="truncate">{colorway.name}</span>
                      </div>
                    </div>
                  </div>
                </td>

                {EU_SIZES.map((sz) => {
                  const val = colorway.stockBySize[sz] ?? 0;
                  const isZero = val === 0;
                  const isLow = val > 0 && val <= 2;

                  return (
                    <td key={sz} className="px-1.5 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        aria-label={`${product.name} ${colorway.name} EU ${sz} stock`}
                        value={val}
                        onChange={(e) =>
                          updateSizeStock(
                            product.id,
                            colorway.id,
                            sz,
                            Math.max(0, Number(e.target.value) || 0),
                          )
                        }
                        className={cn(
                          "h-9 w-13 rounded-lg border text-center font-mono text-xs font-bold focus:border-primary focus:outline-none",
                          isZero
                            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                            : isLow
                              ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                              : "border-border bg-surface-low text-foreground",
                        )}
                      />
                    </td>
                  );
                })}

                <td className="px-4 py-3 text-right font-display text-sm font-extrabold text-primary whitespace-nowrap">
                  {totalPairs} prs
                </td>

                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const restocked: Record<number, number> = {};
                      for (const sz of EU_SIZES) {
                        const current = colorway.stockBySize[sz] ?? 0;
                        restocked[sz] = current < 3 ? current + 5 : current;
                      }
                      bulkRestockProduct(product.id, colorway.id, restocked);
                      addToast({
                        title: "Low Sizes Replenished",
                        description: `Added +5 pairs to low-stock EU sizes for ${product.name}.`,
                        variant: "success",
                      });
                    }}
                  >
                    <Plus className="size-3.5" /> +5 Low
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

