"use client";

import * as React from "react";
import {
  Calendar,
  Camera,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  Ruler,
  Save,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { resolveUploadedAvatarUrl } from "@addisgebeya/shared";
import { AccountShell } from "@/components/layout/account-shell";
import { AccountPageSkeleton } from "@/components/shared/page-skeletons";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADDIS_SUBCITIES, ADULT_EU_SIZES } from "@/data/mock-footwear";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

export default function PersonalInformationPage() {
  const { user, updateProfile, uploadAvatar } = useAuthStore();
  const addToast = useUiStore((s) => s.addToast);
  const isMounted = useIsMounted();

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [dateOfBirth, setDateOfBirth] = React.useState("");
  const [preferredSize, setPreferredSize] = React.useState(42);
  const [subCity, setSubCity] = React.useState<string>(ADDIS_SUBCITIES[0]);
  const [selectedAvatar, setSelectedAvatar] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (user) {
      const parts = (user.name || "").trim().split(" ");
      setFirstName(user.firstName || parts[0] || "");
      setLastName(user.lastName || parts.slice(1).join(" ") || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setDateOfBirth(user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "");
      setPreferredSize(user.preferredSize || 42);
      setSubCity(user.subCity || ADDIS_SUBCITIES[0]);
      setSelectedAvatar(resolveUploadedAvatarUrl(user.avatarUrl) || "");
    }
  }, [user]);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast({
        title: "Invalid File Type",
        description: "Please select an image file (PNG, JPG, or WEBP).",
        variant: "warning",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast({
        title: "File Too Large",
        description: "Please upload an image smaller than 5 MB.",
        variant: "warning",
      });
      return;
    }

    try {
      const uploadedUrl = await uploadAvatar(file);
      if (uploadedUrl) {
        setSelectedAvatar(uploadedUrl);
      }
      addToast({
        title: "Avatar Uploaded",
        description: "Your profile picture has been uploaded to Cloudinary.",
        variant: "success",
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Could not upload avatar image.";
      addToast({
        title: "Avatar Upload Failed",
        description: errMsg,
        variant: "error",
      });
    } finally {
      e.target.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setSelectedAvatar("");
    try {
      await updateProfile({ avatarUrl: null });
      addToast({
        title: "Profile Photo Removed",
        description: "Your profile avatar has been cleared.",
        variant: "default",
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Could not remove profile photo.";
      addToast({
        title: "Update Failed",
        description: errMsg,
        variant: "error",
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName) {
      addToast({
        title: "Name Required",
        description: "Please enter your first and last name.",
        variant: "warning",
      });
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      addToast({
        title: "Valid Email Required",
        description: "Please enter a valid email address.",
        variant: "warning",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateProfile({
        name: fullName,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        preferredSize,
        subCity,
        dateOfBirth: dateOfBirth || null,
        avatarUrl: resolveUploadedAvatarUrl(selectedAvatar) ?? null,
      });

      if (updated) {
        addToast({
          title: "Profile Saved Successfully",
          description: "Your personal information and sizing preferences have been updated in the database.",
          variant: "success",
        });
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to update profile. Please try again.";
      addToast({
        title: "Update Failed",
        description: errorMsg,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted) {
    return (
      <AccountShell
        title="Personal Information"
        subtitle="Manage your name, email, Ethiopian mobile number, and sizing preferences."
      >
        <AccountPageSkeleton />
      </AccountShell>
    );
  }

  return (
    <AccountShell
      title="Personal Information"
      subtitle="Manage your name, email, Ethiopian mobile number, and sizing preferences."
    >
      <div className="space-y-8">
        {/* Profile Picture */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-5 flex items-center gap-2.5">
            <Camera className="size-5 text-primary" />
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Profile Photo
              </h2>
              <p className="text-xs text-muted-foreground">
                Upload your own profile picture. Only uploaded photos are displayed.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative size-24 shrink-0 sm:size-28">
              <UserAvatar
                src={selectedAvatar}
                name={user?.name}
                alt={user?.name || "Profile picture"}
                className="size-full border-3 text-2xl shadow-md"
                uploadedClassName="border-primary"
                blankClassName="border-border"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                title="Upload Photo"
              >
                <Camera className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFile}
                className="hidden"
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3.5 mr-1" /> Upload Photo
                </Button>
                {resolveUploadedAvatarUrl(selectedAvatar) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5 mr-1" /> Remove Photo
                  </Button>
                ) : null}
                <span className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5 MB</span>
              </div>
            </div>
          </div>
        </section>

        {/* Personal Details Form */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <User className="size-5 text-primary" />
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Personal Credentials &amp; Delivery Fit
              </h2>
              <p className="text-xs text-muted-foreground">
                Ensure your full name matches your official government ID or mobile money registration for smooth verification.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                  First Name
                </label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Bethlehem"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                  Last Name (Grandfather / Surname)
                </label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Tadesse"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                  Email Address
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                  />
                  <Mail className="absolute right-3 top-3 size-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Order receipts, tracking dispatches, and verification notices are sent here.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                  Ethiopian Phone Number
                </label>
                <div className="relative">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+251 911 234 567"
                  />
                  <Phone className="absolute right-3 top-3 size-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Telebirr USSD prompt and Bole courier call on delivery.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                  Date of Birth (Optional)
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                  <Calendar className="absolute right-3 top-3 size-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Used for birthday promotion gifts and exclusive drops.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                  Preferred Continental EU Shoe Size
                </label>
                <div className="relative">
                  <select
                    value={preferredSize}
                    onChange={(e) => setPreferredSize(Number(e.target.value))}
                    className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    {ADULT_EU_SIZES.map((sz) => (
                      <option key={sz} value={sz}>
                        EU {sz} Continental
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Highlights available pairs in your size across our footwear catalog.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block font-label text-xs font-bold text-muted-foreground">
                  Default Addis Ababa Sub-City
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
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Pre-fills your Express Checkout and calculates courier arrival estimates.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-6">
              <span className="text-xs text-muted-foreground">
                All data is encrypted and stored securely in our PostgreSQL database.
              </span>
              <Button type="submit" disabled={isSaving}>
                <Save className="size-4 mr-1.5" />
                {isSaving ? "Saving Changes..." : "Save Personal Details"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </AccountShell>
  );
}

