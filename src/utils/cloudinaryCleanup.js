import fs from "node:fs";
import path from "node:path";
import cloudinary from "../config/cloudinary.js";

const FOLDER = "lamaison-dany";
const LOCAL_FILE = /^[a-f0-9-]{36}\.(jpg|png|webp|avif|mp4|webm|mov)$/i;

export function publicIdFromUrl(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(lamaison-dany\/[^./]+)\.[a-z0-9]+(?:\?.*)?$/i);
  return match && match[1].startsWith(`${FOLDER}/`) ? match[1] : null;
}

export function localFileFromUrl(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/\/uploads\/([^/?#]+)(?:[?#].*)?$/);
  return match && LOCAL_FILE.test(match[1]) ? match[1] : null;
}

export async function destroyImage(url) {
  const local = localFileFromUrl(url);
  if (local) {
    try {
      fs.unlinkSync(path.resolve(process.cwd(), "uploads", local));
    } catch {
      /* already gone */
    }
    return;
  }

  const publicId = publicIdFromUrl(url);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("Cloudinary cleanup failed:", err.message);
  }
}
