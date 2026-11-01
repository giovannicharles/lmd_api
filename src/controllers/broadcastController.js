import { z } from "zod";
import { query } from "../config/db.js";
import { pushEnabled, sendPush } from "../utils/push.js";

const broadcastSchema = z.object({
  channel: z.enum(["push", "whatsapp"]),
  title: z.string().trim().max(80).optional().default(""),
  body: z.string().trim().min(1).max(500),
  url: z.string().trim().max(300).optional().default(""),
  recipients: z.number().int().min(0).max(5000).optional().default(0),
});

export async function listBroadcasts(_req, res, next) {
  try {
    const { rows } = await query("SELECT * FROM broadcasts WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 100");
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

export async function createBroadcast(req, res, next) {
  try {
    const parsed = broadcastSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Message invalide" });
    const d = parsed.data;
    let recipients = d.recipients;
    let sent = d.recipients;
    let failed = 0;

    if (d.channel === "push") {
      if (!pushEnabled()) return res.status(503).json({ error: "Notifications indisponibles" });
      const { rows: subs } = await query("SELECT * FROM push_subscriptions WHERE audience = 'visitor' AND deleted_at IS NULL");
      recipients = subs.length;
      if (!subs.length) return res.status(400).json({ error: "Aucun visiteur abonné aux notifications pour le moment." });
      const result = await sendPush(subs, { title: d.title || "LaMaison Dany", body: d.body, url: d.url || "/", tag: "broadcast" });
      sent = result.sent;
      failed = result.failed;
    }

    const { rows } = await query(
      `INSERT INTO broadcasts (channel, title, body, url, recipients, sent, failed, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [d.channel, d.title || null, d.body, d.url || null, recipients, sent, failed, req.admin.id]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function deleteBroadcast(req, res, next) {
  try {
    const { rowCount } = await query("UPDATE broadcasts SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Introuvable" });
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

export async function listContacts(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT name, phone, email, created_at FROM messages
       WHERE deleted_at IS NULL AND ((phone IS NOT NULL AND phone <> '') OR (email IS NOT NULL AND email <> ''))
       ORDER BY created_at DESC LIMIT 2000`
    );
    const map = new Map();
    for (const r of rows) {
      const digits = (r.phone || "").replace(/\D/g, "");
      const key = digits.length >= 6 ? `p:${digits}` : `e:${(r.email || "").toLowerCase()}`;
      const cur = map.get(key);
      if (cur) {
        cur.count += 1;
        if (!cur.phone && digits.length >= 6) cur.phone = digits;
        if (!cur.email && r.email) cur.email = r.email;
      } else {
        map.set(key, { key, name: r.name, phone: digits.length >= 6 ? digits : "", email: r.email || "", last_at: r.created_at, count: 1 });
      }
    }
    res.json({ data: [...map.values()] });
  } catch (err) {
    next(err);
  }
}
