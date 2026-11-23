"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Package,
  Phone,
  ShoppingBag,
  Sun,
  Truck,
  User,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { SearchBar } from "@/components/shared/search-bar";
import { useAuthStore } from "@/stores/auth.store";
import { computeCartTotals, useCartStore } from "@/stores/cart.store";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { formatETB } from "@/utils/format";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop All" },
  { href: "/category/men", label: "Men" },
  { href: "/category/women", label: "Women" },
  { href: "/category/sneakers", label: "Sneakers" },
  { href: "/category/running", label: "Running" },
  { href: "/category/new-arrivals", label: "New Arrivals" },
  { href: "/category/sale", label: "Sale", dot: true },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = React.useState(false);

  const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu, theme, toggleTheme, addToast } =
    useUiStore();
  const cartItems = useCartStore((s) => s.items);
  const appliedPromoCode = useCartStore((s) => s.appliedPromoCode);
  const deliverySpeed = useCartStore((s) => s.deliverySpeed);
  const wishlistCount = useWishlistStore((s) => s.productIds.length);
  const { user, isAuthenticated, logout } = useAuthStore();
  const settings = useCatalogStore((s) => s.settings);

  const totals = React.useMemo(
    () =>
      computeCartTotals(
        cartItems,
        appliedPromoCode,
        deliverySpeed,
        settings.freeDeliveryThresholdETB,
        settings.standardAddisDeliveryFeeETB,
        settings.vipTwoHourDeliveryFeeETB,
      ),
    [
      cartItems,
      appliedPromoCode,
      deliverySpeed,
      settings.freeDeliveryThresholdETB,
      settings.standardAddisDeliveryFeeETB,
      settings.vipTwoHourDeliveryFeeETB,
    ],
  );

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleSignOut = () => {
    logout();
    setAccountOpen(false);
    closeMobileMenu();
    addToast({ title: "Signed out", description: "You have been signed out safely." });
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full shadow-[0_1px_10px_rgba(17,32,43,0.05)]">
      {/* Top Announcement Strip */}
      <div className="bg-primary-hover text-[#EBF6F8] font-label text-[11px] sm:text-xs py-1.5 px-4 lg:px-8">
        <div className="mx-auto flex max-w-[1360px] flex-col items-center justify-between gap-1 sm:flex-row">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span className="inline-block size-2 shrink-0 rounded-full bg-cta" />
            <span className="font-semibold">{settings.announcementBarText}</span>
          </div>
          <div className="hidden items-center gap-4 sm:flex">
            <Link href="/about" className="hover:text-white transition-colors">
              About
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 font-bold text-white hover:bg-white/20 transition-colors"
            >
              <LayoutDashboard className="size-3" />
              Store Admin
            </Link>
            <span className="inline-flex items-center gap-1 font-bold text-white">
              <Phone className="size-3.5" />
              {settings.phone}
            </span>
          </div>
        </div>
      </div>

      {/* Main Glassmorphic Navigation Bar */}
      <div className="border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-3 px-4 py-2.5 lg:px-8">
          {/* Left: Logo + Desktop Search */}
          <div className="flex items-center gap-4 xl:gap-5">
            <BrandLogo onClick={closeMobileMenu} imgClassName="h-10 sm:h-11 w-auto" />
            <SearchBar className="hidden w-60 xl:block 2xl:w-72" />
          </div>

          {/* Center: Desktop Nav */}
          <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-label text-xs font-semibold transition-all whitespace-nowrap",
                    active
                      ? "bg-primary text-primary-foreground font-bold shadow-[0_2px_8px_rgba(14,90,107,0.18)]"
                      : "text-muted-foreground hover:bg-primary-light hover:text-primary",
                  )}
                >
                  <span>{link.label}</span>
                  {link.dot ? (
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        active ? "bg-[#FFDBD0]" : "bg-cta",
                      )}
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Right: Utility Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              className="hidden sm:flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-primary-light hover:text-primary transition-colors cursor-pointer"
            >
              {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>

            {/* Wishlist */}
            <Link
              href="/wishlist"
              aria-label={`Wishlist (${wishlistCount} saved)`}
              className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-primary-light hover:text-primary transition-colors"
            >
              <Heart className="size-5" />
              {wishlistCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary font-label text-[10px] font-bold text-primary-foreground leading-none">
                  {wishlistCount}
                </span>
              ) : null}
            </Link>

            {/* Shopping Bag Pill */}
            <Link
              href="/cart"
              aria-label={`Shopping bag with ${totals.itemCount} items`}
              className="flex items-center gap-2 rounded-full border border-border/80 bg-surface px-3 py-1.5 shadow-card transition-colors hover:border-primary hover:bg-primary-light/60"
            >
              <div className="relative">
                <ShoppingBag className="size-5 text-foreground" />
                <span className="absolute -top-1.5 -right-2 flex size-4 items-center justify-center rounded-full bg-cta font-label text-[10px] font-bold text-cta-foreground leading-none">
                  {totals.itemCount}
                </span>
              </div>
              <div className="hidden flex-col pl-1 text-left sm:flex">
                <span className="font-label text-[10px] font-semibold leading-none text-muted-foreground">
                  {totals.itemCount} {totals.itemCount === 1 ? "item" : "items"}
                </span>
                <span className="font-display text-xs font-extrabold leading-tight text-primary">
                  {formatETB(totals.totalETB)}
                </span>
              </div>
            </Link>

            {/* Account Dropdown */}
            <div className="relative hidden md:block">
              {isAuthenticated && user ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAccountOpen((prev) => !prev)}
                    onBlur={() => setTimeout(() => setAccountOpen(false), 180)}
                    className="flex items-center gap-2 rounded-full border border-border/70 bg-surface py-1 pr-2.5 pl-1.5 hover:border-primary transition-colors cursor-pointer"
                  >
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="size-7 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {user.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="max-w-[90px] truncate font-label text-xs font-bold text-foreground">
                      {user.name.split(" ")[0]}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </button>

                  {accountOpen ? (
                    <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-xl">
                      <div className="border-b border-border/70 px-3 py-2">
                        <p className="truncate text-xs font-bold text-foreground">{user.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                      </div>
                      <Link
                        href="/account"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary-light hover:text-primary"
                      >
                        <User className="size-4" /> Customer Dashboard
                      </Link>
                      <Link
                        href="/account/orders"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary-light hover:text-primary"
                      >
                        <Package className="size-4" /> Order History
                      </Link>
                      <Link
                        href="/account/tracking"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary-light hover:text-primary"
                      >
                        <Truck className="size-4" /> Track Order
                      </Link>
                      <Link
                        href="/admin"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:bg-primary-light"
                      >
                        <LayoutDashboard className="size-4" /> Store Owner Admin
                      </Link>
                      <div className="my-1 h-px bg-border/70" />
                      <button
                        type="button"
                        onMouseDown={handleSignOut}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-destructive hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                      >
                        <LogOut className="size-4" /> Sign Out
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label text-xs font-bold text-primary-foreground hover:bg-primary-hover transition-colors"
                >
                  <LogIn className="size-3.5" /> Sign In
                </Link>
              )}
            </div>

            {/* Mobile Menu Trigger */}
            <button
              type="button"
              onClick={toggleMobileMenu}
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
              className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground lg:hidden cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen ? (
          <div className="border-t border-border bg-surface px-4 pt-3 pb-5 shadow-xl lg:hidden">
            <SearchBar className="mb-4" onNavigate={closeMobileMenu} />

            <div className="grid grid-cols-2 gap-1.5">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2.5 font-label text-xs font-bold transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-low/60 text-foreground hover:bg-primary-light hover:text-primary",
                    )}
                  >
                    <span>{link.label}</span>
                    {link.dot ? <span className="size-1.5 rounded-full bg-cta" /> : null}
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4 text-xs font-semibold">
              <Link
                href="/account"
                onClick={closeMobileMenu}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-foreground"
              >
                <User className="size-4 text-primary" /> My Account
              </Link>
              <Link
                href="/account/tracking"
                onClick={closeMobileMenu}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-foreground"
              >
                <Truck className="size-4 text-primary" /> Track Order
              </Link>
              <Link
                href="/about"
                onClick={closeMobileMenu}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-foreground"
              >
                About Us
              </Link>
              <Link
                href="/contact"
                onClick={closeMobileMenu}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-foreground"
              >
                Contact Us
              </Link>
              <Link
                href="/admin"
                onClick={closeMobileMenu}
                className="col-span-2 flex items-center justify-center gap-2 rounded-full bg-primary py-2.5 font-label font-bold text-primary-foreground"
              >
                <LayoutDashboard className="size-4" /> Store Owner Admin Dashboard
              </Link>
              <div className="col-span-2 flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex items-center gap-1.5 text-muted-foreground"
                >
                  {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                  {theme === "light" ? "Dark Mode" : "Light Mode"}
                </button>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 text-destructive"
                  >
                    <LogOut className="size-4" /> Sign Out
                  </button>
                ) : (
                  <Link href="/login" onClick={closeMobileMenu} className="text-primary font-bold">
                    Sign In / Register
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
