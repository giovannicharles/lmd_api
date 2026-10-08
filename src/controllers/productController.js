import { query } from "../config/db.js";
import { uniqueSlug } from "../utils/slug.js";
import { destroyImage } from "../utils/cloudinaryCleanup.js";
import { z } from "zod";

async function releaseImage(url) {
  if (!url) return;
  const { rows } = await query(
    "SELECT 1 FROM products WHERE image_url = $1 OR images @> to_jsonb($1::text) LIMIT 1",
    [url]
  );
  if (rows.length === 0) await destroyImage(url);
}

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative().optional().nullable(),
  image_url: z.string().url().optional().or(z.literal("")),
  images: z.array(z.string().url()).max(8).optional(),
  category_id: z.number().int().optional().nullable(),
  featured: z.boolean().optional(),
  available: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function listProducts(req, res, next) {
  try {
    const { category, featured, search } = req.query;
    let sql = `
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (category) {
      sql += ` AND c.slug = $${idx++}`;
      params.push(category);
    }
    if (featured === "true") {
      sql += ` AND p.featured = true`;
    }
    if (search) {
      sql += ` AND (p.name ILIKE $${idx} OR p.description ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    sql += ` ORDER BY p.sort_order ASC, p.created_at DESC`;
    const { rows } = await query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    const { slug } = req.params;
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = $1`,
      [slug]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const d = parsed.data;
    const slug = await uniqueSlug("products", d.name);
    const { rows } = await query(
      `INSERT INTO products (name, slug, description, price, image_url, category_id, featured, sort_order, available, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING *`,
      [d.name, slug, d.description || null, d.price ?? null, d.image_url || null,
       d.category_id || null, d.featured || false, d.sort_order || 0, d.available ?? true,
       JSON.stringify(d.images ?? [])]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const d = parsed.data;
    const previous =
      d.image_url !== undefined || d.images !== undefined
        ? await query("SELECT image_url, images FROM products WHERE id = $1", [id])
        : null;

    const fields = [];
    const params = [];
    let idx = 1;

    if (d.name !== undefined) { fields.push(`name = $${idx++}`); params.push(d.name); }
    if (d.name !== undefined) { fields.push(`slug = $${idx++}`); params.push(await uniqueSlug("products", d.name, Number(id))); }
    if (d.description !== undefined) { fields.push(`description = $${idx++}`); params.push(d.description); }
    if (d.price !== undefined) { fields.push(`price = $${idx++}`); params.push(d.price); }
    if (d.image_url !== undefined) { fields.push(`image_url = $${idx++}`); params.push(d.image_url); }
    if (d.images !== undefined) { fields.push(`images = $${idx++}::jsonb`); params.push(JSON.stringify(d.images)); }
    if (d.category_id !== undefined) { fields.push(`category_id = $${idx++}`); params.push(d.category_id); }
    if (d.featured !== undefined) { fields.push(`featured = $${idx++}`); params.push(d.featured); }
    if (d.available !== undefined) { fields.push(`available = $${idx++}`); params.push(d.available); }
    if (d.sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); params.push(d.sort_order); }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    fields.push(`updated_at = now()`);
    params.push(id);

    const { rows } = await query(
      `UPDATE products SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (previous?.rows[0]) {
      const before = [previous.rows[0].image_url, ...(previous.rows[0].images || [])].filter(Boolean);
      const after = new Set([rows[0].image_url, ...(rows[0].images || [])].filter(Boolean));
      for (const url of before) if (!after.has(url)) await releaseImage(url);
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const { rows, rowCount } = await query("DELETE FROM products WHERE id = $1 RETURNING image_url, images", [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    for (const url of [rows[0].image_url, ...(rows[0].images || [])]) {
      if (url) await releaseImage(url);
    }
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

const reorderSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(1000) });

export async function reorderProducts(req, res, next) {
  try {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Liste d'identifiants invalide" });
    }
    await query(
      `UPDATE products p SET sort_order = v.ord::int
       FROM unnest($1::int[]) WITH ORDINALITY AS v(id, ord)
       WHERE p.id = v.id`,
      [parsed.data.ids]
    );
    res.json({ data: { reordered: parsed.data.ids.length } });
  } catch (err) {
    next(err);
  }
}
