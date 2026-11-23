import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { API_PREFIX } from "@addisgebeya/shared";
import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { v1Router } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(morgan(env.isProduction ? "combined" : "dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use(API_PREFIX, v1Router);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
