import { query } from "../config/db.js";
import { uniqueSlug } from "../utils/slug.js";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1),
});

export async function listCategories(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req, res, next) {
  try {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { name } = parsed.data;
    const slug = await uniqueSlug("categories", name);
    const { rows } = await query(
      "INSERT INTO categories (name, slug, sort_order) VALUES ($1, $2, COALESCE((SELECT MAX(sort_order) FROM categories), 0) + 1) RETURNING *",
      [name, slug]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { id } = req.params;
    const { name } = parsed.data;
    const slug = await uniqueSlug("categories", name, Number(id));
    const { rows } = await query(
      "UPDATE categories SET name = $1, slug = $2 WHERE id = $3 RETURNING *",
      [name, slug, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { rowCount } = await query("DELETE FROM categories WHERE id = $1", [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

const reorderSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) });

export async function reorderCategories(req, res, next) {
  try {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Liste d'identifiants invalide" });
    }
    await query(
      `UPDATE categories c SET sort_order = v.ord::int
       FROM unnest($1::int[]) WITH ORDINALITY AS v(id, ord)
       WHERE c.id = v.id`,
      [parsed.data.ids]
    );
    res.json({ data: { reordered: parsed.data.ids.length } });
  } catch (err) {
    next(err);
  }
}
