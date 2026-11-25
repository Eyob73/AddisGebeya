import { Router } from "express";
import { optionalAuth } from "../../middlewares/auth.middleware.js";
import { wishlistController } from "./wishlist.controller.js";

const wishlistRouter: Router = Router();

wishlistRouter.use(optionalAuth);

wishlistRouter.get("/", wishlistController.getWishlist);
wishlistRouter.post("/toggle", wishlistController.toggleWishlist);
wishlistRouter.delete("/:productId", wishlistController.removeItem);
wishlistRouter.delete("/", wishlistController.clearWishlist);

export { wishlistRouter };

