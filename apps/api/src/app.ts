import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { API_PREFIX } from "@addisgebeya/shared";
import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { openApiSpec } from "./docs/openapi.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { v1Router } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");

  // Helmet with relaxed CSP on documentation route
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(cors(corsOptions));
  app.use(morgan(env.isProduction ? "combined" : "dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // API Documentation (OpenAPI / Swagger)
  app.get(`${API_PREFIX}/docs.json`, (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(openApiSpec);
  });
  app.use(`${API_PREFIX}/docs`, swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get("/docs", (_req, res) => res.redirect(`${API_PREFIX}/docs`));

  // REST API (supports /api/v1 and legacy /api)
  app.use(API_PREFIX, v1Router);
  app.use("/api", v1Router);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
