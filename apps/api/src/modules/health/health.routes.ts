import { Router, type Router as ExpressRouter } from "express";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { healthController } from "./health.controller.js";
import { healthQuerySchema } from "./health.validation.js";

const healthRouter: ExpressRouter = Router();

healthRouter.get(
  "/",
  validateRequest({ query: healthQuerySchema }),
  asyncHandler((req, res) => healthController.getHealth(req, res)),
);

export { healthRouter };
