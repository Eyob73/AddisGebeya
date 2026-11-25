import { Router } from "express";
import { couponController } from "./coupon.controller.js";

const couponRouter: Router = Router();

couponRouter.get("/", couponController.listCoupons);
couponRouter.post("/validate", couponController.validateCoupon);

export { couponRouter };

