import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { notificationController } from "./notification.controller.js";

const notificationRouter: Router = Router();

notificationRouter.use(requireAuth);

notificationRouter.get("/", notificationController.listNotifications);
notificationRouter.patch("/:id/read", notificationController.markAsRead);
notificationRouter.post("/read-all", notificationController.markAllAsRead);

// Admin-only dispatch
notificationRouter.post("/", requireRole("ADMIN"), notificationController.dispatchNotification);

export { notificationRouter };

