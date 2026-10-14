import "express-async-errors";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import config from "./config/index.ts";
import routes from "./routes/index.ts";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.ts";

const app = express();

// Trust reverse proxy (Render load balancer) for HTTPS termination & secure cookies
app.set("trust proxy", 1);

// Parse allowed frontend origins from FRONTEND_URL env var and local dev defaults
const configuredOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([
    ...configuredOrigins,
    config.frontendUrl.replace(/\/+$/, ""),
    "http://localhost:8443",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://192.168.56.1:8443",
  ])
);

// Middleware configuration
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

if (config.nodeEnv === "development") {
  app.use(morgan("dev"));
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
    service: "ForgeEval API",
  });
});

// API Routes

app.use("/api/v1", routes);

// Serve React frontend in production if built alongside the server
if (config.nodeEnv === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const frontendPath = path.resolve(__dirname, "../../dist");

  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));

    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path === "/health") {
        return next();
      }

      res.sendFile(path.join(frontendPath, "index.html"));
    });
  }
}

// 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
