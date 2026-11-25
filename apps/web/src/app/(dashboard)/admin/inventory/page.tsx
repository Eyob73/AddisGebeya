"use client";

import * as React from "react";
import { AlertTriangle, Download, Loader2, Plus, RotateCcw, Save, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_FALLBACK_IMAGE, getThumbnailImageUrl } from "@/utils/cloudinary";
import { Input } from "@/components/ui/input";
import { AdminInventorySkeleton } from "@/components/shared/page-skeletons";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { EU_SIZES, KIDS_EU_SIZES } from "@/data/mock-footwear";
import { useProductsQuery } from "@/hooks/use-store-queries";
import { storeService } from "@/services/store.service";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";

interface DraftColorwayChanges {
  productId: string;
  colorwayId: string;
  changes: Record<number, number>;
}

function getStockInputToneClass(hasDraft: boolean, isConfigured: boolean, val: number): string {
  if (hasDraft) {
    return "border-primary bg-primary-light/30 text-primary ring-2 ring-primary/30";
  }
  if (!isConfigured) {
    return "border-border/50 bg-surface text-muted-foreground/60";
  }
  if (val === 0) {
    return "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300";
  }
  if (val > 0 && val <= 2) {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  }
  return "border-border bg-surface-low text-foreground";
}

function getMobileSizesForRow(
  gender: string,
  stockBySize: Record<number, number>,
  rowDraft?: Record<number, number>,
): number[] {
  const baseSizes: readonly number[] = gender === "Kids" ? KIDS_EU_SIZES : EU_SIZES;
  const set = new Set<number>(baseSizes);
  for (const key of Object.keys(stockBySize)) {
    const parsed = Number(key);
    if (Number.isFinite(parsed) && parsed > 0) set.add(parsed);
  }
  if (rowDraft) {
    for (const key of Object.keys(rowDraft)) {
      const parsed = Number(key);
      if (Number.isFinite(parsed) && parsed > 0) set.add(parsed);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

export default function AdminInventoryPage() {
  const queryClient = useQueryClient();
  const { data: products = [], isLoading, refetch } = useProductsQuery({ status: "all" });
  const addToast = useUiStore((s) => s.addToast);

  const [query, setQuery] = React.useState("");
  const [onlyLowStock, setOnlyLowStock] = React.useState(false);
  const [draftStocks, setDraftStocks] = React.useState<Record<string, DraftColorwayChanges>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const isMounted = useIsMounted();

  const displaySizes = React.useMemo(() => {
    const sizeSet = new Set<number>(EU_SIZES);
    for (const product of products) {
      for (const cw of product.colorways) {
        for (const key of Object.keys(cw.stockBySize)) {
          const parsed = Number(key);
          if (Number.isFinite(parsed) && parsed > 0) sizeSet.add(parsed);
        }
      }
    }
    return Array.from(sizeSet).sort((a, b) => a - b);
  }, [products]);

  const inventoryRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = products.flatMap((product) =>
      product.colorways.map((colorway) => {
        const rowKey = `${product.id}::${colorway.id}`;
        const rowDraft = draftStocks[rowKey]?.changes;

        let totalPairs = 0;
        const allSizeKeys = new Set<number>([
          ...Object.keys(colorway.stockBySize)
            .map((k) => Number(k))
            .filter((n) => Number.isFinite(n) && n > 0),
          ...(rowDraft
            ? Object.keys(rowDraft)
                .map((k) => Number(k))
                .filter((n) => Number.isFinite(n) && n > 0)
            : []),
        ]);

        for (const sz of allSizeKeys) {
          const effectiveQty = rowDraft?.[sz] ?? colorway.stockBySize[sz] ?? 0;
          totalPairs += Math.max(0, effectiveQty);
        }

        const hasCritical = displaySizes.some((sz) => {
          const isTracked = colorway.stockBySize[sz] !== undefined || rowDraft?.[sz] !== undefined;
          if (!isTracked) return false;
          const val = rowDraft?.[sz] ?? colorway.stockBySize[sz] ?? 0;
          return val <= 2;
        });

        return {
          rowKey,
          product,
          colorway,
          rowDraft,
          totalPairs,
          hasCritical,
          isDirty: Boolean(rowDraft && Object.keys(rowDraft).length > 0),
        };
      }),
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
  }, [products, query, onlyLowStock, displaySizes, draftStocks]);

  const totalUnits = inventoryRows.reduce((sum, r) => sum + r.totalPairs, 0);

  const pendingSummary = React.useMemo(() => {
    const entries = Object.values(draftStocks).filter((d) => Object.keys(d.changes).length > 0);
    const cellCount = entries.reduce((sum, d) => sum + Object.keys(d.changes).length, 0);
    return {
      rows: entries,
      rowCount: entries.length,
      cellCount,
    };
  }, [draftStocks]);

  const setDraftQuantity = (
    productId: string,
    colorwayId: string,
    originalStockBySize: Record<number, number>,
    size: number,
    nextQty: number,
  ) => {
    const normalized = Math.max(0, Math.floor(Number.isFinite(nextQty) ? nextQty : 0));
    const original = originalStockBySize[size] ?? 0;
    const rowKey = `${productId}::${colorwayId}`;

    setDraftStocks((prev) => {
      const existingRow = prev[rowKey]?.changes ?? {};
      const nextChanges = { ...existingRow };

      if (normalized === original) {
        delete nextChanges[size];
      } else {
        nextChanges[size] = normalized;
      }

      if (Object.keys(nextChanges).length === 0) {
        const next = { ...prev };
        delete next[rowKey];
        return next;
      }

      return {
        ...prev,
        [rowKey]: {
          productId,
          colorwayId,
          changes: nextChanges,
        },
      };
    });
  };

  const handleStageLowRestock = (
    productId: string,
    colorwayId: string,
    originalStockBySize: Record<number, number>,
  ) => {
    const rowKey = `${productId}::${colorwayId}`;
    const targetSizes = Object.keys(originalStockBySize)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n));
    const sizesToFill = targetSizes.length > 0 ? targetSizes : [...EU_SIZES];

    setDraftStocks((prev) => {
      const currentChanges = { ...(prev[rowKey]?.changes ?? {}) };
      for (const sz of sizesToFill) {
        const current = currentChanges[sz] ?? originalStockBySize[sz] ?? 0;
        const bumped = current < 3 ? current + 5 : current;
        const original = originalStockBySize[sz] ?? 0;
        if (bumped === original) {
          delete currentChanges[sz];
        } else {
          currentChanges[sz] = bumped;
        }
      }

      if (Object.keys(currentChanges).length === 0) {
        const next = { ...prev };
        delete next[rowKey];
        return next;
      }

      return {
        ...prev,
        [rowKey]: {
          productId,
          colorwayId,
          changes: currentChanges,
        },
      };
    });

    addToast({
      title: "Restock Staged",
      description: "Low-stock EU sizes boosted in draft. Click Save Changes to apply.",
      variant: "default",
    });
  };

  const handleDiscardChanges = () => {
    setDraftStocks({});
    addToast({
      title: "Changes Discarded",
      description: "Reverted all unsaved stock edits to live inventory values.",
      variant: "default",
    });
  };

  const handleSaveChanges = async () => {
    if (isSaving || pendingSummary.cellCount === 0) return;

    setIsSaving(true);
    try {
      await Promise.all(
        pendingSummary.rows.map((entry) =>
          storeService.bulkRestockProduct(entry.productId, entry.colorwayId, entry.changes),
        ),
      );

      const savedCells = pendingSummary.cellCount;
      const savedRows = pendingSummary.rowCount;

      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["product"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      ]);

      setDraftStocks({});

      addToast({
        title: "Inventory Saved",
        description: `Applied ${savedCells} size stock update${savedCells === 1 ? "" : "s"} across ${savedRows} colorway${savedRows === 1 ? "" : "s"}.`,
        variant: "success",
      });
    } catch (err: unknown) {
      addToast({
        title: "Failed to Save Inventory",
        description:
          err instanceof Error
            ? err.message
            : "Could not save stock updates. Your unsaved edits are still preserved.",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCsv = () => {
    const header = ["Product", "SKU", "Colorway", ...displaySizes.map((s) => `EU_${s}`), "Total"];
    const lines = inventoryRows.map((r) =>
      [
        `"${r.product.name}"`,
        r.product.sku,
        `"${r.colorway.name}"`,
        ...displaySizes.map((sz) => String(r.rowDraft?.[sz] ?? r.colorway.stockBySize[sz] ?? 0)),
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

  if (!isMounted || isLoading) {
    return <AdminInventorySkeleton />;
  }

  return (
    <div className="space-y-5 pb-24 sm:space-y-6">
      {/* Header & Top Action Bar */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold text-foreground sm:text-2xl">
              Size &amp; Color Inventory Matrix
            </h1>
            <Badge variant="soft">{totalUnits} Physical Pairs</Badge>
            {pendingSummary.cellCount > 0 ? (
              <Badge variant="cta">
                {pendingSummary.cellCount} Unsaved {pendingSummary.cellCount === 1 ? "Edit" : "Edits"}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Edit stock quantities per shoe, colorway, and Continental EU size, then click{" "}
            <strong>Save Changes</strong> to publish updates to the database and customer storefront.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 sm:h-10 sm:flex-initial sm:px-5 sm:whitespace-nowrap"
            onClick={handleExportCsv}
          >
            <Download className="size-4 shrink-0" />
            <span className="sm:hidden">Export CSV</span>
            <span className="hidden sm:inline">Export Size Audit CSV</span>
          </Button>
          {pendingSummary.cellCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSaving}
              className="sm:h-10 sm:px-4 sm:whitespace-nowrap"
              onClick={handleDiscardChanges}
            >
              <RotateCcw className="size-4 shrink-0" />
              <span>Discard</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="cta"
            size="sm"
            disabled={pendingSummary.cellCount === 0 || isSaving}
            className="flex-1 sm:h-10 sm:flex-initial sm:px-5 sm:whitespace-nowrap"
            onClick={handleSaveChanges}
          >
            {isSaving ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : (
              <Save className="size-4 shrink-0" />
            )}
            <span>
              {isSaving
                ? "Saving..."
                : pendingSummary.cellCount > 0
                  ? `Save (${pendingSummary.cellCount})`
                  : "Save Changes"}
            </span>
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-card sm:flex-row sm:items-center sm:p-4">
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
          <AlertTriangle className="size-3.5 shrink-0 text-cta" />
          <span>Show Low / Out-of-Stock Only</span>
        </label>
      </div>

      {/* Mobile Inventory Cards View (< md) */}
      <div className="space-y-3 md:hidden">
        {inventoryRows.map(({ rowKey, product, colorway, rowDraft, totalPairs, isDirty }) => {
          const mobileSizes = getMobileSizesForRow(
            product.gender,
            colorway.stockBySize,
            rowDraft,
          );

          return (
            <div
              key={rowKey}
              className={cn(
                "rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors",
                isDirty && "border-primary/40 bg-primary-light/10",
              )}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-surface-media p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getThumbnailImageUrl(colorway.images[0])}
                      alt={product.name}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                      }}
                      className="size-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-display text-sm font-bold text-foreground">
                        {product.name}
                      </p>
                      {isDirty ? (
                        <span className="rounded bg-cta-light px-1.5 py-0.5 font-label text-[10px] font-bold text-cta-text">
                          Edited
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span
                        className="inline-block size-2.5 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: colorway.hex }}
                      />
                      <span className="truncate">{colorway.name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-display text-sm font-extrabold text-primary whitespace-nowrap">
                    {totalPairs} prs
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2.5 text-[11px]"
                    onClick={() =>
                      handleStageLowRestock(product.id, colorway.id, colorway.stockBySize)
                    }
                  >
                    <Plus className="size-3" /> +5 Low
                  </Button>
                </div>
              </div>

              {/* Mobile EU Size Grid */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {mobileSizes.map((sz) => {
                  const hasDraft = rowDraft?.[sz] !== undefined;
                  const isConfigured = colorway.stockBySize[sz] !== undefined || hasDraft;
                  const val = rowDraft?.[sz] ?? colorway.stockBySize[sz] ?? 0;

                  return (
                    <label
                      key={sz}
                      className="flex flex-col items-center gap-1 rounded-lg bg-surface-low/60 p-1.5"
                    >
                      <span className="font-label text-[10px] font-bold text-muted-foreground">
                        EU {sz}
                      </span>
                      <input
                        type="number"
                        min={0}
                        aria-label={`${product.name} ${colorway.name} EU ${sz} stock mobile`}
                        value={val}
                        onChange={(e) =>
                          setDraftQuantity(
                            product.id,
                            colorway.id,
                            colorway.stockBySize,
                            sz,
                            Number(e.target.value) || 0,
                          )
                        }
                        className={cn(
                          "h-9 w-full rounded-md border text-center font-mono text-xs font-bold focus:border-primary focus:outline-none transition-colors",
                          getStockInputToneClass(hasDraft, isConfigured, val),
                        )}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop / Tablet Matrix Table (>= md) */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-low font-label text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <th className="px-4 py-3.5">Shoe Model &amp; Colorway</th>
              {displaySizes.map((sz) => (
                <th key={sz} className="px-2 py-3.5 text-center whitespace-nowrap">
                  EU {sz}
                </th>
              ))}
              <th className="px-4 py-3.5 text-right whitespace-nowrap">Total</th>
              <th className="px-4 py-3.5 text-right whitespace-nowrap">Quick Restock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {inventoryRows.map(({ rowKey, product, colorway, rowDraft, totalPairs, isDirty }) => (
              <tr
                key={rowKey}
                className={cn(
                  "hover:bg-surface-low/40",
                  isDirty && "bg-primary-light/15",
                )}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-surface-media p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getThumbnailImageUrl(colorway.images[0])}
                        alt={product.name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                        }}
                        className="size-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-display text-sm font-bold text-foreground">
                          {product.name}
                        </p>
                        {isDirty ? (
                          <span className="rounded bg-cta-light px-1.5 py-0.5 font-label text-[10px] font-bold text-cta-text">
                            Edited
                          </span>
                        ) : null}
                      </div>
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

                {displaySizes.map((sz) => {
                  const hasDraft = rowDraft?.[sz] !== undefined;
                  const isConfigured = colorway.stockBySize[sz] !== undefined || hasDraft;
                  const val = rowDraft?.[sz] ?? colorway.stockBySize[sz] ?? 0;

                  return (
                    <td key={sz} className="px-1.5 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        aria-label={`${product.name} ${colorway.name} EU ${sz} stock`}
                        value={val}
                        onChange={(e) =>
                          setDraftQuantity(
                            product.id,
                            colorway.id,
                            colorway.stockBySize,
                            sz,
                            Number(e.target.value) || 0,
                          )
                        }
                        className={cn(
                          "h-9 w-13 rounded-lg border text-center font-mono text-xs font-bold focus:border-primary focus:outline-none transition-colors",
                          getStockInputToneClass(hasDraft, isConfigured, val),
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
                    onClick={() =>
                      handleStageLowRestock(product.id, colorway.id, colorway.stockBySize)
                    }
                  >
                    <Plus className="size-3.5" /> +5 Low
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sticky Bottom Save Bar when edits are pending */}
      {pendingSummary.cellCount > 0 ? (
        <div className="sticky bottom-3 z-30 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-surface/95 p-3.5 shadow-lg backdrop-blur-md sm:bottom-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="flex size-2.5 shrink-0 rounded-full bg-cta" />
            <span className="font-label font-bold text-foreground">
              {pendingSummary.cellCount} unsaved stock{" "}
              {pendingSummary.cellCount === 1 ? "change" : "changes"} across{" "}
              {pendingSummary.rowCount}{" "}
              {pendingSummary.rowCount === 1 ? "colorway" : "colorways"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isSaving}
              className="flex-1 sm:flex-initial"
              onClick={handleDiscardChanges}
            >
              <RotateCcw className="size-3.5" /> Discard
            </Button>
            <Button
              type="button"
              size="sm"
              variant="cta"
              disabled={isSaving}
              className="flex-1 sm:flex-initial"
              onClick={handleSaveChanges}
            >
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              <span>{isSaving ? "Saving..." : "Save Changes"}</span>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
