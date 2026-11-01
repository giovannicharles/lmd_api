import { z } from "zod";
import { query } from "../config/db.js";
import { notificationPrefs, notifyAdmins } from "../utils/push.js";

const eventSchema = z.object({
  type: z.enum(["whatsapp_request", "chat_handoff", "product_view"]),
  product_id: z.number().int().positive().optional().nullable(),
});

export async function createEvent(req, res, next) {
  try {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Evenement invalide" });
    }
    const { type, product_id } = parsed.data;
    try {
      await query("INSERT INTO events (type, product_id) VALUES ($1, $2)", [type, product_id ?? null]);
    } catch (err) {
      if (err.code !== "23503") throw err;
      await query("INSERT INTO events (type) VALUES ($1)", [type]);
    }
    res.status(201).json({ data: { recorded: true } });
    if (type === "chat_handoff" || type === "whatsapp_request") {
      const prefs = await notificationPrefs();
      if (type === "chat_handoff" && prefs.on_handoff) {
        notifyAdmins({ title: "Un client veut vous parler", body: "Il a demandé à continuer la discussion avec l'équipe depuis l'assistant.", url: "/admin?go=messages", tag: "handoff" });
      }
      if (type === "whatsapp_request" && prefs.on_whatsapp_request) {
        let name = "un produit";
        if (product_id) {
          const p = await query("SELECT name FROM products WHERE id = $1", [product_id]).catch(() => ({ rows: [] }));
          if (p.rows[0]) name = p.rows[0].name;
        }
        notifyAdmins({ title: "Nouvelle demande WhatsApp", body: `Un visiteur vous écrit au sujet de : ${name}.`, url: "/admin", tag: "whatsapp" });
      }
    }
  } catch (err) {
    next(err);
  }
}

export async function getStats(req, res, next) {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);

    const totals = await query(
      `SELECT type, COUNT(*)::int AS count
       FROM events
       WHERE created_at >= now() - ($1::int * interval '1 day')
       GROUP BY type`,
      [days]
    );

    const previous = await query(
      `SELECT type, COUNT(*)::int AS count
       FROM events
       WHERE created_at >= now() - ($1::int * 2 * interval '1 day')
         AND created_at < now() - ($1::int * interval '1 day')
       GROUP BY type`,
      [days]
    );

    const top = await query(
      `SELECT p.id, p.name, p.image_url, p.category_id,
              COUNT(*) FILTER (WHERE e.type = 'whatsapp_request')::int AS requests,
              COUNT(*) FILTER (WHERE e.type = 'product_view')::int AS views
       FROM events e
       JOIN products p ON p.id = e.product_id AND p.deleted_at IS NULL
       WHERE e.created_at >= now() - ($1::int * interval '1 day')
       GROUP BY p.id
       HAVING COUNT(*) FILTER (WHERE e.type IN ('whatsapp_request','product_view')) > 0
       ORDER BY requests DESC, views DESC
       LIMIT 5`,
      [days]
    );

    const daily = await query(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
              COALESCE(COUNT(e.id) FILTER (WHERE e.type = 'whatsapp_request'), 0)::int AS requests
       FROM generate_series(current_date - ($1::int - 1), current_date, interval '1 day') d
       LEFT JOIN events e ON e.created_at::date = d::date
       GROUP BY d
       ORDER BY d`,
      [Math.min(days, 30)]
    );

    const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.type, r.count]));
    res.json({
      data: {
        days,
        totals: toMap(totals.rows),
        previous: toMap(previous.rows),
        top_products: top.rows,
        daily: daily.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}
