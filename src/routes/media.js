import { Router } from "express";
import upload, { finalizeUpload, finalizeVideo, videoUpload } from "../middleware/upload.js";
import { uploadMedia, getConfig } from "../controllers/mediaController.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.get("/config", getConfig);
router.post("/upload", authRequired, upload.single("image"), finalizeUpload, uploadMedia);

router.post("/upload-video", authRequired, videoUpload.single("video"), finalizeVideo, uploadMedia);

export default router;
