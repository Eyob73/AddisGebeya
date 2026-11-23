"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, LogOut, Package, ShoppingBag, Truck, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";

const ACCOUNT_LINKS = [
  { href: "/account", label: "Dashboard Overview", icon: User, exact: true },
  { href: "/account/orders", label: "Order History", icon: Package },
  { href: "/account/tracking", label: "Order Tracking", icon: Truck },
  { href: "/wishlist", label: "Saved Wishlist", icon: Heart },
  { href: "/cart", label: "Shopping Bag", icon: ShoppingBag },
];

interface AccountShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AccountShell({ title, subtitle, children }: AccountShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const addToast = useUiStore((s) => s.addToast);

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 lg:px-8 lg:py-10">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
        <div>
          <Badge variant="secondary" className="mb-2">
            AddisGebeya Member Portal
          </Badge>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {user ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 shadow-card">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="size-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                Preferred Fit: EU {user.preferredSize} • {user.subCity.split(" ")[0]}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <nav
            aria-label="Customer account navigation"
            className="space-y-1 rounded-2xl border border-border bg-surface p-3 shadow-card"
          >
            {ACCOUNT_LINKS.map(({ href, label, icon: Icon, exact }) => {
              const active = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-label text-xs font-bold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-primary-light hover:text-primary",
                  )}
                >
                  <Icon className="size-4" />
                  <span>{label}</span>
                </Link>
              );
            })}

            <div className="my-2 h-px bg-border" />

            <button
              type="button"
              onClick={() => {
                logout();
                addToast({ title: "Signed out", description: "See you next drop!" });
                router.push("/login");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 font-label text-xs font-bold text-destructive hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="size-4" />
              <span>Sign Out</span>
            </button>
          </nav>
        </aside>

        <div className="lg:col-span-9">{children}</div>
      </div>
    </div>
  );
}

