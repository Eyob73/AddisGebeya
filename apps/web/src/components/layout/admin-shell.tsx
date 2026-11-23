"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  FolderTree,
  Grid3X3,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  PlusCircle,
  Settings,
  Sun,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { HERO_ASSETS } from "@/data/mock-footwear";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const { isAdminSidebarOpen, setAdminSidebarOpen, theme, toggleTheme } = useUiStore();
  const products = useCatalogStore((s) => s.products);
  const orders = useCatalogStore((s) => s.orders);
  const settings = useCatalogStore((s) => s.settings);

  const pendingDispatchCount = orders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled",
  ).length;

  const navItems = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    {
      href: "/admin/products",
      label: "Product Management",
      icon: Package,
      badge: String(products.length),
    },
    { href: "/admin/products/new", label: "Add Shoe Model", icon: PlusCircle },
    { href: "/admin/categories", label: "Categories", icon: FolderTree },
    { href: "/admin/inventory", label: "Size & Stock Matrix", icon: Grid3X3 },
    {
      href: "/admin/orders",
      label: "Orders & Dispatches",
      icon: Truck,
      badge: String(pendingDispatchCount),
      badgeCta: true,
    },
    { href: "/admin/customers", label: "Customer CRM", icon: Users },
    { href: "/admin/reports", label: "Sales Reports", icon: BarChart3 },
    { href: "/admin/settings", label: "Store Settings", icon: Settings },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    if (href === "/admin/products") {
      return pathname === "/admin/products" || (pathname.startsWith("/admin/products/") && pathname !== "/admin/products/new");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Live Dispatch Ribbon (Stitch Store Owner Dashboard) */}
      <div className="w-full bg-primary-deep px-4 py-2 text-white lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cta px-2.5 py-0.5 font-label text-[11px] font-bold uppercase tracking-wider text-white">
              <span className="size-1.5 animate-ping rounded-full bg-white" />
              Live Dispatch Mode
            </span>
            <span className="hidden text-[#EBF6F8]/90 sm:inline">
              {settings.dispatchRibbonText}
            </span>
          </div>
          <div className="flex items-center gap-4 font-label text-[11px] font-semibold text-[#EBF6F8]">
            <span className="hidden items-center gap-1 md:inline-flex">
              <CheckCircle2 className="size-3.5 text-[#FFDBD0]" /> Telebirr: Active
            </span>
            <span className="hidden items-center gap-1 md:inline-flex">
              <Wallet className="size-3.5 text-[#FFDBD0]" /> CBE Birr: Operational
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-white hover:bg-white/25 transition-colors"
            >
              <span>View Storefront</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Store Owner Console Masthead */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 px-4 py-3.5 shadow-xs backdrop-blur-md lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAdminSidebarOpen(!isAdminSidebarOpen)}
              aria-label="Toggle admin sidebar"
              className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-low text-foreground lg:hidden cursor-pointer"
            >
              {isAdminSidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <BrandLogo href="/admin" imgClassName="h-9 sm:h-10 w-auto" />

            <div className="hidden sm:block border-l border-border pl-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-extrabold text-foreground">
                  Store Owner HQ
                </span>
                <span className="rounded-full bg-primary-light px-2.5 py-0.5 font-label text-[10px] font-bold uppercase text-primary">
                  Single-Vendor
                </span>
                <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-label text-[10px] font-bold text-emerald-700 xl:inline-flex dark:bg-emerald-950/60 dark:text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Open &amp; Dispatching
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{settings.showroomAddress}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex size-9 items-center justify-center rounded-full border border-border bg-surface-low text-muted-foreground hover:text-primary cursor-pointer"
            >
              {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>

            <div className="hidden items-center gap-2.5 rounded-xl bg-surface-low px-3 py-1.5 md:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={HERO_ASSETS.ownerAvatar}
                alt="Kidus Assefa"
                className="size-8 rounded-full object-cover"
              />
              <div className="leading-tight">
                <p className="font-display text-xs font-bold text-foreground">Kidus Assefa</p>
                <p className="font-label text-[10px] text-muted-foreground">
                  Founder &amp; Sole Proprietor
                </p>
              </div>
            </div>

            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-1.5 rounded-full bg-cta px-4 py-2.5 font-label text-xs font-bold text-cta-foreground shadow-md transition-all hover:bg-cta-hover active:scale-95"
            >
              <PlusCircle className="size-4" />
              <span className="hidden sm:inline">Add Shoe Model</span>
              <span className="sm:hidden">New Shoe</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Layout: Persistent Admin Sidebar + Workspace Canvas */}
      <div className="mx-auto flex max-w-[1440px]">
        {/* Mobile Drawer Backdrop */}
        {isAdminSidebarOpen ? (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
            onClick={() => setAdminSidebarOpen(false)}
          />
        ) : null}

        {/* Admin Sidebar */}
        <aside
          className={cn(
            "fixed top-0 bottom-0 left-0 z-50 w-64 shrink-0 border-r border-border bg-surface p-4 transition-transform duration-200 lg:sticky lg:top-[73px] lg:z-20 lg:h-[calc(100vh-73px)] lg:translate-x-0 lg:overflow-y-auto",
            isAdminSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <BrandLogo href="/admin" imgClassName="h-9 w-auto" />
            <button
              type="button"
              onClick={() => setAdminSidebarOpen(false)}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-low"
            >
              <X className="size-5" />
            </button>
          </div>

          <p className="mb-2 px-3 font-label text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Store Operations
          </p>

          <nav aria-label="Admin navigation" className="space-y-1">
            {navItems.map(({ href, label, icon: Icon, exact, badge, badgeCta }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setAdminSidebarOpen(false)}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-2.5 font-label text-xs font-bold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-primary-light hover:text-primary",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="size-4 shrink-0" />
                    <span>{label}</span>
                  </span>
                  {badge ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                        active
                          ? "bg-white/20 text-white"
                          : badgeCta
                            ? "bg-cta text-white"
                            : "bg-surface-container text-primary",
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Flagship Showroom Card */}
          <div className="mt-6 rounded-xl bg-primary-deep p-4 text-white">
            <span className="inline-block rounded-full bg-cta px-2 py-0.5 font-label text-[10px] font-bold uppercase">
              Showroom Live
            </span>
            <h4 className="mt-2 font-display text-sm font-bold">Bole Medhanialem Studio</h4>
            <p className="mt-1 text-[11px] text-[#EBF6F8]/80">{settings.showroomHours}</p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-1 font-label text-[11px] font-bold text-[#B0ECFF] hover:underline"
            >
              Switch to Customer Store →
            </Link>
          </div>
        </aside>

        {/* Admin Page Content */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

