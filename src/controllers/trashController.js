import { query } from "../config/db.js";
import { purgeProductImages } from "./productController.js";

const TYPES = {
  products: "id, name, slug, image_url, category_id",
  categories: "id, name, slug",
  messages: "id, name, phone, email, message, created_at",
  broadcasts: "id, channel, title, body, created_at",
  pages: "id, slug, title",
};

export async function listTrash(_req, res, next) {
  try {
    const data = {};
    for (const [type, columns] of Object.entries(TYPES)) {
      const { rows } = await query(`SELECT ${columns}, deleted_at FROM ${type} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200`);
      data[type] = rows;
    }
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function restoreItem(req, res, next) {
  try {
    const { type, id } = req.params;
    if (!TYPES[type]) return res.status(400).json({ error: "Type inconnu" });
    const { rowCount } = await query(`UPDATE ${type} SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: "Introuvable" });
    res.json({ data: { restored: true } });
  } catch (err) {
    next(err);
  }
}

export async function purgeItem(req, res, next) {
  try {
    const { type, id } = req.params;
    if (!TYPES[type]) return res.status(400).json({ error: "Type inconnu" });
    const { rows } = await query(`DELETE FROM ${type} WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Introuvable" });
    if (type === "products") await purgeProductImages(rows[0]);
    res.json({ data: { purged: true } });
  } catch (err) {
    next(err);
  }
}
