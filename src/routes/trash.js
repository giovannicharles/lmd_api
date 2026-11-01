import { Router } from "express";
import { listTrash, purgeItem, restoreItem } from "../controllers/trashController.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.use(authRequired);
router.get("/", listTrash);
router.post("/:type/:id/restore", restoreItem);
router.delete("/:type/:id", purgeItem);

export default router;
