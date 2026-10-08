import slugify from "slugify";
import { query } from "../config/db.js";

const TABLES = new Set(["products", "categories"]);

export async function uniqueSlug(table, name, excludeId = null) {
  if (!TABLES.has(table)) throw new Error("Unsupported table for slug");
  const base = slugify(name, { lower: true, strict: true }) || "item";
  let candidate = base;
  let n = 2;
  for (;;) {
    const { rows } = await query(
      `SELECT id FROM ${table} WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)`,
      [candidate, excludeId]
    );
    if (rows.length === 0) return candidate;
    candidate = `${base}-${n++}`;
  }
}
