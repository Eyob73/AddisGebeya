import { Router, type Router as ExpressRouter } from "express";
import { healthRouter } from "../modules/health/health.routes.js";

const v1Router: ExpressRouter = Router();

v1Router.use("/health", healthRouter);

export { v1Router };
