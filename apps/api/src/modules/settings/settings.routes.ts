import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { uploadMedia } from "../media/media.middleware.js";
import { settingsController } from "./settings.controller.js";

const settingsRouter: Router = Router();

settingsRouter.get("/", settingsController.getSettings);
settingsRouter.patch("/", requireAuth, requireRole("ADMIN"), settingsController.updateSettings);
settingsRouter.post(
  "/hero-image",
  requireAuth,
  requireRole("ADMIN"),
  uploadMedia.single("image"),
  settingsController.uploadHeroImage,
);

export { settingsRouter };
