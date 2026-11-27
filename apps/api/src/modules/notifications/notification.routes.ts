import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import { notificationController } from "./notification.controller.js";
import {
  adminDispatchNotificationSchema,
  notificationIdParamSchema,
  notificationListQuerySchema,
  pushStatusQuerySchema,
  subscribePushNotificationSchema,
  unsubscribePushNotificationSchema,
  updatePushPreferencesSchema,
} from "./notification.validation.js";

const notificationRouter: Router = Router();

notificationRouter.use(requireAuth);

notificationRouter.get(
  "/push/status",
  validateRequest({ query: pushStatusQuerySchema }),
  notificationController.getPushStatus,
);
notificationRouter.post(
  "/push/subscribe",
  validateRequest({ body: subscribePushNotificationSchema }),
  notificationController.subscribePush,
);
notificationRouter.post(
  "/push/unsubscribe",
  validateRequest({ body: unsubscribePushNotificationSchema }),
  notificationController.unsubscribePush,
);
notificationRouter.patch(
  "/push/preferences",
  validateRequest({ body: updatePushPreferencesSchema }),
  notificationController.updatePushPreferences,
);
notificationRouter.post("/push/test", notificationController.sendTestPush);

notificationRouter.get(
  "/",
  validateRequest({ query: notificationListQuerySchema }),
  notificationController.listNotifications,
);
notificationRouter.get("/unread-count", notificationController.getUnreadCount);
notificationRouter.patch("/read-all", notificationController.markAllAsRead);
notificationRouter.post("/read-all", notificationController.markAllAsRead);
notificationRouter.patch(
  "/:id/read",
  validateRequest({ params: notificationIdParamSchema }),
  notificationController.markAsRead,
);
notificationRouter.delete(
  "/:id",
  validateRequest({ params: notificationIdParamSchema }),
  notificationController.deleteNotification,
);

// Admin-only dispatch & broadcast
notificationRouter.post(
  "/",
  requireRole("ADMIN"),
  validateRequest({ body: adminDispatchNotificationSchema }),
  notificationController.dispatchNotification,
);
notificationRouter.post(
  "/admin/broadcast",
  requireRole("ADMIN"),
  notificationController.dispatchNotification,
);

export { notificationRouter };
