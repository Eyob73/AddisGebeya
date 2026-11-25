"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ImagePlus,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { storeService } from "@/services/store.service";
import { useUiStore } from "@/stores/ui.store";
import type { ProductImageItem } from "@/types/store.types";
import { cn } from "@/lib/utils";

/** Assigns a product image to a colorway while tolerating stale HMR singletons in dev mode. */
export async function linkProductImageColorway(
  productId: string,
  imageId: string,
  colorwayId: string | null,
): Promise<ProductImageItem> {
  if (typeof storeService.assignProductImageColorway === "function") {
    return await storeService.assignProductImageColorway(productId, imageId, colorwayId);
  }
  return await apiClient.patch<ProductImageItem>(
    `/products/${productId}/images/${imageId}/colorway`,
    { colorwayId },
  );
}

export interface ManagedImageItem {
  id?: string;
  colorwayId?: string | null;
  imageUrl: string;
  publicId?: string;
  isPrimary: boolean;
  displayOrder: number;
  file?: File;
  isUploading?: boolean;
}

export interface UploaderColorwayOption {
  id: string;
  name: string;
  hex: string;
}

interface ProductImageUploaderProps {
  productId?: string;
  images: ManagedImageItem[];
  onChange: (images: ManagedImageItem[]) => void;
  colorways?: UploaderColorwayOption[];
  savedColorwayIds?: string[];
  maxImages?: number;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export function ProductImageUploader({
  productId,
  images,
  onChange,
  colorways = [],
  savedColorwayIds,
  maxImages = 8,
}: ProductImageUploaderProps) {
  const queryClient = useQueryClient();
  const addToast = useUiStore((s) => s.addToast);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const replaceInputRef = React.useRef<HTMLInputElement>(null);
  const [replacingImageId, setReplacingImageId] = React.useState<string | null>(null);
  const [brokenUrls, setBrokenUrls] = React.useState<Record<string, boolean>>({});
  const [uploadColorwayId, setUploadColorwayId] = React.useState<string>("");

  const persistedCwSet = React.useMemo(
    () => new Set(savedColorwayIds ?? colorways.map((c) => c.id)),
    [savedColorwayIds, colorways],
  );

  const validateFiles = (files: File[]): File[] => {
    const valid: File[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());
      const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);

      if (!isAllowedMime && !isAllowedExt) {
        addToast({
          title: "Unsupported Image Format",
          description: `"${file.name}" rejected. Allowed formats: JPEG, JPG, PNG, WebP.`,
          variant: "warning",
        });
        continue;
      }

      if (file.size > MAX_FILE_BYTES) {
        addToast({
          title: "File Exceeds Limit",
          description: `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)} MB. Maximum allowed size is 5 MB.`,
          variant: "warning",
        });
        continue;
      }

      valid.push(file);
    }

    return valid;
  };

  const handleFilesAdded = async (rawFiles: FileList | File[]) => {
    const fileArray = Array.from(rawFiles);
    const validFiles = validateFiles(fileArray);
    if (validFiles.length === 0) return;

    const availableSlots = maxImages - images.length;
    if (availableSlots <= 0) {
      addToast({
        title: "Maximum Images Reached",
        description: `Each shoe model can have at most ${maxImages} images.`,
        variant: "warning",
      });
      return;
    }

    const filesToUpload = validFiles.slice(0, availableSlots);

    // If editing an existing product, upload directly to Cloudinary backend!
    if (productId) {
      setIsLoading(true);
      try {
        const formData = new FormData();
        filesToUpload.forEach((f) => formData.append("images", f));
        if (images.length === 0) {
          formData.append("isPrimary", "true");
        }
        const canBindImmediate = uploadColorwayId && persistedCwSet.has(uploadColorwayId);
        if (canBindImmediate) {
          formData.append("colorwayId", uploadColorwayId);
        }

        const uploaded = await storeService.uploadProductImages(productId, formData);
        const mappedUploaded: ManagedImageItem[] = uploaded.map((u) => ({
          id: u.id,
          colorwayId: u.colorwayId ?? (uploadColorwayId || null),
          imageUrl: u.imageUrl,
          publicId: u.publicId,
          isPrimary: u.isPrimary,
          displayOrder: u.displayOrder,
        }));

        onChange([...images, ...mappedUploaded]);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["product"] });

        addToast({
          title: "Images Stored on Cloudinary",
          description: `Uploaded ${filesToUpload.length} image(s) to addisgebeya/products folder.`,
          variant: "success",
        });
      } catch (err: unknown) {
        addToast({
          title: "Upload Failed",
          description: err instanceof Error ? err.message : "Could not upload images to server.",
          variant: "error",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Local preview state for new product before saving
      const newLocalItems: ManagedImageItem[] = filesToUpload.map((file, idx) => ({
        colorwayId: uploadColorwayId || null,
        imageUrl: URL.createObjectURL(file),
        file,
        isPrimary: images.length === 0 && idx === 0,
        displayOrder: images.length + idx,
      }));

      onChange([...images, ...newLocalItems]);
      addToast({
        title: "Images Added",
        description: `${filesToUpload.length} image(s) staged for Cloudinary upload upon product save.`,
        variant: "success",
      });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleSetPrimary = async (targetIndex: number) => {
    const target = images[targetIndex];
    if (!target) return;

    if (productId && target.id) {
      setIsLoading(true);
      try {
        await storeService.setPrimaryProductImage(productId, target.id);
        const updated = images.map((img, idx) => ({
          ...img,
          isPrimary: idx === targetIndex,
        }));
        onChange(updated);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["product"] });
        addToast({
          title: "Primary Image Updated",
          description: "This photo is now the hero image across the storefront and catalog.",
          variant: "success",
        });
      } catch (err: unknown) {
        addToast({
          title: "Failed to Update Primary Image",
          description: err instanceof Error ? err.message : "Could not set primary image.",
          variant: "error",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      const updated = images.map((img, idx) => ({
        ...img,
        isPrimary: idx === targetIndex,
      }));
      onChange(updated);
    }
  };

  const handleMove = async (currentIndex: number, direction: "left" | "right") => {
    const newIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= images.length) return;

    const reordered = [...images];
    const [moved] = reordered.splice(currentIndex, 1);
    if (!moved) return;
    reordered.splice(newIndex, 0, moved);

    const updatedWithOrders = reordered.map((img, idx) => ({
      ...img,
      displayOrder: idx,
    }));

    onChange(updatedWithOrders);

    if (productId && updatedWithOrders.every((img) => img.id)) {
      try {
        await storeService.reorderProductImages(
          productId,
          updatedWithOrders.map((img) => ({ id: img.id!, displayOrder: img.displayOrder })),
        );
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["product"] });
      } catch {
        // Reordering persisted locally
      }
    }
  };

  const handleDelete = async (indexToDelete: number) => {
    const target = images[indexToDelete];
    if (!target) return;

    if (productId && target.id) {
      setIsLoading(true);
      try {
        await storeService.deleteProductImage(productId, target.id);
        const remaining = images.filter((_, idx) => idx !== indexToDelete);
        // If deleted was primary, assign first remaining as primary
        if (target.isPrimary && remaining.length > 0) {
          const first = remaining[0];
          if (first) {
            first.isPrimary = true;
          }
        }
        onChange(remaining);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["product"] });
        addToast({
          title: "Image Deleted",
          description: "Removed asset from Cloudinary storage and database record.",
          variant: "success",
        });
      } catch (err: unknown) {
        addToast({
          title: "Delete Failed",
          description: err instanceof Error ? err.message : "Could not delete image.",
          variant: "error",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      const remaining = images.filter((_, idx) => idx !== indexToDelete);
      if (target.isPrimary && remaining.length > 0) {
        const first = remaining[0];
        if (first) {
          first.isPrimary = true;
        }
      }
      onChange(remaining);
    }
  };

  const triggerReplace = (imageId: string) => {
    setReplacingImageId(imageId);
    if (replaceInputRef.current) {
      replaceInputRef.current.value = "";
      replaceInputRef.current.click();
    }
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !replacingImageId) return;

    const file = files[0];
    if (!file) return;

    const validFiles = validateFiles([file]);
    if (validFiles.length === 0) return;

    const targetIdx = images.findIndex((img) => img.id === replacingImageId);
    if (targetIdx === -1) return;

    if (productId) {
      setIsLoading(true);
      try {
        const formData = new FormData();
        formData.append("image", file);

        const replaced = await storeService.replaceProductImage(
          productId,
          replacingImageId,
          formData,
        );

        const updated = [...images];
        const existingTarget = updated[targetIdx];
        if (existingTarget) {
          updated[targetIdx] = {
            ...existingTarget,
            imageUrl: replaced.imageUrl,
            publicId: replaced.publicId,
          };
        }
        onChange(updated);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["product"] });

        addToast({
          title: "Image Replaced",
          description: "New image uploaded to Cloudinary; previous asset safely removed.",
          variant: "success",
        });
      } catch (err: unknown) {
        addToast({
          title: "Replacement Failed",
          description: err instanceof Error ? err.message : "Could not replace image.",
          variant: "error",
        });
      } finally {
        setIsLoading(false);
        setReplacingImageId(null);
      }
    } else {
      const updated = [...images];
      const existingTarget = updated[targetIdx];
      if (existingTarget) {
        updated[targetIdx] = {
          ...existingTarget,
          imageUrl: URL.createObjectURL(file),
          file,
        };
      }
      onChange(updated);
      setReplacingImageId(null);
    }
  };

  const handleAssignColorway = async (targetIndex: number, nextColorwayId: string) => {
    const target = images[targetIndex];
    if (!target) return;
    const normalizedId = nextColorwayId || null;

    if (productId && target.id && (!normalizedId || persistedCwSet.has(normalizedId))) {
      setIsLoading(true);
      try {
        await linkProductImageColorway(productId, target.id, normalizedId);
        onChange(
          images.map((img, idx) =>
            idx === targetIndex ? { ...img, colorwayId: normalizedId } : img,
          ),
        );
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["product"] });
      } catch (err: unknown) {
        addToast({
          title: "Colorway Link Failed",
          description:
            err instanceof Error ? err.message : "Could not assign image to colorway.",
          variant: "error",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      onChange(
        images.map((img, idx) =>
          idx === targetIndex ? { ...img, colorwayId: normalizedId } : img,
        ),
      );
    }
  };

  return (
    <div className="space-y-4">
      {colorways.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-low/80 px-4 py-2.5 text-xs">
          <div className="space-y-0.5">
            <span className="block font-label font-bold text-foreground">
              Upload Target Colorway
            </span>
            <span className="block text-[11px] text-muted-foreground">
              Link newly uploaded photos to a specific color so storefront image switching works automatically.
            </span>
          </div>
          <select
            value={uploadColorwayId}
            onChange={(e) => setUploadColorwayId(e.target.value)}
            aria-label="Default colorway for new uploads"
            className="h-9 rounded-lg border border-border bg-surface px-3 font-label text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">All Colors (General Gallery)</option>
            {colorways.map((cw) => (
              <option key={cw.id} value={cw.id}>
                {cw.name || "Unnamed Color"}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Upload Zone */}
      <label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-between gap-4 rounded-xl border-2 border-dashed p-6 transition-all sm:flex-row",
          isDragging
            ? "border-primary bg-primary-light/50 scale-[1.01]"
            : "border-primary/40 bg-surface-low/70 hover:bg-surface-container/60",
        )}
      >
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-full bg-surface text-primary shadow-sm">
            {isLoading ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : (
              <Upload className="size-6" />
            )}
          </div>
          <div>
            <p className="font-label text-sm font-bold text-foreground">
              Drop product photos here or <span className="text-cta underline">browse files</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Supports JPEG, JPG, PNG, and WebP (Max 5 MB each, up to {maxImages} images total)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="soft" className="text-xs">
            {images.length} of {maxImages} Uploaded
          </Badge>
          <span className="rounded-full bg-surface px-4 py-2 font-label text-xs font-bold text-primary shadow-xs">
            Select Photos
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp"
          multiple
          disabled={isLoading || images.length >= maxImages}
          onChange={(e) => {
            if (e.target.files) handleFilesAdded(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </label>

      {/* Hidden file input for single image replacement */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp"
        onChange={handleReplaceFile}
        className="hidden"
      />

      {/* Image Previews Grid */}
      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-low/30 p-8 text-center text-sm text-muted-foreground">
          <Camera className="mx-auto size-8 text-muted-foreground/40 mb-2" />
          <p className="font-medium text-foreground">No photos uploaded yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add clean studio footwear renders to showcase this sneaker across AddisGebeya.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img, idx) => (
            <div
              key={img.id || img.imageUrl}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-xl border bg-surface shadow-card transition-all",
                img.isPrimary
                  ? "border-primary ring-2 ring-primary/40 shadow-card-hover"
                  : "border-border/80 hover:border-border",
              )}
            >
              {/* Image Preview Box */}
              <div className="relative aspect-square w-full overflow-hidden bg-surface-media p-2">
                {brokenUrls[img.imageUrl] ? (
                  <div className="flex size-full flex-col items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-3 text-center">
                    <ImagePlus className="mb-1.5 size-6 text-destructive/70" />
                    <span className="font-label text-[11px] font-bold text-destructive">
                      Image Failed to Fetch
                    </span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground">
                      Replace or re-upload this asset
                    </span>
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={img.imageUrl}
                    alt={`Product photo ${idx + 1}`}
                    onError={() =>
                      setBrokenUrls((prev) => ({ ...prev, [img.imageUrl]: true }))
                    }
                    className="size-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                )}

                {/* Primary Tag */}
                {img.isPrimary ? (
                  <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 font-label text-[10px] font-bold text-primary-foreground shadow-xs">
                    <Star className="size-3 fill-current" /> HERO
                  </span>
                ) : (
                  <span className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 font-label text-[10px] font-semibold text-white backdrop-blur-xs">
                    #{idx + 1}
                  </span>
                )}

                {/* Quick actions hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {!img.isPrimary && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetPrimary(idx)}
                      title="Set as Hero Image"
                      className="size-8 p-0 rounded-full bg-white text-primary hover:bg-white/90"
                    >
                      <Star className="size-4" />
                    </Button>
                  )}

                  {img.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => triggerReplace(img.id!)}
                      title="Replace Image"
                      className="size-8 p-0 rounded-full bg-white text-foreground hover:bg-white/90"
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(idx)}
                    title="Delete Image"
                    className="size-8 p-0 rounded-full"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Card Footer Controls */}
              <div className="space-y-2 border-t border-border/70 bg-surface-low/80 p-2 text-xs">
                {colorways.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const matchedCw = colorways.find((c) => c.id === img.colorwayId);
                      return (
                        <span
                          className="size-3 shrink-0 rounded-full border border-border"
                          style={{
                            backgroundColor: matchedCw?.hex ?? "transparent",
                          }}
                          title={matchedCw ? matchedCw.name : "Shared gallery image"}
                        />
                      );
                    })()}
                    <select
                      value={img.colorwayId ?? ""}
                      onChange={(e) => handleAssignColorway(idx, e.target.value)}
                      aria-label={`Assign colorway for image ${idx + 1}`}
                      className="h-7 min-w-0 flex-1 truncate rounded-md border border-border bg-surface px-1.5 font-label text-[11px] font-semibold text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="">All Colors</option>
                      {colorways.map((cw) => (
                        <option key={cw.id} value={cw.id}>
                          {cw.name || "Color"}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(idx)}
                    className={cn(
                      "flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer",
                      img.isPrimary
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Star className={cn("size-3", img.isPrimary && "fill-current")} />
                    {img.isPrimary ? "Hero" : "Make Hero"}
                  </button>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, "left")}
                      title="Move left"
                      className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      <ArrowLeft className="size-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === images.length - 1}
                      onClick={() => handleMove(idx, "right")}
                      title="Move right"
                      className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
