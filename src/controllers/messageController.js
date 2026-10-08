import { query } from "../config/db.js";
import { z } from "zod";

const messageSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().optional(),
  product_id: z.number().int().optional().nullable(),
});

export async function listMessages(req, res, next) {
  try {
    const { status } = req.query;
    let sql = "SELECT * FROM messages";
    const params = [];

    if (status) {
      sql += " WHERE status = $1";
      params.push(status);
    }

    sql += " ORDER BY created_at DESC";
    const { rows } = await query(sql, params);
    res.json({ data: rows });
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
  } catch (err) {
    next(err);
  }
}

export async function updateMessageStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["new", "read", "responded", "archived"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const { rows } = await query(
      "UPDATE messages SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { rowCount } = await query("DELETE FROM messages WHERE id = $1", [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}
