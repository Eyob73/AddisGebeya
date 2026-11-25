import { HTTP_STATUS } from "@addisgebeya/shared";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/app-error.js";

export class CategoryService {
  async listCategories() {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    return categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      subtitle: c.subtitle ?? "",
      eyebrow: c.eyebrow ?? "",
      description: c.description ?? "",
      image: c.imageUrl,
      featured: c.isFeatured,
      active: c.isActive,
    }));
  }

  async getCategoryBySlug(slug: string) {
    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new AppError({
        message: "Category not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: "CATEGORY_NOT_FOUND",
      });
    }

    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      subtitle: category.subtitle ?? "",
      eyebrow: category.eyebrow ?? "",
      description: category.description ?? "",
      image: category.imageUrl,
      featured: category.isFeatured,
      active: category.isActive,
      productCount: category._count.products,
    };
  }

  async createCategory(data: {
    name: string;
    slug: string;
    eyebrow?: string;
    subtitle?: string;
    description?: string;
    image: string;
    featured?: boolean;
    active?: boolean;
  }) {
    const created = await prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        eyebrow: data.eyebrow,
        subtitle: data.subtitle,
        description: data.description,
        imageUrl: data.image,
        isFeatured: data.featured ?? false,
        isActive: data.active ?? true,
      },
    });

    return created;
  }

  async updateCategory(id: string, patch: Partial<{
    name: string;
    slug: string;
    eyebrow: string;
    subtitle: string;
    description: string;
    image: string;
    featured: boolean;
    active: boolean;
  }>) {
    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: patch.name,
        slug: patch.slug,
        eyebrow: patch.eyebrow,
        subtitle: patch.subtitle,
        description: patch.description,
        imageUrl: patch.image,
        isFeatured: patch.featured,
        isActive: patch.active,
      },
    });

    return updated;
  }

  async deleteCategory(id: string) {
    await prisma.category.delete({ where: { id } });
    return { deleted: true };
  }
}

export const categoryService = new CategoryService();

