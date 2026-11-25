import { Router, type Router as ExpressRouter } from "express";
import { addressRouter } from "../modules/addresses/address.routes.js";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { cartRouter } from "../modules/cart/cart.routes.js";
import { categoryRouter } from "../modules/categories/category.routes.js";
import { couponRouter } from "../modules/coupons/coupon.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { notificationRouter } from "../modules/notifications/notification.routes.js";
import { orderRouter } from "../modules/orders/order.routes.js";
import { paymentRouter } from "../modules/payments/payment.routes.js";
import { productRouter } from "../modules/products/product.routes.js";
import { reviewRouter } from "../modules/reviews/review.routes.js";
import { settingsRouter } from "../modules/settings/settings.routes.js";
import { wishlistRouter } from "../modules/wishlist/wishlist.routes.js";

const v1Router: ExpressRouter = Router();

v1Router.use("/health", healthRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/addresses", addressRouter);
v1Router.use("/categories", categoryRouter);
v1Router.use("/products", productRouter);
v1Router.use("/cart", cartRouter);
v1Router.use("/wishlist", wishlistRouter);
v1Router.use("/orders", orderRouter);
v1Router.use("/payment", paymentRouter);
v1Router.use("/payments", paymentRouter);
v1Router.use("/coupons", couponRouter);
v1Router.use("/reviews", reviewRouter);
v1Router.use("/notifications", notificationRouter);
v1Router.use("/settings", settingsRouter);
v1Router.use("/admin", adminRouter);

export { v1Router };
