import { Router } from "express";
import upload, { finalizeUpload } from "../middleware/upload.js";
import { uploadMedia, getConfig } from "../controllers/mediaController.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.get("/config", getConfig);
router.post("/upload", authRequired, upload.single("image"), finalizeUpload, uploadMedia);

export default router;
