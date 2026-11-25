import { resolveUploadedAvatarUrl } from "@addisgebeya/shared";
import { prisma } from "../../config/database.js";

export class AdminService {
  async getDashboard() {
    const [
      totalOrders,
      orders,
      totalCustomers,
      lowStockVariants,
      categoriesCount,
      productsCount,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        include: { items: true },
        take: 10,
      }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.productVariant.count({
        where: {
          stockQuantity: { lte: 3 },
        },
      }),
      prisma.category.count(),
      prisma.product.count(),
    ]);

    const allOrders = await prisma.order.findMany({
      select: {
        totalETB: true,
        subCity: true,
        createdAt: true,
        status: true,
      },
    });

    const totalRevenueETB = allOrders.reduce((sum, o) => sum + Number(o.totalETB), 0);
    const averageOrderValueETB =
      totalOrders > 0 ? Math.round(totalRevenueETB / totalOrders) : 0;

    // Subcity breakdown
    const subcityMap = new Map<string, { count: number; revenueETB: number }>();
    for (const o of allOrders) {
      const current = subcityMap.get(o.subCity) ?? { count: 0, revenueETB: 0 };
      subcityMap.set(o.subCity, {
        count: current.count + 1,
        revenueETB: current.revenueETB + Number(o.totalETB),
      });
    }

    const ordersBySubcity = Array.from(subcityMap.entries()).map(([subCity, data]) => ({
      subCity,
      count: data.count,
      revenueETB: data.revenueETB,
    }));

    return {
      metrics: {
        totalRevenueETB,
        totalOrders,
        activeCustomers: totalCustomers,
        lowStockAlertsCount: lowStockVariants,
        averageOrderValueETB,
        categoriesCount,
        productsCount,
      },
      ordersBySubcity,
      recentOrders: orders.map((o) => ({
        id: o.orderNumber ?? o.id,
        customerName: o.customerName,
        subCity: o.subCity,
        totalETB: Number(o.totalETB),
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  async listCustomers() {
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      include: {
        orders: {
          select: { totalETB: true },
        },
        addresses: {
          where: { isDefault: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return customers.map((c) => {
      const totalSpentETB = c.orders.reduce((sum, o) => sum + Number(o.totalETB), 0);
      const totalOrders = c.orders.length;
      const tier: "VIP Runner" | "Repeat Buyer" | "Member" =
        totalSpentETB > 15000 || totalOrders >= 3
          ? "VIP Runner"
          : totalOrders >= 2
            ? "Repeat Buyer"
            : "Member";

      return {
        id: c.id,
        name: c.fullName,
        email: c.email,
        phone: c.phoneNumber ?? "+251 911 000 000",
        city: "Addis Ababa",
        subCity: c.subCity ?? c.addresses[0]?.subCity ?? "Bole",
        preferredSize: c.preferredSize ?? 42,
        totalOrders,
        totalSpentETB,
        tier,
        joinedAt: c.createdAt.toISOString(),
        avatarUrl: resolveUploadedAvatarUrl(c.avatarUrl),
      };
    });
  }

  async listInventory() {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        colorways: {
          include: {
            variants: {
              orderBy: { size: "asc" },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const inventoryItems = [];
    for (const p of products) {
      for (const cw of p.colorways) {
        for (const v of cw.variants) {
          inventoryItems.push({
            id: v.id,
            productId: p.id,
            productName: p.name,
            sku: v.sku ?? p.sku,
            categoryName: p.category.name,
            colorwayId: cw.id,
            colorwayName: cw.name,
            colorHex: cw.hex,
            size: v.size,
            stockQuantity: v.stockQuantity,
            lowStockThreshold: v.lowStockThreshold,
            isLowStock: v.stockQuantity <= v.lowStockThreshold,
            priceETB: Number(p.priceETB),
          });
        }
      }
    }

    return inventoryItems;
  }
}

export const adminService = new AdminService();

