import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { categoryController } from "./category.controller.js";

const categoryRouter: Router = Router();

categoryRouter.get("/", categoryController.listCategories);
categoryRouter.get("/:slug", categoryController.getCategoryBySlug);

// Admin routes
categoryRouter.post("/", requireAuth, requireRole("ADMIN"), categoryController.createCategory);
categoryRouter.patch("/:id", requireAuth, requireRole("ADMIN"), categoryController.updateCategory);
categoryRouter.delete("/:id", requireAuth, requireRole("ADMIN"), categoryController.deleteCategory);

export { categoryRouter };

