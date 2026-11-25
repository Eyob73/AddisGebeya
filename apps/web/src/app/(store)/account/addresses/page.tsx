"use client";

import * as React from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  Edit2,
  Home,
  MapPin,
  MoreVertical,
  Navigation,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import { AccountShell } from "@/components/layout/account-shell";
import { AccountPageSkeleton } from "@/components/shared/page-skeletons";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalDialog } from "@/components/ui/dialog";
import { ADDIS_SUBCITIES, ETHIOPIAN_CITIES } from "@/data/mock-footwear";
import { useAddressesQuery } from "@/hooks/use-store-queries";
import { storeService } from "@/services/store.service";
import { useUiStore } from "@/stores/ui.store";
import type { AddressRecord } from "@/types/store.types";

const ADDRESS_LABELS = ["Home", "Office", "Other"] as const;

export default function MyAddressesPage() {
  const { data: addresses = [], isLoading, refetch } = useAddressesQuery();
  const addToast = useUiStore((s) => s.addToast);
  const isMounted = useIsMounted();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingAddress, setEditingAddress] = React.useState<AddressRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  // Form fields
  const [label, setLabel] = React.useState<string>("Home");
  const [fullName, setFullName] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [region, setRegion] = React.useState("Addis Ababa");
  const [city, setCity] = React.useState("Addis Ababa");
  const [subCity, setSubCity] = React.useState<string>(ADDIS_SUBCITIES[0]);
  const [woreda, setWoreda] = React.useState("");
  const [streetAddress, setStreetAddress] = React.useState("");
  const [landmark, setLandmark] = React.useState("");
  const [riderNotes, setRiderNotes] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);

  const [isSaving, setIsSaving] = React.useState(false);

  const openCreateModal = () => {
    setEditingAddress(null);
    setLabel("Home");
    setFullName("");
    setPhoneNumber("");
    setRegion("Addis Ababa");
    setCity("Addis Ababa");
    setSubCity(ADDIS_SUBCITIES[0]);
    setWoreda("");
    setStreetAddress("");
    setLandmark("");
    setRiderNotes("");
    setIsDefault(addresses.length === 0);
    setIsModalOpen(true);
  };

  const openEditModal = (addr: AddressRecord) => {
    setEditingAddress(addr);
    setLabel(addr.label || "Home");
    setFullName(addr.fullName);
    setPhoneNumber(addr.phoneNumber);
    setRegion(addr.region || "Addis Ababa");
    setCity(addr.city || "Addis Ababa");
    setSubCity(addr.subCity);
    setWoreda(addr.woreda || "");
    setStreetAddress(addr.streetAddress || "");
    setLandmark(addr.landmark || "");
    setRiderNotes(addr.riderNotes || "");
    setIsDefault(addr.isDefault);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !phoneNumber.trim() || !streetAddress.trim()) {
      addToast({
        title: "Required Fields Missing",
        description: "Please provide recipient name, phone number, and street address.",
        variant: "warning",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<AddressRecord> = {
        label,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        region,
        city,
        subCity,
        woreda: woreda.trim() || undefined,
        streetAddress: streetAddress.trim(),
        landmark: landmark.trim() || undefined,
        riderNotes: riderNotes.trim() || undefined,
        isDefault,
      };

      if (editingAddress) {
        await storeService.updateAddress(editingAddress.id, payload);
        addToast({
          title: "Address Updated",
          description: "Delivery destination has been updated in your address book.",
          variant: "success",
        });
      } else {
        await storeService.createAddress(payload);
        addToast({
          title: "Address Saved",
          description: "New delivery destination added successfully.",
          variant: "success",
        });
      }

      refetch();
      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save address.";
      addToast({
        title: "Error",
        description: msg,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await storeService.deleteAddress(id);
      refetch();
      setDeleteConfirmId(null);
      addToast({
        title: "Address Deleted",
        description: "Delivery destination removed from your account.",
        variant: "default",
      });
    } catch {
      addToast({
        title: "Error",
        description: "Could not delete address.",
        variant: "error",
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await storeService.setDefaultAddress(id);
      refetch();
      addToast({
        title: "Default Destination Set",
        description: "This address will be pre-filled automatically during checkout.",
        variant: "success",
      });
    } catch {
      addToast({
        title: "Error",
        description: "Could not set default address.",
        variant: "error",
      });
    }
  };

  if (!isMounted) {
    return (
      <AccountShell
        title="My Addresses"
        subtitle="Manage your saved residential, office, and regional drop-off locations."
      >
        <AccountPageSkeleton />
      </AccountShell>
    );
  }

  return (
    <AccountShell
      title="My Addresses"
      subtitle="Manage your saved residential, office, and regional drop-off locations."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              Saved Delivery Addresses ({addresses.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Choose which address is used by default for express courier deliveries in Addis Ababa.
            </p>
          </div>

          <Button type="button" onClick={openCreateModal}>
            <Plus className="size-4 mr-1.5" /> Add New Address
          </Button>
        </div>

        {addresses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-light text-primary mb-4">
              <MapPin className="size-7" />
            </div>
            <h3 className="font-display text-base font-bold text-foreground">
              No Delivery Addresses Saved
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-xs text-muted-foreground">
              Save your residence or office address so our Bole courier hub can dispatch your footwear without delay.
            </p>
            <Button type="button" variant="cta" className="mt-5" onClick={openCreateModal}>
              <Plus className="size-4 mr-1.5" /> Add Delivery Address
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {addresses.map((addr) => {
              const isHome = (addr.label || "").toLowerCase() === "home";
              const isOffice = (addr.label || "").toLowerCase() === "office";

              return (
                <div
                  key={addr.id}
                  className={`flex flex-col justify-between rounded-2xl border bg-surface p-6 shadow-card transition-shadow ${
                    addr.isDefault ? "border-primary ring-1 ring-primary/20" : "border-border"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-surface-low text-primary">
                          {isOffice ? (
                            <Building2 className="size-4" />
                          ) : isHome ? (
                            <Home className="size-4" />
                          ) : (
                            <Navigation className="size-4" />
                          )}
                        </span>
                        <span className="font-display text-sm font-bold text-foreground">
                          {addr.label || "Delivery Destination"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {addr.isDefault && (
                          <Badge variant="success" className="text-[10px]">
                            <CheckCircle2 className="size-3 mr-1" /> Default Address
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-sm text-foreground">{addr.fullName}</p>
                      <p className="text-muted-foreground">{addr.phoneNumber}</p>
                      <p className="text-foreground pt-1 leading-relaxed">
                        {addr.streetAddress}
                        {addr.woreda ? `, ${addr.woreda}` : ""}
                      </p>
                      <p className="text-muted-foreground font-semibold">
                        {addr.subCity}, {addr.city}
                      </p>
                      {addr.landmark ? (
                        <p className="text-xs text-muted-foreground italic pt-1">
                          Landmark: {addr.landmark}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4 mt-4 text-xs">
                    {!addr.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(addr.id)}
                        className="font-label font-bold text-primary hover:underline cursor-pointer"
                      >
                        Set as Default
                      </button>
                    ) : (
                      <span className="font-label text-muted-foreground text-[11px]">
                        Primary Checkout Address
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(addr)}
                        className="h-8 px-2.5 text-xs"
                      >
                        <Edit2 className="size-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirmId(addr.id)}
                        className="h-8 px-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create / Edit Modal Dialog */}
        <ModalDialog
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingAddress ? "Edit Delivery Address" : "Add New Delivery Address"}
          description="Provide courier drop-off instructions for fast dispatch in Addis Ababa."
        >
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block font-label text-xs font-bold text-muted-foreground">
                  Address Label
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ADDRESS_LABELS.map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setLabel(lbl)}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold cursor-pointer transition-colors ${
                        label === lbl
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border bg-surface text-foreground hover:bg-surface-low"
                      }`}
                    >
                      {lbl === "Home" && <Home className="size-3.5" />}
                      {lbl === "Office" && <Building2 className="size-3.5" />}
                      {lbl === "Other" && <Navigation className="size-3.5" />}
                      <span>{lbl}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-label text-xs font-bold text-muted-foreground">
                  Recipient Full Name *
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Bethlehem Tadesse"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-label text-xs font-bold text-muted-foreground">
                  Phone Number *
                </label>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+251 911 234 567"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-label text-xs font-bold text-muted-foreground">
                  City *
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  {ETHIOPIAN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-label text-xs font-bold text-muted-foreground">
                  Addis Ababa Sub-City *
                </label>
                <select
                  value={subCity}
                  onChange={(e) => setSubCity(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  {ADDIS_SUBCITIES.map((sc) => (
                    <option key={sc} value={sc}>
                      {sc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block font-label text-xs font-bold text-muted-foreground">
                  Street Address / Building Details *
                </label>
                <Input
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. Bole Road, Morning Star Mall 3rd floor, Office 304"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-label text-xs font-bold text-muted-foreground">
                  Woreda (Optional)
                </label>
                <Input
                  value={woreda}
                  onChange={(e) => setWoreda(e.target.value)}
                  placeholder="e.g. Woreda 03"
                />
              </div>

              <div>
                <label className="mb-1 block font-label text-xs font-bold text-muted-foreground">
                  Landmark (Optional)
                </label>
                <Input
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Medhanialem Church"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block font-label text-xs font-bold text-muted-foreground">
                  Rider Delivery Notes (Optional)
                </label>
                <Input
                  value={riderNotes}
                  onChange={(e) => setRiderNotes(e.target.value)}
                  placeholder="e.g. Please ring bell B or call upon arrival at gate"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefaultCheckbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="size-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="isDefaultCheckbox" className="text-xs font-medium text-foreground cursor-pointer">
                  Set as default delivery address for Express Checkout
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border pt-4 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : editingAddress ? "Update Address" : "Save Address"}
              </Button>
            </div>
          </form>
        </ModalDialog>

        {/* Delete Confirmation Dialog */}
        <ModalDialog
          open={Boolean(deleteConfirmId)}
          onClose={() => setDeleteConfirmId(null)}
          title="Delete Delivery Address"
          description="Are you sure you want to delete this address? This action cannot be undone."
        >
          <div className="flex justify-end gap-2.5 pt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="cta"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirm Delete
            </Button>
          </div>
        </ModalDialog>
      </div>
    </AccountShell>
  );
}

