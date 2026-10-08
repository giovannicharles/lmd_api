import { Router } from "express";
import {
  listCategories,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
} from "../controllers/categoryController.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.get("/", listCategories);
router.post("/", authRequired, createCategory);
router.put("/reorder", authRequired, reorderCategories);
router.put("/:id", authRequired, updateCategory);
router.delete("/:id", authRequired, deleteCategory);

export default router;
