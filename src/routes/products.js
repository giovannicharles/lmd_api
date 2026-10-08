import { Router } from "express";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  reorderProducts,
} from "../controllers/productController.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.get("/", listProducts);
router.put("/reorder", authRequired, reorderProducts);
router.get("/:slug", getProduct);
router.post("/", authRequired, createProduct);
router.put("/:id", authRequired, updateProduct);
router.delete("/:id", authRequired, deleteProduct);

export default router;
