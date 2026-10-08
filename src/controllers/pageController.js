import { query } from "../config/db.js";
import { z } from "zod";

const pageSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  content: z.string().optional(),
});

export async function listPages(req, res, next) {
  try {
    const { rows } = await query("SELECT * FROM pages ORDER BY title ASC");
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

export async function getPage(req, res, next) {
  try {
    const { slug } = req.params;
    const { rows } = await query("SELECT * FROM pages WHERE slug = $1", [slug]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Page not found" });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function upsertPage(req, res, next) {
  try {
    const parsed = pageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { slug, title, content } = parsed.data;
    const { rows } = await query(
      `INSERT INTO pages (slug, title, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug)
       DO UPDATE SET title = $2, content = $3, updated_at = now()
       RETURNING *`,
      [slug, title, content || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function deletePage(req, res, next) {
  try {
    const { id } = req.params;
    const { rowCount } = await query("DELETE FROM pages WHERE id = $1", [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: "Page not found" });
    }
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}
