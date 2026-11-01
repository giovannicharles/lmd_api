import { Router } from "express";
import {
  bulkMessages,
  createMessage,
  deleteMessage,
  listMessages,
  messageCounts,
  restoreMessage,
  updateMessage,
} from "../controllers/messageController.js";
import { authRequired } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

const messageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: "Trop de messages envoyes. Reessayez plus tard ou ecrivez-nous sur WhatsApp.",
});

router.get("/", authRequired, listMessages);
router.get("/counts", authRequired, messageCounts);
router.post("/", messageLimiter, createMessage);
router.post("/bulk", authRequired, bulkMessages);
router.patch("/:id", authRequired, updateMessage);
router.patch("/:id/status", authRequired, updateMessage);
router.post("/:id/restore", authRequired, restoreMessage);
router.delete("/:id", authRequired, deleteMessage);

export default router;
