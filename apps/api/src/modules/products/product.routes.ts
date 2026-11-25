import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { uploadMedia } from "../media/media.middleware.js";
import { productController } from "./product.controller.js";

const productRouter: Router = Router();

productRouter.get("/", productController.listProducts);
productRouter.get("/:slug", productController.getProductBySlug);

// Product Images (Public viewing, Admin modification)
productRouter.get("/:id/images", productController.getProductImages);
productRouter.post(
  "/:id/images",
  requireAuth,
  requireRole("ADMIN"),
  uploadMedia.array("images", 8),
  productController.uploadProductImages,
);
productRouter.put(
  "/:id/images/reorder",
  requireAuth,
  requireRole("ADMIN"),
  productController.reorderProductImages,
);
productRouter.put(
  "/:id/images/:imageId",
  requireAuth,
  requireRole("ADMIN"),
  uploadMedia.single("image"),
  productController.replaceProductImage,
);
productRouter.delete(
  "/:id/images/:imageId",
  requireAuth,
  requireRole("ADMIN"),
  productController.deleteProductImage,
);
productRouter.patch(
  "/:id/images/:imageId/primary",
  requireAuth,
  requireRole("ADMIN"),
  productController.setPrimaryProductImage,
);
productRouter.patch(
  "/:id/images/:imageId/colorway",
  requireAuth,
  requireRole("ADMIN"),
  productController.assignImageColorway,
);

// Admin product routes
productRouter.post("/", requireAuth, requireRole("ADMIN"), productController.createProduct);
productRouter.patch("/:id", requireAuth, requireRole("ADMIN"), productController.updateProduct);
productRouter.delete("/:id", requireAuth, requireRole("ADMIN"), productController.deleteProduct);
productRouter.patch("/:id/stock", requireAuth, requireRole("ADMIN"), productController.updateStock);
productRouter.post("/:id/restock", requireAuth, requireRole("ADMIN"), productController.bulkRestock);

export { productRouter };

