"use client";

import * as React from "react";
import { Edit3, PlusCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog, ModalDialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { HERO_ASSETS } from "@/data/mock-footwear";
import { useCatalogStore } from "@/stores/catalog.store";
import { useUiStore } from "@/stores/ui.store";
import type { ShoeCategory } from "@/types/store.types";
import { slugify } from "@/utils/format";

export default function AdminCategoriesPage() {
  const { categories, products, addCategory, updateCategory, deleteCategory } = useCatalogStore();
  const addToast = useUiStore((s) => s.addToast);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ShoeCategory | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<ShoeCategory | null>(null);

  const [name, setName] = React.useState("");
  const [eyebrow, setEyebrow] = React.useState("");
  const [subtitle, setSubtitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [image, setImage] = React.useState(HERO_ASSETS.heroSneaker);
  const [featured, setFeatured] = React.useState(true);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setEyebrow("Curated Collection");
    setSubtitle("");
    setDescription("");
    setImage(HERO_ASSETS.heroSneaker);
    setFeatured(true);
    setModalOpen(true);
  };

  const openEdit = (cat: ShoeCategory) => {
    setEditing(cat);
    setName(cat.name);
    setEyebrow(cat.eyebrow);
    setSubtitle(cat.subtitle);
    setDescription(cat.description);
    setImage(cat.image);
    setFeatured(cat.featured);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editing) {
      updateCategory(editing.id, {
        name: name.trim(),
        eyebrow: eyebrow.trim() || "Collection",
        subtitle: subtitle.trim(),
        description: description.trim(),
        image: image.trim() || HERO_ASSETS.heroSneaker,
        featured,
      });
      addToast({ title: "Category Updated", description: `${name} updated.`, variant: "success" });
    } else {
      addCategory({
        id: `cat-${Date.now()}`,
        slug: slugify(name),
        name: name.trim(),
        eyebrow: eyebrow.trim() || "New Line",
        subtitle: subtitle.trim() || "Handpicked authentic footwear.",
        description: description.trim() || "Explore curated silhouettes in this category.",
        image: image.trim() || HERO_ASSETS.heroSneaker,
        featured,
        active: true,
      });
      addToast({ title: "Category Created", description: `${name} added.`, variant: "success" });
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Category Management
          </h1>
          <p className="text-xs text-muted-foreground">
            Organize your single-vendor shoe taxonomy and homepage bento showcase.
          </p>
        </div>
        <Button type="button" variant="cta" onClick={openCreate}>
          <PlusCircle className="size-4" /> Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((cat) => {
          const count = products.filter((p) => p.categorySlug === cat.slug).length;
          return (
            <div
              key={cat.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
            >
              <div>
                <div className="relative h-36 w-full overflow-hidden bg-surface-container">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cat.image} alt={cat.name} className="size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <Badge variant={cat.active ? "success" : "outline"}>
                      {cat.active ? "Active" : "Hidden"}
                    </Badge>
                    {cat.featured ? <Badge variant="cta">Homepage Bento</Badge> : null}
                  </div>
                  <div className="absolute bottom-3 left-3 text-white">
                    <span className="block font-label text-[10px] font-bold uppercase text-[#B0ECFF]">
                      {cat.eyebrow}
                    </span>
                    <h2 className="font-display text-lg font-bold">{cat.name}</h2>
                  </div>
                </div>
                <div className="p-4">
                  <p className="line-clamp-2 text-xs text-muted-foreground">{cat.subtitle}</p>
                  <p className="mt-2 font-label text-xs font-bold text-primary">
                    {count} linked shoe {count === 1 ? "model" : "models"} • /{cat.slug}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border bg-surface-low/50 px-4 py-3">
                <button
                  type="button"
                  onClick={() => updateCategory(cat.id, { active: !cat.active })}
                  className="font-label text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  {cat.active ? "Hide Category" : "Activate"}
                </button>
                <div className="flex items-center gap-1.5">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(cat)}>
                    <Edit3 className="size-3.5" /> Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingDelete(cat)}
                    aria-label={`Delete ${cat.name}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Category: ${editing.name}` : "Create Footwear Category"}
        className="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block font-label text-xs font-bold">Category Name *</label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-label text-xs font-bold">Eyebrow Label</label>
            <Input value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-label text-xs font-bold">Short Subtitle</label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-label text-xs font-bold">Description</label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-label text-xs font-bold">Banner Image URL</label>
            <Input value={image} onChange={(e) => setImage(e.target.value)} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="size-4 accent-primary"
            />
            Feature in Homepage 6-Card Bento Grid
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="cta">
              Save Category
            </Button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmationDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        destructive
        confirmLabel="Delete Category"
        title={`Delete "${pendingDelete?.name}"?`}
        description="Products in this category will remain in your catalog but will no longer appear under this category landing page."
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteCategory(pendingDelete.id);
          addToast({ title: "Category Deleted", variant: "warning" });
        }}
      />
    </div>
  );
}

