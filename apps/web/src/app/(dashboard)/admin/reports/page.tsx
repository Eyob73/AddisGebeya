"use client";

import * as React from "react";
import { BarChart3, Download, ShoppingBag, TrendingUp, Users, Wallet } from "lucide-react";
import { DashboardStatCard } from "@/components/shared/dashboard-stat-card";
import { AdminReportsSkeleton } from "@/components/shared/page-skeletons";
import { Button } from "@/components/ui/button";
import { useIsMounted } from "@/hooks/use-is-mounted";
import {
  useAdminDashboardQuery,
  useOrdersQuery,
  useProductsQuery,
} from "@/hooks/use-store-queries";
import { useUiStore } from "@/stores/ui.store";
import { formatETB } from "@/utils/format";

const MONTHLY_SERIES = [
  { month: "Jun", revenueETB: 520000, orders: 118 },
  { month: "Jul", revenueETB: 615000, orders: 141 },
  { month: "Aug", revenueETB: 589000, orders: 132 },
  { month: "Sep", revenueETB: 712000, orders: 164 },
  { month: "Oct", revenueETB: 778000, orders: 179 },
  { month: "Nov", revenueETB: 842500, orders: 194 },
];

const DEFAULT_PAYMENT_SPLIT = [
  { name: "Telebirr SuperApp", pct: 48, amountETB: 404400 },
  { name: "Cash / POS on Delivery", pct: 26, amountETB: 219050 },
  { name: "CBE Birr Mobile", pct: 18, amountETB: 151650 },
  { name: "Awash / Bank Transfer", pct: 8, amountETB: 67400 },
];

const DEFAULT_SUBCITY_SPLIT = [
  { area: "Bole (Medhanialem / Atlas)", orders: 68, share: 35 },
  { area: "Kirkos (Kazanchis / Meskel)", orders: 41, share: 21 },
  { area: "Yeka (CMC / Megenagna)", orders: 35, share: 18 },
  { area: "Nifas Silk - Lafto (Sarbet)", orders: 27, share: 14 },
  { area: "Regional Cargo (Hawassa / Bahir Dar)", orders: 23, share: 12 },
];

export default function AdminReportsPage() {
  const { data: orders = [], isLoading: loadingOrders } = useOrdersQuery();
  const { data: products = [], isLoading: loadingProducts } = useProductsQuery();
  const { data: dashData, isLoading: loadingDash } = useAdminDashboardQuery();
  const addToast = useUiStore((s) => s.addToast);
  const [range, setRange] = React.useState<"30d" | "90d" | "6m">("6m");
  const isMounted = useIsMounted();

  const totalRevenueETB = React.useMemo(() => {
    if (dashData?.metrics?.totalRevenueETB !== undefined) {
      return dashData.metrics.totalRevenueETB;
    }
    return orders.reduce((s, o) => s + o.totalETB, 0);
  }, [dashData, orders]);

  const maxRevenue = Math.max(...MONTHLY_SERIES.map((m) => m.revenueETB));
  const avgBasket =
    orders.length > 0
      ? Math.round(orders.reduce((s, o) => s + o.totalETB, 0) / orders.length)
      : 4342;

  const paymentSplit = React.useMemo(() => {
    if (orders.length === 0) return DEFAULT_PAYMENT_SPLIT;
    const counts: Record<string, { count: number; total: number }> = {};
    for (const o of orders) {
      const key = o.paymentMethod || "cod";
      if (!counts[key]) counts[key] = { count: 0, total: 0 };
      counts[key].count += 1;
      counts[key].total += o.totalETB;
    }
    const totalRev = orders.reduce((s, o) => s + o.totalETB, 0) || 1;
    const labels: Record<string, string> = {
      telebirr: "Telebirr SuperApp",
      cbe_birr: "CBE Birr Mobile",
      bank_transfer: "Awash / Bank Transfer",
      cod: "Cash / POS on Delivery",
    };
    return Object.entries(counts).map(([method, data]) => ({
      name: labels[method] ?? method,
      pct: Math.round((data.total / totalRev) * 100),
      amountETB: data.total,
    }));
  }, [orders]);

  const subcitySplit = React.useMemo(() => {
    if (dashData?.ordersBySubcity && dashData.ordersBySubcity.length > 0) {
      const totalCount = dashData.ordersBySubcity.reduce((s, item) => s + item.count, 0) || 1;
      return dashData.ordersBySubcity.map((item) => ({
        area: item.subCity,
        orders: item.count,
        share: Math.round((item.count / totalCount) * 100),
      }));
    }
    if (orders.length === 0) return DEFAULT_SUBCITY_SPLIT;
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const sc = o.subCity || "Addis Ababa Central";
      counts[sc] = (counts[sc] || 0) + 1;
    }
    return Object.entries(counts).map(([area, cnt]) => ({
      area,
      orders: cnt,
      share: Math.round((cnt / orders.length) * 100),
    }));
  }, [dashData, orders]);

  const handleExportReport = () => {
    const csv = [
      "Month,Revenue_ETB,Orders",
      ...MONTHLY_SERIES.map((r) => `${r.month},${r.revenueETB},${r.orders}`),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `addisgebeya-sales-report-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ title: "Sales Report Exported", description: "Downloaded Birr balance sheet CSV.", variant: "success" });
  };

  if (!isMounted || loadingOrders || loadingProducts || loadingDash) {
    return <AdminReportsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Sales &amp; Ethiopian Birr Analytics
          </h1>
          <p className="text-xs text-muted-foreground">
            Single-vendor revenue performance, category velocity, and Addis sub-city demand.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-border bg-surface p-1 text-xs font-bold">
            {(["30d", "90d", "6m"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-full px-3.5 py-1 transition-colors cursor-pointer ${
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "30d" ? "30 Days" : r === "90d" ? "90 Days" : "6 Months"}
              </button>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleExportReport}>
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Gross Revenue"
          value={totalRevenueETB.toLocaleString("en-US")}
          unit="ETB"
          icon={Wallet}
          badge="+18.4% MoM"
          progressPercent={84}
        />
        <DashboardStatCard
          label="Estimated Gross Margin"
          value="55.8%"
          icon={TrendingUp}
          subLeft="Avg Cost Ratio"
          subRight="44.2% COGS"
        />
        <DashboardStatCard
          label="Avg. Order Value"
          value={avgBasket.toLocaleString("en-US")}
          unit="ETB"
          icon={ShoppingBag}
          subLeft="Free Ship Threshold"
          subRight="3,500 ETB"
        />
        <DashboardStatCard
          label="Repeat Buyer Rate"
          value="34.6%"
          icon={Users}
          accent="cta"
          subLeft="Bole VIP Circle"
          subRight="+6.2% YoY"
        />
      </div>

      {/* Revenue Bar Chart + Payment Methods */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card lg:col-span-7">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Monthly Revenue Trend (ETB)
              </h2>
              <p className="text-xs text-muted-foreground">
                Direct single-vendor online &amp; Bole flagship showroom sales.
              </p>
            </div>
            <BarChart3 className="size-5 text-primary" />
          </div>

          <div className="flex h-60 items-end justify-between gap-3 pt-4">
            {MONTHLY_SERIES.map((bar) => {
              const heightPct = Math.round((bar.revenueETB / maxRevenue) * 100);
              return (
                <div key={bar.month} className="flex flex-1 flex-col items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-primary">
                    {(bar.revenueETB / 1000).toFixed(0)}k
                  </span>
                  <div className="flex h-44 w-full items-end justify-center rounded-t-xl bg-surface-low p-1">
                    <div
                      className="w-full max-w-[44px] rounded-t-lg bg-gradient-to-t from-primary to-primary-hover transition-all duration-500 hover:from-cta hover:to-cta-hover"
                      style={{ height: `${heightPct}%` }}
                      title={`${bar.month}: ${formatETB(bar.revenueETB)} (${bar.orders} orders)`}
                    />
                  </div>
                  <span className="font-label text-xs font-bold text-muted-foreground">
                    {bar.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Method Mix */}
        <div className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-card lg:col-span-5">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              Sales by Local Payment Method
            </h2>
            <p className="text-xs text-muted-foreground">
              Distribution across Ethiopian digital wallets and doorstep cash.
            </p>
          </div>
          <div className="space-y-4">
            {paymentSplit.map((pm) => (
              <div key={pm.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">{pm.name}</span>
                  <span className="font-display font-bold text-primary">
                    {pm.pct}% ({formatETB(pm.amountETB)})
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-low">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pm.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Selling Footwear + Addis Sub-City Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card lg:col-span-7">
          <h2 className="mb-4 font-display text-lg font-bold text-foreground">
            Top Performing Footwear Models
          </h2>
          <div className="divide-y divide-border">
            {products.slice(0, 5).map((p, idx) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-surface-low font-label text-xs font-extrabold text-primary">
                    0{idx + 1}
                  </span>
                  <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-surface-media p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.colorways[0]?.images[0]}
                      alt={p.name}
                      className="size-full object-contain"
                    />
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.categoryName} • {p.reviewCount} verified reviews
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-sm font-extrabold text-primary">
                    {formatETB(p.priceETB * Math.max(12, Math.round(p.reviewCount / 3)))}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {Math.max(12, Math.round(p.reviewCount / 3))} pairs sold
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card lg:col-span-5">
          <h2 className="mb-4 font-display text-lg font-bold text-foreground">
            Top Delivery Zones
          </h2>
          <div className="space-y-3.5">
            {subcitySplit.map((zone) => (
              <div key={zone.area} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-foreground">{zone.area}</span>
                  <span className="font-bold text-cta">{zone.orders} orders</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-low">
                  <div
                    className="h-full rounded-full bg-cta"
                    style={{ width: `${zone.share * 2.5}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

