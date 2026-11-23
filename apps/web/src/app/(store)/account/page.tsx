"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Heart, MapPin, Package, Ruler, Save, Truck } from "lucide-react";
import { AccountShell } from "@/components/layout/account-shell";
import { DashboardStatCard } from "@/components/shared/dashboard-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADDIS_SUBCITIES, EU_SIZES } from "@/data/mock-footwear";
import { useAuthStore } from "@/stores/auth.store";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { formatDateShort, formatETB } from "@/utils/format";

export default function CustomerDashboardPage() {
  const { user, updateProfile } = useAuthStore();
  const orders = useCatalogStore((s) => s.orders);
  const wishlistCount = useWishlistStore((s) => s.productIds.length);
  const addToast = useUiStore((s) => s.addToast);

  const [name, setName] = React.useState(user?.name ?? "Abebe Tadesse");
  const [phone, setPhone] = React.useState(user?.phone ?? "+251 911 234 567");
  const [preferredSize, setPreferredSize] = React.useState(user?.preferredSize ?? 42);
  const [subCity, setSubCity] = React.useState(user?.subCity ?? ADDIS_SUBCITIES[0]);

  const myOrders = React.useMemo(() => {
    if (!user) return orders.slice(0, 3);
    const matched = orders.filter(
      (o) =>
        o.customerEmail.toLowerCase() === user.email.toLowerCase() || o.customerId === user.id,
    );
    return matched.length > 0 ? matched : orders.slice(0, 3);
  }, [orders, user]);

  const activeDeliveries = myOrders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled",
  ).length;

  const totalSpent = myOrders.reduce((sum, o) => sum + o.totalETB, 0);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ name, phone, preferredSize, subCity });
    addToast({
      title: "Profile Updated",
      description: `Preferred fit set to EU ${preferredSize} and saved for Express Checkout.`,
      variant: "success",
    });
  };

  return (
    <AccountShell
      title={`Welcome back, ${user?.name?.split(" ")[0] ?? "Shopper"}`}
      subtitle="Manage your footwear orders, active Addis Ababa courier dispatches, and preferred EU sizing."
    >
      <div className="space-y-8">
        {/* KPI Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            label="Total Orders"
            value={String(myOrders.length)}
            icon={Package}
            subLeft="Lifetime Total"
            subRight={formatETB(totalSpent)}
          />
          <DashboardStatCard
            label="Active Dispatches"
            value={String(activeDeliveries)}
            icon={Truck}
            accent="cta"
            subLeft="Addis Courier"
            subRight="Live Tracking"
          />
          <DashboardStatCard
            label="Saved Wishlist"
            value={String(wishlistCount)}
            unit="Pairs"
            icon={Heart}
            subLeft="Ready to bag"
            subRight="View Wishlist"
          />
          <DashboardStatCard
            label="Saved EU Fit"
            value={`EU ${preferredSize}`}
            icon={Ruler}
            subLeft="True to size"
            subRight="VIP Runner"
          />
        </div>

        {/* Recent Orders Preview */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Recent Orders</h2>
              <p className="text-xs text-muted-foreground">
                Quick status check for your latest footwear purchases.
              </p>
            </div>
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-1 font-label text-xs font-bold text-primary hover:underline"
            >
              View All <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-border">
            {myOrders.slice(0, 3).map((order) => (
              <div
                key={order.id}
                className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3.5">
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-surface-media p-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.items[0]?.image}
                      alt={order.items[0]?.productName ?? "Order"}
                      className="size-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-foreground">
                        #{order.id}
                      </span>
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
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {order.items.map((i) => `${i.productName} (EU ${i.size})`).join(", ")}
                    </p>
                    <p className="font-label text-[11px] text-muted-foreground">
                      {formatDateShort(order.createdAt)} • {order.subCity}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <span className="font-display text-sm font-extrabold text-primary">
                    {formatETB(order.totalETB)}
                  </span>
                  <Link
                    href={`/account/tracking?order=${order.id}`}
                    className="font-label text-xs font-bold text-cta hover:underline"
                  >
                    Track Delivery →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Profile & Saved Address Form */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="mb-5 flex items-center gap-2.5">
            <MapPin className="size-5 text-primary" />
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Saved Fit &amp; Delivery Profile
              </h2>
              <p className="text-xs text-muted-foreground">
                Pre-fills your checkout address and highlights your EU shoe size across the store.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                Full Name
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                Phone Number
              </label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                Default Addis Sub-City
              </label>
              <select
                value={subCity}
                onChange={(e) => setSubCity(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {ADDIS_SUBCITIES.map((sc) => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                Preferred EU Size
              </label>
              <select
                value={preferredSize}
                onChange={(e) => setPreferredSize(Number(e.target.value))}
                className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {EU_SIZES.map((sz) => (
                  <option key={sz} value={sz}>
                    EU {sz}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end pt-2">
              <Button type="submit">
                <Save className="size-4" /> Save Preferences
              </Button>
            </div>
          </form>
        </section>
      </div>
    </AccountShell>
  );
}

