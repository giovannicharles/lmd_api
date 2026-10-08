import { Router } from "express";
import { createEvent, getStats } from "../controllers/eventController.js";
import { authRequired } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

const eventLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 150,
  keyFn: (req) => `event:${req.ip}`,
  message: "Trop de requetes",
});

router.post("/", eventLimiter, createEvent);
router.get("/stats", authRequired, getStats);

export default router;
