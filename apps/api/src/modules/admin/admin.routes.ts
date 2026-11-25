import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { adminController } from "./admin.controller.js";

const adminRouter: Router = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireRole("ADMIN"));

adminRouter.get("/dashboard", adminController.getDashboard);
adminRouter.get("/customers", adminController.listCustomers);
adminRouter.get("/inventory", adminController.listInventory);
adminRouter.get("/payments", adminController.listPayments);
adminRouter.post("/payments/:paymentId/review", adminController.reviewPayment);
adminRouter.get("/payment-providers", adminController.listPaymentProviderConfigs);
adminRouter.put("/payment-providers/:providerCode", adminController.updatePaymentProviderConfig);

export { adminRouter };

