"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  CheckCircle2,
  Download,
  FileBarChart,
  ImagePlus,
  Layers,
  Package,
  Percent,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  Wallet,
} from "lucide-react";
import { DashboardStatCard } from "@/components/shared/dashboard-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/dialog";
import { getColorwayTotalStock, getProductTotalStock } from "@/data/mock-footwear";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import { formatETB } from "@/utils/format";

const MATRIX_SIZES = [39, 40, 41, 42, 43, 44, 45] as const;

export default function AdminOverviewPage() {
  const {
    products,
    orders,
    paymentSlips,
    settings,
    updateSizeStock,
    updateOrderStatus,
    attachSlipToOrder,
  } = useCatalogStore();
  const addToast = useUiStore((s) => s.addToast);

  const [txCode, setTxCode] = React.useState("");
  const [verifyMessage, setVerifyMessage] = React.useState<string | null>(null);
  const [restockTarget, setRestockTarget] = React.useState<{
    productId: string;
    colorwayId: string;
    name: string;
    colorwayName: string;
  } | null>(null);

  const totalRevenueETB = React.useMemo(
    () => 816350 + orders.reduce((sum, o) => sum + o.totalETB, 0),
    [orders],
  );
  const totalPhysicalPairs = React.useMemo(
    () => products.reduce((sum, p) => sum + getProductTotalStock(p), 0),
    [products],
  );
  const criticalSizesCount = React.useMemo(() => {
    let count = 0;
    for (const p of products) {
      for (const cw of p.colorways) {
        for (const sz of MATRIX_SIZES) {
          if (cw.stockBySize[sz] === 0) count++;
        }
      }
    }
    return count;
  }, [products]);

  const activeDispatches = orders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled",
  );

  const handleVerifyTx = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = txCode.trim().toUpperCase();
    if (!cleaned) return;
    setVerifyMessage(
      `Reference ${cleaned} logged for verification against Telebirr / CBE ledger.`,
    );
    setTxCode("");
    addToast({
      title: "Transaction Reference Checked",
      description: `Reference ${cleaned} matched in local preview ledger.`,
      variant: "success",
    });
  };

  const handleExportAudit = () => {
    const header = ["Product", "SKU", "Colorway", ...MATRIX_SIZES.map((s) => `EU_${s}`), "Total"];
    const rows = products.flatMap((p) =>
      p.colorways.map((cw) => [
        `"${p.name}"`,
        p.sku,
        `"${cw.name}"`,
        ...MATRIX_SIZES.map((s) => String(cw.stockBySize[s] ?? 0)),
        String(getColorwayTotalStock(cw.stockBySize)),
      ]),
    );
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "addisgebeya-size-audit.csv";
    a.click();
    URL.revokeObjectURL(url);
    addToast({ title: "Size Audit Exported", description: "Downloaded addisgebeya-size-audit.csv", variant: "success" });
  };

  const restockProduct = restockTarget
    ? products.find((p) => p.id === restockTarget.productId)
    : undefined;
  const restockColorway = restockProduct?.colorways.find(
    (cw) => cw.id === restockTarget?.colorwayId,
  );

  return (
    <div className="space-y-8">
      {/* KPI Grid (Exact Stitch 4-Card Row) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Month Revenue"
          value={totalRevenueETB.toLocaleString("en-US")}
          unit="ETB"
          icon={Wallet}
          badge="+18.4% vs last month"
          progressPercent={78}
        />
        <DashboardStatCard
          label="Total Orders"
          value={String(190 + orders.length)}
          unit="Orders"
          icon={ShoppingBag}
          subLeft="Repeat Shoppers: 34%"
          subRight="Bole & Kazanchis Top"
        />
        <DashboardStatCard
          label="Catalog & Pairs"
          value={String(products.length)}
          unit="Styles"
          icon={Layers}
          subLeft={`${totalPhysicalPairs} Physical Pairs`}
          subRight={`${criticalSizesCount} Sizes at 0`}
        />
        <DashboardStatCard
          label="Dispatches Today"
          value={String(activeDispatches.length + 15)}
          unit="En Route"
          icon={Bike}
          accent="cta"
          subLeft="Addis + Regional"
          subRight="All Assigned"
        />
      </section>

      {/* Size-Specific Stock Matrix (Stitch Critical Footwear Admin Section) */}
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-foreground">
                Size-Specific Stock Matrix
              </h2>
              <Badge variant="soft">Live Inventory</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Footwear EU size breakdown per SKU. Updating stock here immediately updates customer
              size availability.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button type="button" variant="secondary" size="sm" onClick={handleExportAudit}>
              <Download className="size-3.5" /> Export Size Audit
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/inventory">
                <SlidersHorizontal className="size-3.5" /> Full Inventory Matrix
              </Link>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface-low font-label text-xs font-bold tracking-wider text-muted-foreground uppercase">
                <th className="rounded-l-lg px-4 py-3">Shoe Model &amp; Colorway</th>
                {MATRIX_SIZES.map((sz) => (
                  <th key={sz} className="px-2.5 py-3 text-center whitespace-nowrap">
                    EU {sz}
                  </th>
                ))}
                <th className="px-4 py-3 text-right whitespace-nowrap">Total Pairs</th>
                <th className="rounded-r-lg px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {products.slice(0, 5).map((product) => {
                const cw = product.colorways[0];
                if (!cw) return null;
                const totalPairs = getColorwayTotalStock(cw.stockBySize);
                const zeroSizes = MATRIX_SIZES.filter((sz) => cw.stockBySize[sz] === 0);

                return (
                  <tr key={product.id} className="transition-colors hover:bg-surface-low/40">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-surface-media p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cw.images[0]}
                            alt={product.name}
                            className="size-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-bold text-foreground">
                            {product.name}
                          </p>
                          <p className="truncate font-label text-[11px] text-muted-foreground">
                            {product.sku} • {cw.name}
                          </p>
                          <p className="font-display text-xs font-bold text-primary">
                            {formatETB(product.priceETB)}
                          </p>
                        </div>
                      </div>
                    </td>
                    {MATRIX_SIZES.map((sz) => {
                      const val = cw.stockBySize[sz];
                      if (val === undefined) {
                        return (
                          <td key={sz} className="px-2 py-3 text-center font-mono text-muted-foreground/40">
                            —
                          </td>
                        );
                      }
                      if (val === 0) {
                        return (
                          <td key={sz} className="px-2 py-3 text-center">
                            <span
                              title="Out of Stock"
                              className="inline-flex items-center gap-0.5 rounded-md bg-red-100 px-2 py-1 font-mono font-bold text-red-800 dark:bg-red-950/60 dark:text-red-300"
                            >
                              0 <AlertTriangle className="size-3" />
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={sz} className="px-2 py-3 text-center">
                          <span className="inline-block rounded-md bg-surface-container px-2.5 py-1 font-mono font-bold text-foreground">
                            {val}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="block font-display text-sm font-extrabold text-foreground">
                        {totalPairs} pairs
                      </span>
                      {zeroSizes.length > 0 ? (
                        <span className="font-label text-[10px] font-bold text-cta uppercase">
                          Restock {zeroSizes.join(", ")}
                        </span>
                      ) : (
                        <span className="font-label text-[10px] font-bold text-primary uppercase">
                          Optimal Curve
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setRestockTarget({
                            productId: product.id,
                            colorwayId: cw.id,
                            name: product.name,
                            colorwayName: cw.name,
                          })
                        }
                      >
                        Adjust
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Stock Alert Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-low p-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FFDBD0] text-cta">
              <Package className="size-4" />
            </span>
            <p className="text-foreground">
              <strong>Stock Alert:</strong> {criticalSizesCount} EU size slots are currently at 0
              pairs. Peak demand recorded in Bole and Kazanchis.
            </p>
          </div>
          <Link
            href="/admin/inventory"
            className="font-label font-bold text-primary hover:underline"
          >
            Batch Adjust All Sizes →
          </Link>
        </div>
      </section>

      {/* Two-Column Section: Live Orders & Dispatch Queue + Payment Verification */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Live Orders & Dispatch Queue (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Live Orders &amp; Dispatch Queue
              </h2>
              <p className="text-xs text-muted-foreground">
                Real-time deliveries across Addis Ababa and inter-city cargo transit.
              </p>
            </div>
            <Link
              href="/admin/orders"
              className="rounded-full bg-surface-container px-3 py-1 font-label text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors"
            >
              {activeDispatches.length} Active Orders →
            </Link>
          </div>

          <div className="space-y-3">
            {orders.slice(0, 4).map((order) => (
              <div
                key={order.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
                    <Truck className="size-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-extrabold text-foreground">
                        #{order.id}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        • {order.customerName}
                      </span>
                      <Badge
                        variant={order.paymentStatus === "verified" ? "soft" : "outline"}
                        className="text-[10px]"
                      >
                        {order.paymentStatus === "verified"
                          ? `${order.paymentMethod.replace("_", " ")} Verified`
                          : order.paymentMethod === "cod"
                            ? "Cash on Delivery"
                            : "Payment Pending"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Destination: <strong className="text-foreground">{order.subCity}</strong> •{" "}
                      {order.items.reduce((s, i) => s + i.quantity, 0)} pair(s) (EU{" "}
                      {order.items.map((i) => i.size).join(", EU ")})
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-display font-extrabold text-primary">
                        {formatETB(order.totalETB)}
                      </span>
                      <span className="font-label text-[11px] font-semibold text-cta">
                        {order.courierName ??
                          (order.waybill
                            ? `Waybill #${order.waybill}`
                            : "Ready for Courier Assignment")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                  <Badge
                    variant={
                      order.status === "delivered"
                        ? "success"
                        : order.status === "out_for_delivery"
                          ? "cta"
                          : "soft"
                    }
                  >
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                  {order.status === "packed" || order.status === "confirmed" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        updateOrderStatus(order.id, "out_for_delivery", "Courier Dawit (Bike #07)");
                        addToast({
                          title: `Rider Assigned to #${order.id}`,
                          description: "Courier Dawit (Bike #07) dispatched from Bole Hub.",
                          variant: "success",
                        });
                      }}
                    >
                      Assign Rider
                    </Button>
                  ) : (
                    <Link
                      href={`/admin/orders`}
                      className="inline-flex items-center gap-1 font-label text-xs font-bold text-primary hover:underline"
                    >
                      Manage <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Payment Verifications + Quick Actions + Flagship Card (5 cols) */}
        <div className="space-y-5 lg:col-span-5">
          {/* Payment Verifications Widget */}
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-foreground">
                Payment Verifications
              </h3>
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              Match customer SMS Transaction IDs against Telebirr SuperApp and CBE Birr transfers.
            </p>

            <form onSubmit={handleVerifyTx} className="space-y-2">
              <label className="block font-label text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                Enter Telebirr / CBE Reference Code
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={txCode}
                    onChange={(e) => setTxCode(e.target.value)}
                    placeholder="e.g. TLB8934JKS29..."
                    className="h-10 w-full rounded-full border border-border bg-surface-low pr-9 pl-4 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                  />
                  <Search className="pointer-events-none absolute top-2.5 right-3 size-4 text-muted-foreground" />
                </div>
                <Button type="submit" size="sm">
                  Verify
                </Button>
              </div>
              {verifyMessage ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-primary-light p-2.5 text-xs font-semibold text-primary">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{verifyMessage}</span>
                </div>
              ) : null}
            </form>

            {/* Unmatched Slips */}
            <div className="space-y-2 pt-1">
              <p className="font-label text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                Unmatched Incoming Slips ({paymentSlips.length})
              </p>
              {paymentSlips.length === 0 ? (
                <p className="rounded-xl bg-surface-low p-3 text-xs text-muted-foreground">
                  All incoming Telebirr &amp; CBE slips are reconciled.
                </p>
              ) : (
                paymentSlips.map((slip) => (
                  <div
                    key={slip.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-surface-low p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-label text-xs font-bold text-foreground">
                        {slip.reference} • {formatETB(slip.amountETB)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        From: {slip.senderName} ({slip.senderInfo})
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="cta"
                      size="sm"
                      onClick={() => {
                        const targetOrderId = orders[0]?.id ?? "AG-9482";
                        attachSlipToOrder(slip.id, targetOrderId);
                        addToast({
                          title: "Payment Slip Matched",
                          description: `${slip.reference} attached to Order #${targetOrderId}.`,
                          variant: "success",
                        });
                      }}
                    >
                      Attach
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Storeowner Quick Actions */}
          <div className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-foreground">
                Storeowner Actions
              </h3>
              <span className="font-label text-[11px] font-bold text-primary">Addis Hub Ops</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  href: "/admin/products/new",
                  icon: ImagePlus,
                  title: "New Shoe Model",
                  sub: "Upload angles & sizes",
                },
                {
                  href: "/admin/reports",
                  icon: FileBarChart,
                  title: "Sales Report",
                  sub: "Daily Birr balance",
                },
                {
                  href: "/admin/categories",
                  icon: Percent,
                  title: "Categories",
                  sub: "Curate collections",
                },
                {
                  href: "/admin/settings",
                  icon: Truck,
                  title: "Courier Rates",
                  sub: "Addis & Regional fee",
                },
              ].map(({ href, icon: Icon, title, sub }) => (
                <Link
                  key={title}
                  href={href}
                  className="group flex items-start gap-2.5 rounded-xl bg-surface-low p-3 transition-colors hover:bg-surface-container"
                >
                  <span className="rounded-lg bg-surface p-2 text-primary shadow-xs transition-transform group-hover:scale-105">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-label text-xs font-bold text-foreground">{title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Physical Flagship Card */}
          <div className="rounded-2xl bg-primary-deep p-5 text-white shadow-md">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-label text-[10px] font-bold tracking-wider text-[#B0ECFF] uppercase">
                Physical Flagship Showroom
              </span>
              <span className="rounded-full bg-cta px-2.5 py-0.5 font-label text-[10px] font-bold">
                Open till 8:30 PM
              </span>
            </div>
            <h4 className="font-display text-base font-bold">Bole Medhanialem Studio</h4>
            <p className="mt-1 text-xs text-[#EBF6F8]/85">
              In-store shoe try-on sessions active. Customer pickup desk operational.
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3 font-label text-[11px] text-[#EBF6F8]">
              <span>Direct: {settings.phone}</span>
              <Link href="/" className="font-bold text-white underline">
                Storefront →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Inline Size Adjust Modal */}
      <ModalDialog
        open={Boolean(restockTarget && restockColorway)}
        onClose={() => setRestockTarget(null)}
        title={restockTarget ? `Adjust EU Sizes — ${restockTarget.name}` : ""}
        description={restockTarget?.colorwayName}
      >
        {restockTarget && restockColorway ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {MATRIX_SIZES.map((sz) => (
                <div
                  key={sz}
                  className="rounded-xl border border-border bg-surface-low p-3 text-center"
                >
                  <span className="block font-label text-xs font-bold text-primary">EU {sz}</span>
                  <input
                    type="number"
                    min={0}
                    value={restockColorway.stockBySize[sz] ?? 0}
                    onChange={(e) =>
                      updateSizeStock(
                        restockTarget.productId,
                        restockTarget.colorwayId,
                        sz,
                        Number(e.target.value) || 0,
                      )
                    }
                    className="mt-1.5 h-9 w-full rounded-lg border border-border bg-surface text-center font-mono text-sm font-bold text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="cta"
                onClick={() => {
                  setRestockTarget(null);
                  addToast({
                    title: "Size Stock Updated",
                    description: "Changes are live on the customer storefront.",
                    variant: "success",
                  });
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </ModalDialog>
    </div>
  );
}

