import { Router } from "express";
import { optionalAuth, requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { createRateLimiter } from "../../middlewares/rate-limit.middleware.js";
import { orderController } from "./order.controller.js";

const trackOrderRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 25,
  keyPrefix: "order-track",
  message: "Too many order lookup requests. Please wait a minute and try again.",
});

const orderRouter: Router = Router();

orderRouter.use(optionalAuth);

orderRouter.get("/", orderController.listOrders);
orderRouter.post("/track", trackOrderRateLimiter, orderController.trackGuestOrder);
orderRouter.post("/calculate", orderController.calculate);
orderRouter.post("/", orderController.createOrder);
orderRouter.get("/:id", orderController.getOrderById);
orderRouter.patch("/:id/cancel", requireAuth, orderController.cancelOrder);
orderRouter.post("/:id/cancel", requireAuth, orderController.cancelOrder);

// Admin or verification routes
orderRouter.patch("/:id/status", requireAuth, requireRole("ADMIN"), orderController.updateStatus);
orderRouter.patch("/:id/verify-payment", requireAuth, requireRole("ADMIN"), orderController.verifyPayment);

export { orderRouter };

