import { Router } from "express";
import { getPublicKey, pushStats, sendTest, subscribe, unsubscribe } from "../controllers/pushController.js";
import { authRequired } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

const limiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, keyFn: (req) => `push:${req.ip}`, message: "Trop de requetes." });

router.get("/key", getPublicKey);
router.get("/stats", authRequired, pushStats);
router.post("/subscribe", limiter, subscribe);
router.post("/unsubscribe", limiter, unsubscribe);
router.post("/test", authRequired, sendTest);

export default router;
