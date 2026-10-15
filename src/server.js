import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";

import { env } from "./config/env.js";
import router from "./routes/index.js";
import { mountFrontend, mountSeoRoutes } from "./seo/frontend.js";
import { notFound, errorHandler } from "./middleware/errors.js";
import { applyMigrations } from "./scripts/migrate.js";

const app = express();
const PORT = env.port;
const isProd = env.nodeEnv === "production";
const CLIENT_ORIGINS = env.corsOrigin
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "font-src": ["'self'", "data:"],
        "img-src": ["'self'", "data:", "blob:", "https:", ...(isProd ? [] : ["http://localhost:*"])],
        "media-src": ["'self'", "blob:", "https:", ...(isProd ? [] : ["http://localhost:*"])],
        "connect-src": ["'self'", ...(isProd ? [] : ["http://localhost:*"])],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "upgrade-insecure-requests": isProd ? [] : null,
      },
    },
  })
);
app.use(cors({ origin: CLIENT_ORIGINS, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(isProd ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "lmd_api", version: "0.1.0" });
});

app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads"), { maxAge: "30d", immutable: true }));
app.use("/api", router);

mountSeoRoutes(app);
mountFrontend(app);

app.use(notFound);
app.use(errorHandler);

if (process.env.AUTO_MIGRATE !== "false") {
  try {
    await applyMigrations();
  } catch (err) {
    console.error("Auto-migration failed:", err);
  }
}

app.listen(PORT, () => {
  console.log(`lmd_api listening on http://localhost:${PORT}`);
});
