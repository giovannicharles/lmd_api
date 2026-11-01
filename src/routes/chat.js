import { Router } from "express";
import { chat, chatStatus } from "../controllers/chatController.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyFn: (req) => `chat:${req.ip}`,
  message: "Trop de messages. Reessayez dans une minute.",
});

router.get("/status", chatStatus);
router.post("/", limiter, chat);

export default router;
