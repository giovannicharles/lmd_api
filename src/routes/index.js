import { Router } from "express";
import authRoutes from "./auth.js";
import productRoutes from "./products.js";
import categoryRoutes from "./categories.js";
import pageRoutes from "./pages.js";
import messageRoutes from "./messages.js";
import mediaRoutes from "./media.js";
import settingsRoutes from "./settings.js";
import eventRoutes from "./events.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    name: "LaMaison Dany API",
    version: "0.1.0",
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      categories: "/api/categories",
      pages: "/api/pages",
      media: "/api/media",
      messages: "/api/messages",
      settings: "/api/settings",
      events: "/api/events",
    },
  });
});

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/pages", pageRoutes);
router.use("/messages", messageRoutes);
router.use("/media", mediaRoutes);
router.use("/settings", settingsRoutes);
router.use("/events", eventRoutes);

export default router;
