"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";

export function SiteFooter() {
  const settings = useCatalogStore((s) => s.settings);
  const addToast = useUiStore((s) => s.addToast);
  const [email, setEmail] = React.useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      addToast({
        title: "Enter a valid email",
        description: "Please provide a valid email address to join the VIP Drop Circle.",
        variant: "warning",
      });
      return;
    }
    setEmail("");
    addToast({
      title: "Welcome to AddisGebeya VIP Circle!",
      description: "Use voucher code WELCOME10 for 10% off your inaugural order.",
      variant: "success",
    });
  };

  return (
    <footer className="mt-16 w-full border-t border-border bg-surface-low pt-14 pb-10">
      <div className="mx-auto max-w-[1360px] px-4 lg:px-8">
        <div className="grid grid-cols-1 gap-10 pb-12 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand Info (2 cols) */}
          <div className="space-y-4 lg:col-span-2">
            <BrandLogo imgClassName="h-11 w-auto" />
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Ethiopia&apos;s premier single-vendor destination for authentic athletic, streetwear,
              and handcrafted leather footwear, curated directly from our Bole Medhanialem flagship
              studio in Addis Ababa.
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-primary" />
                <span>{settings.showroomAddress}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-primary" />
                <span>{settings.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-primary" />
                <span>{settings.email}</span>
              </div>
            </div>
          </div>

          {/* Footwear Categories */}
          <div className="space-y-4">
            <h4 className="font-label text-xs font-bold tracking-wider text-primary uppercase">
              Footwear Categories
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/category/sneakers" className="hover:text-primary transition-colors">
                  Sneakers &amp; Streetwear
                </Link>
              </li>
              <li>
                <Link href="/category/running" className="hover:text-primary transition-colors">
                  Running Shoes
                </Link>
              </li>
              <li>
                <Link
                  href="/category/casual-loafers"
                  className="hover:text-primary transition-colors"
                >
                  Casual Loafers
                </Link>
              </li>
              <li>
                <Link
                  href="/category/formal-leather"
                  className="hover:text-primary transition-colors"
                >
                  Formal Leather
                </Link>
              </li>
              <li>
                <Link href="/category/boots" className="hover:text-primary transition-colors">
                  Boots &amp; Trail
                </Link>
              </li>
              <li>
                <Link href="/category/sandals" className="hover:text-primary transition-colors">
                  Sandals &amp; Slides
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div className="space-y-4">
            <h4 className="font-label text-xs font-bold tracking-wider text-primary uppercase">
              Customer Care
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/track-order" className="hover:text-primary transition-colors">
                  Order Tracking
                </Link>
              </li>
              <li>
                <Link href="/account/orders" className="hover:text-primary transition-colors">
                  Order History
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className="hover:text-primary transition-colors">
                  Saved Wishlist
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-primary transition-colors">
                  About AddisGebeya
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary transition-colors">
                  Contact &amp; Showroom
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter & Local Payments */}
          <div className="space-y-4">
            <h4 className="font-label text-xs font-bold tracking-wider text-primary uppercase">
              Stay Updated
            </h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Receive exclusive access to weekly limited sneaker drops and Bole VIP releases.
            </p>
            <form
              onSubmit={handleSubscribe}
              className="flex items-center rounded-full border border-border bg-surface p-1 shadow-card"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address..."
                aria-label="Email for newsletter"
                className="w-full bg-transparent px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-cta px-4 py-1.5 font-label text-[11px] font-bold uppercase text-cta-foreground transition-colors hover:bg-cta-hover cursor-pointer"
              >
                Join
              </button>
            </form>

            <div className="space-y-2 pt-2">
              <span className="block font-label text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                Accepted Local Payment
              </span>
              <div className="flex flex-wrap gap-1.5">
                {["Telebirr", "CBE Birr", "Awash Bank", "Cash on Delivery"].map((provider) => (
                  <span
                    key={provider}
                    className="rounded-lg border border-border/70 bg-surface px-2.5 py-1 font-label text-[11px] font-bold text-primary shadow-xs"
                  >
                    {provider}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} AddisGebeya Shoes PLC. Step into Your Style. Addis
            Ababa, Ethiopia.
          </p>
          <div className="flex items-center gap-5 font-label text-[11px] font-semibold">
            <Link href="/about" className="hover:text-primary">
              Authentic Guarantee
            </Link>
            <Link href="/contact" className="hover:text-primary">
              7-Day Size Exchange
            </Link>
            <Link href="/track-order" className="hover:text-primary">
              Dispatch Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
