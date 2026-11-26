import { Router } from "express";
import { optionalAuth, requireAuth } from "../../middlewares/auth.middleware.js";
import { cartController } from "./cart.controller.js";

const cartRouter: Router = Router();

cartRouter.use(optionalAuth);

cartRouter.get("/", cartController.getCart);
cartRouter.post("/items", cartController.addItem);
cartRouter.post("/merge", requireAuth, cartController.mergeCart);
cartRouter.patch("/items/:id", cartController.updateQuantity);
cartRouter.delete("/items/:id", cartController.removeItem);
cartRouter.delete("/", cartController.clearCart);

export { cartRouter };
