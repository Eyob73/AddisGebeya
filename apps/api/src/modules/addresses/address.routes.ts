import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { addressController } from "./address.controller.js";

const addressRouter: Router = Router();

addressRouter.use(requireAuth);

addressRouter.get("/", addressController.listAddresses);
addressRouter.post("/", addressController.createAddress);
addressRouter.get("/:id", addressController.getAddressById);
addressRouter.patch("/:id", addressController.updateAddress);
addressRouter.put("/:id", addressController.updateAddress);
addressRouter.delete("/:id", addressController.deleteAddress);
addressRouter.patch("/:id/default", addressController.setDefaultAddress);

export { addressRouter };

