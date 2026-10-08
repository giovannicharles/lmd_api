import fs from "node:fs";
import path from "node:path";
import pool from "../config/db.js";
import cloudinary from "../config/cloudinary.js";
import { useCloudinary } from "../middleware/upload.js";
import { localFileFromUrl } from "../utils/cloudinaryCleanup.js";

// Envoie vers Cloudinary les images stockees localement (dossier uploads/) et met a jour la base.
// Usage : npm run images:migrate            (execute)
//         npm run images:migrate -- --dry-run   (affiche seulement ce qui serait fait)
const dryRun = process.argv.includes("--dry-run");
const uploadsDir = path.resolve(process.cwd(), "uploads");
const cache = new Map();

async function toCloudinary(url) {
  if (cache.has(url)) return cache.get(url);
  const name = localFileFromUrl(url);
  if (!name) return url;
  const file = path.join(uploadsDir, name);
  if (!fs.existsSync(file)) {
    console.warn(`  SKIP  fichier absent : ${name}`);
    return url;
  }
  if (dryRun) {
    console.log(`  DRY   ${name}`);
    cache.set(url, url);
    return url;
  }
  const res = await cloudinary.uploader.upload(file, { folder: "lamaison-dany", resource_type: "image" });
  console.log(`  OK    ${name} -> ${res.secure_url}`);
  cache.set(url, res.secure_url);
  return res.secure_url;
}

async function main() {
  if (!useCloudinary && !dryRun) {
    console.error("Cloudinary n'est pas configure (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).");
    process.exit(1);
  }

  const { rows: products } = await pool.query("SELECT id, image_url, images FROM products");
  for (const p of products) {
    const image = p.image_url ? await toCloudinary(p.image_url) : p.image_url;
    const images = [];
    for (const u of p.images || []) images.push(await toCloudinary(u));
    const changed = image !== p.image_url || JSON.stringify(images) !== JSON.stringify(p.images || []);
    if (changed && !dryRun) {
      await pool.query("UPDATE products SET image_url = $1, images = $2::jsonb WHERE id = $3", [image, JSON.stringify(images), p.id]);
    }
  }

  const { rows: settings } = await pool.query("SELECT key, value FROM site_settings");
  for (const s of settings) {
    let text = JSON.stringify(s.value);
    const urls = new Set(text.match(/https?:\/\/[^"]+\/uploads\/[a-f0-9-]{36}\.(?:jpg|png|webp|avif)/gi) || []);
    for (const u of urls) text = text.split(u).join(await toCloudinary(u));
    if (!dryRun && text !== JSON.stringify(s.value)) {
      await pool.query("UPDATE site_settings SET value = $1::jsonb WHERE key = $2", [text, s.key]);
    }
  }

  console.log(dryRun ? "Simulation terminee." : "Migration des images terminee. Les fichiers locaux peuvent etre supprimes.");
}

main()
  .catch((err) => {
    console.error("FAIL", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
