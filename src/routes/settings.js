import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settingsController.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.get("/", getSettings);
router.put("/", authRequired, updateSettings);

export default router;
