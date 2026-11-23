import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, CheckCircle2, MapPin, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HERO_ASSETS } from "@/data/mock-footwear";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Discover AddisGebeya Shoes — Ethiopia's single-vendor destination for authentic athletic and handcrafted leather footwear.",
};

export default function AboutPage() {
  return (
    <div className="flex w-full flex-col">
      {/* Editorial Hero */}
      <section className="w-full bg-surface-low py-14 lg:py-20">
        <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-center gap-10 px-4 lg:grid-cols-12 lg:px-8">
          <div className="space-y-5 lg:col-span-6">
            <Badge variant="cta">Our Addis Story</Badge>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Step into Your Style. <span className="text-primary">Built for Addis Ababa.</span>
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              AddisGebeya Shoes was founded by Kidus Assefa with a single uncompromising mission:
              give Ethiopian runners, streetwear collectors, and executives a trusted, direct
              single-vendor footwear destination where every pair is 100% genuine, inspected in
              person, and ready for immediate local dispatch.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-full bg-cta px-7 py-3 font-label text-sm font-bold text-white shadow-md hover:bg-cta-hover"
              >
                Explore the Vault <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3 font-label text-sm font-bold text-primary hover:bg-surface-container"
              >
                Visit Bole Showroom
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-2xl border border-border bg-surface p-3 shadow-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={HERO_ASSETS.runLabBanner}
                alt="AddisGebeya Run Lab and Bole urban culture"
                className="h-80 sm:h-96 w-full rounded-xl object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Single-Vendor Authenticity Pillars */}
      <section className="mx-auto max-w-[1360px] px-4 py-16 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <span className="font-label text-xs font-bold tracking-widest text-cta uppercase">
            Why Single-Vendor Matters
          </span>
          <h2 className="mt-1 font-display text-3xl font-extrabold text-foreground">
            Zero Middlemen. Zero Counterfeits.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Unlike open marketplaces where unknown third-party sellers list unverified stock,
            AddisGebeya Shoes owns, inspects, stores, and delivers every single box directly from
            our Bole Medhanialem hub.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Hand-Verified Authenticity",
              desc: "Every box passes a 12-point serial, stitch, and midsole density check before entering our live EU size inventory.",
            },
            {
              icon: Award,
              title: "Ethiopian Craft + Global Engineering",
              desc: "We pair world-class carbon running footwear with Goodyear-welted formal shoes handcrafted from premium Ethiopian hides.",
            },
            {
              icon: Truck,
              title: "Try-On Doorstep Dispatch",
              desc: "Our dedicated Bole couriers wait up to 10 minutes so you can test the EU fit before finalizing Cash on Delivery or Telebirr.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-6 shadow-card">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-light text-primary">
                <Icon className="size-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Founder & Flagship Showroom */}
      <section className="w-full bg-surface-low py-16">
        <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-center gap-8 px-4 lg:grid-cols-12 lg:px-8">
          <div className="flex items-center gap-5 rounded-2xl border border-border bg-surface p-6 shadow-card lg:col-span-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_ASSETS.ownerAvatar}
              alt="Kidus Assefa — Founder of AddisGebeya Shoes"
              className="size-24 shrink-0 rounded-2xl object-cover shadow-md sm:size-28"
            />
            <div className="space-y-2">
              <Badge variant="soft">Founder &amp; Sole Proprietor</Badge>
              <h3 className="font-display text-xl font-bold text-foreground">Kidus Assefa</h3>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                &ldquo;Whether you are climbing Mount Entoto at 6 AM or walking into a boardroom in
                Kazanchis, your shoes should carry confidence, genuine craftsmanship, and honest
                service.&rdquo;
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl bg-primary-deep p-6 text-white shadow-xl lg:col-span-5">
            <div className="flex items-center gap-2 text-[#B0ECFF]">
              <MapPin className="size-5" />
              <span className="font-label text-xs font-bold uppercase tracking-wider">
                Bole Flagship Studio
              </span>
            </div>
            <h3 className="font-display text-xl font-bold">Bole Medhanialem Mall, 2nd Floor</h3>
            <p className="text-xs leading-relaxed text-[#EBF6F8]/85">
              Walk in for gait sizing advice, complimentary 7-day exchanges, or same-day online
              order pickup. Open daily 8:30 AM – 8:30 PM EAT.
            </p>
            <div className="flex flex-wrap gap-3 pt-1 font-label text-xs text-[#FFDBD0]">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5" /> Free Foot Measurement
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5" /> Instant Pickup
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

