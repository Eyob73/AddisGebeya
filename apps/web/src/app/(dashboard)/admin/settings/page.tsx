"use client";

import * as React from "react";
import { Save, Store, Truck, Wallet } from "lucide-react";
import { PushNotificationSettingsCard } from "@/components/notifications/PushNotificationSettingsCard";
import { ApiStatusCard } from "@/components/shared/api-status-card";
import { AdminSettingsSkeleton } from "@/components/shared/page-skeletons";
import { Button } from "@/components/ui/button";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { Input } from "@/components/ui/input";
import { useStoreSettingsQuery } from "@/hooks/use-store-queries";
import { storeService } from "@/services/store.service";
import { useUiStore } from "@/stores/ui.store";

export default function AdminSettingsPage() {
  const { data: settingsData, isLoading, refetch } = useStoreSettingsQuery();
  const addToast = useUiStore((s) => s.addToast);

  const [form, setForm] = React.useState(
    settingsData ?? {
      storeName: "AddisGebeya Shoes",
      tagline: "Step into Your Style.",
      showroomAddress: "Bole",
      phone: "+251 911 234 567",
      whatsapp: "+251 911 234 567",
      telegramHandle: "@AddisGebeyaShoes",
      email: "concierge@addisgebeyashoes.et",
      showroomHours: "Mon - Sun: 8:30 AM - 8:30 PM EAT",
      freeDeliveryThresholdETB: 0,
      standardAddisDeliveryFeeETB: 0,
      vipTwoHourDeliveryFeeETB: 250,
      regionalCargoFeeETB: 350,
      vatPercent: 15,
      paymentMethods: {
        telebirr: true,
        cbeBirr: true,
        bankTransfer: true,
        cod: true,
      },
      announcementBarText:
        "Free Express Delivery in Addis Ababa on Orders Over 3,500 ETB • 100% Authentic Footwear Guarantee",
      dispatchRibbonText:
        "Addis Ababa Hub: Megenagna & Bole Couriers actively en route. 18 live dispatches scheduled today.",
    },
  );

  React.useEffect(() => {
    if (settingsData) {
      setForm(settingsData);
    }
  }, [settingsData]);

  const isMounted = useIsMounted();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await storeService.updateStoreSettings(form);
    refetch();
    addToast({
      title: "Store Settings Saved",
      description: "Delivery thresholds, storefront banners, and showroom details updated.",
      variant: "success",
    });
  };

  if (!isMounted || isLoading) {
    return <AdminSettingsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Store Settings</h1>
        <p className="text-xs text-muted-foreground">
          Configure single-vendor branding, Bole Medhanialem showroom info, ETB delivery tariffs,
          and payment options.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Brand & Showroom Profile */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="mb-5 flex items-center gap-2.5">
            <Store className="size-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Brand &amp; Flagship Showroom Identity
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold">Store Name</label>
              <Input
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold">Brand Tagline</label>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block font-label text-xs font-bold">
                Flagship Showroom Address
              </label>
              <Input
                value={form.showroomAddress}
                onChange={(e) => setForm({ ...form, showroomAddress: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold">Support Phone</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold">Concierge Email</label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block font-label text-xs font-bold">
                Storefront Top Announcement Bar
              </label>
              <Input
                value={form.announcementBarText}
                onChange={(e) => setForm({ ...form, announcementBarText: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* Delivery & Tariffs */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="mb-5 flex items-center gap-2.5">
            <Truck className="size-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Addis Ababa &amp; Regional Delivery Tariffs (ETB)
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold">
                Free Delivery Threshold (ETB)
              </label>
              <Input
                type="number"
                value={form.freeDeliveryThresholdETB}
                onChange={(e) =>
                  setForm({ ...form, freeDeliveryThresholdETB: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold">
                Standard Addis Fee (ETB)
              </label>
              <Input
                type="number"
                value={form.standardAddisDeliveryFeeETB}
                onChange={(e) =>
                  setForm({ ...form, standardAddisDeliveryFeeETB: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold">
                VIP 2-Hour Courier Fee (ETB)
              </label>
              <Input
                type="number"
                value={form.vipTwoHourDeliveryFeeETB}
                onChange={(e) =>
                  setForm({ ...form, vipTwoHourDeliveryFeeETB: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block font-label text-xs font-bold">
                Regional Cargo Fee (ETB)
              </label>
              <Input
                type="number"
                value={form.regionalCargoFeeETB}
                onChange={(e) =>
                  setForm({ ...form, regionalCargoFeeETB: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
        </section>

        {/* Payment Methods */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2.5">
            <Wallet className="size-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Accepted Local Payment Options
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { key: "telebirr", label: "Telebirr SuperApp" },
                { key: "cbeBirr", label: "CBE Birr" },
                { key: "bankTransfer", label: "Awash / Bank Transfer" },
                { key: "cod", label: "Cash / POS on Delivery" },
              ] as const
            ).map(({ key, label }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-surface-low p-3.5 text-xs font-bold"
              >
                <input
                  type="checkbox"
                  checked={form.paymentMethods[key]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      paymentMethods: { ...form.paymentMethods, [key]: e.target.checked },
                    })
                  }
                  className="size-4 accent-primary"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="submit" variant="cta" size="lg">
              <Save className="size-4" /> Save Store Settings
            </Button>
          </div>
        </section>
      </form>

      {/* Device Push Notifications for Store Admin */}
      <PushNotificationSettingsCard />

      {/* Preserved Backend Health Integration Status */}
      <section className="space-y-2">
        <h2 className="font-display text-base font-bold text-foreground">
          Backend API Health Status
        </h2>
        <p className="text-xs text-muted-foreground">
          Live status of the Express.js REST API (`GET /api/v1/health`). Catalog, Cart, Orders, and
          Auth currently use the separated client-side service layer until backend domain endpoints
          are added.
        </p>
        <ApiStatusCard />
      </section>
    </div>
  );
}

