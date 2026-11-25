"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Lock,
  MapPin,
  Package,
  Settings,
  Shield,
  Truck,
  User,
} from "lucide-react";
import { AccountShell } from "@/components/layout/account-shell";
import { DashboardStatCard } from "@/components/shared/dashboard-stat-card";
import { AccountPageSkeleton } from "@/components/shared/page-skeletons";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { useAddressesQuery, useOrdersQuery } from "@/hooks/use-store-queries";
import { useWishlistStore } from "@/stores/wishlist.store";
import { formatDateShort, formatETB } from "@/utils/format";

export default function CustomerDashboardPage() {
  const { user } = useAuthStore();
  const { data: orders = [] } = useOrdersQuery();
  const { data: addresses = [] } = useAddressesQuery();
  const wishlistCount = useWishlistStore((s) => s.productIds.length);
  const isMounted = useIsMounted();

  const activeDeliveries = orders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled",
  ).length;

  const totalSpent = orders.reduce((sum, o) => sum + o.totalETB, 0);

  const defaultAddress =
    addresses.find((a) => a.isDefault) ?? addresses[0] ?? user?.defaultAddress ?? null;

  if (!isMounted) {
    return (
      <AccountShell
        title="Account Overview"
        subtitle="Manage your personal profile, delivery destinations, and footwear orders."
      >
        <AccountPageSkeleton />
      </AccountShell>
    );
  }

  return (
    <AccountShell
      title="Account Overview"
      subtitle="Manage your personal profile, delivery destinations, and footwear orders."
    >
      <div className="space-y-8">
        {/* Lifetime Activity Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            label="Total Orders"
            value={String(orders.length)}
            icon={Package}
            subLeft="Lifetime Total"
            subRight={formatETB(totalSpent)}
          />
          <DashboardStatCard
            label="Active Deliveries"
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
            subLeft="Footwear Vault"
            subRight="Ready to bag"
          />
          <DashboardStatCard
            label="Saved Addresses"
            value={String(addresses.length)}
            unit="Locations"
            icon={MapPin}
            subLeft="Rapid Dispatch"
            subRight="Home & Office"
          />
        </div>

        {/* Default Delivery Address & Security Summary Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Default Delivery Address Card */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card lg:col-span-7 flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="size-5 text-primary" />
                  <h3 className="font-display text-base font-bold text-foreground">
                    Primary Delivery Destination
                  </h3>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/account/addresses">Manage Addresses</Link>
                </Button>
              </div>

              {defaultAddress ? (
                <div className="rounded-xl border border-border/80 bg-surface-low p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-2">
                      {defaultAddress.fullName}
                      <Badge variant="success" className="text-[10px]">
                        {defaultAddress.label || "Home"}
                      </Badge>
                    </span>
                    <Badge variant="soft" className="text-[10px]">
                      Default
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{defaultAddress.phoneNumber}</p>
                  <p className="text-foreground font-medium text-xs pt-1">
                    {defaultAddress.streetAddress ? `${defaultAddress.streetAddress}, ` : ""}
                    {defaultAddress.subCity}, {defaultAddress.city}
                  </p>
                  {defaultAddress.landmark ? (
                    <p className="text-xs text-muted-foreground italic">
                      Landmark: {defaultAddress.landmark}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  <p>You haven&apos;t added any delivery addresses yet.</p>
                  <Button asChild variant="cta" size="sm" className="mt-3">
                    <Link href="/account/addresses">Add New Address</Link>
                  </Button>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Standard delivery: FREE on all Addis Ababa orders</span>
              <Link href="/account/addresses" className="font-bold text-primary hover:underline">
                View all ({addresses.length}) &rarr;
              </Link>
            </div>
          </div>

          {/* Quick Account Shortcuts & Security */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                <h3 className="font-display text-base font-bold text-foreground">
                  Security &amp; Account Settings
                </h3>
              </div>

              <div className="space-y-3">
                <Link
                  href="/account/profile"
                  className="flex items-center justify-between rounded-xl border border-border/80 p-3 hover:bg-surface-low transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <User className="size-4 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Personal Information</p>
                      <p className="text-[11px] text-muted-foreground">Name, email, phone &amp; fit preferences</p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>

                <Link
                  href="/account/security"
                  className="flex items-center justify-between rounded-xl border border-border/80 p-3 hover:bg-surface-low transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="size-4 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Password &amp; Security</p>
                      <p className="text-[11px] text-muted-foreground">Update credentials &amp; session revocation</p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>

                <Link
                  href="/account/settings"
                  className="flex items-center justify-between rounded-xl border border-border/80 p-3 hover:bg-surface-low transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="size-4 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Account Controls</p>
                      <p className="text-[11px] text-muted-foreground">Session devices &amp; account deactivation</p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Authentication: Dual-token JWT (256-bit encrypted)</span>
            </div>
          </div>
        </div>

        {/* Recent Orders Preview */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">Recent Orders</h3>
              <p className="text-xs text-muted-foreground">
                Quick status check for your latest footwear purchases.
              </p>
            </div>
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-1 font-label text-xs font-bold text-primary hover:underline"
            >
              View All Orders <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <Package className="mx-auto size-8 text-muted-foreground/50 mb-2" />
              <p>No orders placed yet.</p>
              <Button asChild variant="cta" size="sm" className="mt-3">
                <Link href="/shop">Explore Footwear Vault</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {orders.slice(0, 4).map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-surface-media p-1.5 border border-border/60">
                      {order.items[0]?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={order.items[0]?.image}
                          alt={order.items[0]?.productName ?? "Order"}
                          className="size-full object-contain"
                        />
                      ) : (
                        <Package className="size-full text-muted-foreground p-2" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold text-foreground">
                          Order #{order.id}
                        </span>
                        <Badge
                          variant={
                            order.status === "delivered"
                              ? "success"
                              : order.status === "out_for_delivery"
                                ? "cta"
                                : "soft"
                          }
                          className="text-[10px]"
                        >
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-[11px] font-label font-semibold text-muted-foreground uppercase">
                          ({order.paymentMethod.replace("_", " ")})
                        </span>
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
                      className="font-label text-xs font-bold text-cta hover:underline inline-flex items-center gap-1"
                    >
                      Track Delivery &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AccountShell>
  );
}
