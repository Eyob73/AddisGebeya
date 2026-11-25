import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { productService, type ProductFilters } from "./product.service.js";

const strParam = (p: unknown): string => (Array.isArray(p) ? String(p[0] ?? "") : String(p ?? ""));

export const productController = {
  listProducts: asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      search: req.query.search as string | undefined,
      categorySlug: req.query.categorySlug as string | undefined,
      gender: req.query.gender as string | undefined,
      shoeType: req.query.shoeType as string | undefined,
      status: req.query.status as string | undefined,
      brand: req.query.brand as string | undefined,
      size: req.query.size ? Number(req.query.size) : undefined,
      colorHex: req.query.colorHex as string | undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      inStockOnly: req.query.inStockOnly === "true",
      onSaleOnly: req.query.onSaleOnly === "true",
      sortBy: req.query.sortBy as ProductFilters["sortBy"],
    };

    const products = await productService.listProducts(filters);
    sendSuccess(res, products, "Products retrieved successfully");
  }),

  getProductBySlug: asyncHandler(async (req: Request, res: Response) => {
    const slug = strParam(req.params.slug);
    const product = await productService.getProductBySlug(slug);
    sendSuccess(res, product, "Product retrieved successfully");
  }),

  createProduct: asyncHandler(async (req: Request, res: Response) => {
    const created = await productService.createProduct(req.body);
    sendSuccess(res, created, "Product created successfully", 201);
  }),

  updateProduct: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const updated = await productService.updateProduct(id, req.body);
    sendSuccess(res, updated, "Product updated successfully");
  }),

  deleteProduct: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const result = await productService.deleteProduct(id);
    sendSuccess(res, result, "Product deleted successfully");
  }),

  updateStock: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const { colorwayId, size, quantity } = req.body;
    const result = await productService.updateSizeStock(id, colorwayId, Number(size), Number(quantity));
    sendSuccess(res, result, "Stock updated successfully");
  }),

  bulkRestock: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const { colorwayId, stockBySize } = req.body;
    const result = await productService.bulkRestock(id, colorwayId, stockBySize);
    sendSuccess(res, result, "Bulk restock completed successfully");
  }),

  getProductImages: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const images = await productService.getProductImages(id);
    sendSuccess(res, images, "Product images retrieved successfully");
  }),

  uploadProductImages: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const rawFiles: Express.Multer.File[] = Array.isArray(req.files)
      ? req.files
      : req.files
        ? Object.values(req.files).flat()
        : req.file
          ? [req.file]
          : [];

    if (rawFiles.length === 0) {
      sendSuccess(res, [], "No files uploaded", 400);
      return;
    }

    const files = rawFiles.map((f) => ({
      buffer: f.buffer,
      originalname: f.originalname,
    }));

    const isPrimary = req.body.isPrimary === "true" || req.body.isPrimary === true;
    const rawPrimaryIdx =
      req.body.primaryIndex !== undefined ? Number(req.body.primaryIndex) : undefined;
    const primaryIndex =
      rawPrimaryIdx !== undefined && Number.isInteger(rawPrimaryIdx) && rawPrimaryIdx >= 0
        ? rawPrimaryIdx
        : undefined;
    const colorwayId =
      typeof req.body.colorwayId === "string" && req.body.colorwayId.trim()
        ? req.body.colorwayId.trim()
        : undefined;
    const images = await productService.uploadProductImages(
      id,
      files,
      isPrimary,
      primaryIndex,
      colorwayId,
    );
    sendSuccess(res, images, "Product images uploaded successfully", 201);
  }),

  replaceProductImage: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const imageId = strParam(req.params.imageId);

    const file = req.file || (Array.isArray(req.files) ? req.files[0] : undefined);
    if (!file) {
      sendSuccess(res, null, "Replacement image file is required", 400);
      return;
    }

    const updated = await productService.replaceProductImage(id, imageId, {
      buffer: file.buffer,
      originalname: file.originalname,
    });
    sendSuccess(res, updated, "Product image replaced successfully");
  }),

  deleteProductImage: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const imageId = strParam(req.params.imageId);
    const result = await productService.deleteProductImage(id, imageId);
    sendSuccess(res, result, "Product image deleted successfully");
  }),

  setPrimaryProductImage: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const imageId = strParam(req.params.imageId);
    const result = await productService.setPrimaryProductImage(id, imageId);
    sendSuccess(res, result, "Primary product image updated successfully");
  }),

  assignImageColorway: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const imageId = strParam(req.params.imageId);
    const colorwayId =
      typeof req.body?.colorwayId === "string" && req.body.colorwayId.trim()
        ? req.body.colorwayId.trim()
        : null;
    const result = await productService.assignImageColorway(id, imageId, colorwayId);
    sendSuccess(res, result, "Product image colorway updated successfully");
  }),

  reorderProductImages: asyncHandler(async (req: Request, res: Response) => {
    const id = strParam(req.params.id);
    const orders = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body.imageOrders)
        ? req.body.imageOrders
        : [];

    if (orders.length === 0) {
      sendSuccess(res, [], "Image orders array is required", 400);
      return;
    }

    const result = await productService.reorderProductImages(id, orders);
    sendSuccess(res, result, "Product images reordered successfully");
  }),
};
