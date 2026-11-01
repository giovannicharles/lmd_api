import { Router } from "express";
import { createBroadcast, deleteBroadcast, listBroadcasts, listContacts } from "../controllers/broadcastController.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.use(authRequired);
router.get("/", listBroadcasts);
router.get("/contacts", listContacts);
router.post("/", createBroadcast);
router.delete("/:id", deleteBroadcast);

export default router;
