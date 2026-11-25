import { Router } from "express";
import { optionalAuth, requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { orderController } from "./order.controller.js";

const orderRouter: Router = Router();

orderRouter.use(optionalAuth);

orderRouter.get("/", orderController.listOrders);
orderRouter.get("/:id", orderController.getOrderById);
orderRouter.post("/calculate", orderController.calculate);
orderRouter.post("/", orderController.createOrder);

// Admin or verification routes
orderRouter.patch("/:id/status", requireAuth, requireRole("ADMIN"), orderController.updateStatus);
orderRouter.patch("/:id/verify-payment", requireAuth, requireRole("ADMIN"), orderController.verifyPayment);

export { orderRouter };

