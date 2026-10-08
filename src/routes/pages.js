import { Router } from "express";
import {
  listPages,
  getPage,
  upsertPage,
  deletePage,
} from "../controllers/pageController.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.get("/", listPages);
router.get("/:slug", getPage);
router.post("/", authRequired, upsertPage);
router.delete("/:id", authRequired, deletePage);

export default router;
