import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import { env } from "../config/env.js";

export const uploadsDir = path.resolve(process.cwd(), "uploads");

export const useCloudinary = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

const EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

function fileFilter(_req, file, cb) {
  if (EXTENSIONS.has(file.mimetype)) return cb(null, true);
  const err = new Error("Format d'image non supporte (JPG, PNG ou WebP)");
  err.status = 400;
  cb(err);
}

const storage = useCloudinary
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: "lamaison-dany",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
      },
    })
  : multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter,
});

export default upload;

function looksLikeImage(buffer) {
  if (buffer.length < 12) return false;
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const png = buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const webp = buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const avif = buffer.subarray(4, 12).toString("ascii").startsWith("ftyp");
  return jpeg || png || webp || avif;
}

let sharpPromise;
function loadSharp() {
  sharpPromise ??= import("sharp").then((m) => m.default).catch(() => null);
  return sharpPromise;
}

export async function finalizeUpload(req, res, next) {
  if (useCloudinary || !req.file) return next();

  try {
    const { buffer, mimetype } = req.file;
    if (!looksLikeImage(buffer)) {
      return res.status(400).json({ error: "Le fichier n'est pas une image valide" });
    }

    let output = buffer;
    let ext = EXTENSIONS.get(mimetype);
    let width;
    let height;

    const sharp = await loadSharp();
    if (sharp) {
      const result = await sharp(buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      output = result.data;
      ext = "webp";
      width = result.info.width;
      height = result.info.height;
    }

    fs.mkdirSync(uploadsDir, { recursive: true });
    const name = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, name), output);

    const base = env.publicUrl || `${req.protocol}://${req.get("host")}`;
    req.file.path = `${base}/uploads/${name}`;
    req.file.filename = name;
    req.file.format = ext;
    req.file.width = width;
    req.file.height = height;
    next();
  } catch (err) {
    next(err);
  }
}
