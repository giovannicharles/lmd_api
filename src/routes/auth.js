import { Router } from "express";
import { changePassword, login, me, updateProfile } from "../controllers/authController.js";
import { authRequired } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `login:${req.ip}`,
  message: "Trop de tentatives. Reessayez dans quelques minutes.",
});

router.post("/login", loginLimiter, login);
router.get("/me", authRequired, me);
router.put("/me", authRequired, updateProfile);
router.put("/password", authRequired, changePassword);

export default router;
