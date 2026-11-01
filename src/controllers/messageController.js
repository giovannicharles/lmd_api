import { z } from "zod";
import { query } from "../config/db.js";
import { notificationPrefs, notifyAdmins } from "../utils/push.js";

const STATUSES = ["new", "read", "responded", "archived"];

const messageSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional(),
  product_id: z.number().int().optional().nullable(),
});

export async function listMessages(req, res, next) {
  try {
    const { status, q, trash } = req.query;
    const params = [];
    let sql = `SELECT m.*, p.name AS product_name, p.slug AS product_slug
               FROM messages m LEFT JOIN products p ON p.id = m.product_id
               WHERE m.deleted_at IS ${trash === "1" ? "NOT NULL" : "NULL"}`;
    if (status && STATUSES.includes(status)) {
      params.push(status);
      sql += ` AND m.status = $${params.length}`;
    }
    if (q) {
      params.push(`%${String(q).slice(0, 80)}%`);
      sql += ` AND (m.name ILIKE $${params.length} OR m.message ILIKE $${params.length} OR m.phone ILIKE $${params.length} OR m.email ILIKE $${params.length})`;
    }
    sql += " ORDER BY m.created_at DESC LIMIT 500";
    const { rows } = await query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

export async function messageCounts(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'new')::int AS new,
              COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'read')::int AS read,
              COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'responded')::int AS responded,
              COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'archived')::int AS archived,
              COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total,
              COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS trash
       FROM messages`
    );
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function createMessage(req, res, next) {
  try {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const d = parsed.data;
    const { rows } = await query(
      `INSERT INTO messages (name, phone, email, message, product_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [d.name, d.phone || null, d.email || null, d.message || null, d.product_id || null]
    );
    res.status(201).json({ data: rows[0] });
    const prefs = await notificationPrefs();
    if (prefs.on_message) {
      notifyAdmins({
        title: `Nouveau message de ${d.name}`,
        body: (d.message || d.phone || d.email || "Un client vous a écrit.").slice(0, 140),
        url: "/admin?go=messages",
        tag: "message",
      });
    }
  } catch (err) {
    next(err);
  }
}

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  admin_note: z.string().trim().max(2000).optional(),
});

export async function updateMessage(req, res, next) {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success || (parsed.data.status === undefined && parsed.data.admin_note === undefined)) {
      return res.status(400).json({ error: "Modification invalide" });
    }
    const { status, admin_note } = parsed.data;
    const { rows } = await query(
      `UPDATE messages SET
         status = COALESCE($1, status),
         admin_note = COALESCE($2, admin_note),
         read_at = CASE WHEN $1::text IS NOT NULL AND $1::text <> 'new' AND read_at IS NULL THEN now() ELSE read_at END
       WHERE id = $3 AND deleted_at IS NULL RETURNING *`,
      [status ?? null, admin_note ?? null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Message not found" });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

const bulkSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  action: z.enum(["read", "responded", "archive", "delete", "restore"]),
});

export async function bulkMessages(req, res, next) {
  try {
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Action invalide" });
    const { ids, action } = parsed.data;
    const sets = {
      read: "status = 'read', read_at = COALESCE(read_at, now())",
      responded: "status = 'responded', read_at = COALESCE(read_at, now())",
      archive: "status = 'archived', read_at = COALESCE(read_at, now())",
      delete: "deleted_at = now()",
      restore: "deleted_at = NULL",
    };
    const where = action === "restore" ? "deleted_at IS NOT NULL" : "deleted_at IS NULL";
    const { rowCount } = await query(`UPDATE messages SET ${sets[action]} WHERE id = ANY($1::int[]) AND ${where}`, [ids]);
    res.json({ data: { updated: rowCount } });
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const { rowCount } = await query("UPDATE messages SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Message not found" });
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

export async function restoreMessage(req, res, next) {
  try {
    const { rowCount } = await query("UPDATE messages SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Message not found" });
    res.json({ data: { restored: true } });
  } catch (err) {
    next(err);
  }
}
