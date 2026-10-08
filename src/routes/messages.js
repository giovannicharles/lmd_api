import { Router } from "express";
import {
  listMessages,
  createMessage,
  updateMessageStatus,
  deleteMessage,
} from "../controllers/messageController.js";
import { authRequired } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

router.get("/", authRequired, listMessages);
const messageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: "Trop de messages envoyes. Reessayez plus tard ou ecrivez-nous sur WhatsApp.",
});

router.post("/", messageLimiter, createMessage);
router.patch("/:id/status", authRequired, updateMessageStatus);
router.delete("/:id", authRequired, deleteMessage);

export default router;
