import { Router } from "express";
import { reviewController } from "./review.controller.js";

const reviewRouter: Router = Router();

reviewRouter.get("/", reviewController.listAllReviews);
reviewRouter.get("/product/:productId", reviewController.listReviews);
reviewRouter.post("/", reviewController.addReview);
reviewRouter.post("/:id/helpful", reviewController.markHelpful);

export { reviewRouter };

