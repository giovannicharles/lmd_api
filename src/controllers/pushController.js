import jwt from "jsonwebtoken";
import { z } from "zod";
import { query } from "../config/db.js";
import { env } from "../config/env.js";
import { pushEnabled, sendPush, vapidPublicKey } from "../utils/push.js";

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(5).max(200) }),
  }),
  audience: z.enum(["admin", "visitor"]).default("visitor"),
});

function adminFromToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice(7), env.jwtSecret);
  } catch {
    return null;
  }
}

export function getPublicKey(_req, res) {
  res.json({ data: { enabled: pushEnabled(), public_key: pushEnabled() ? vapidPublicKey() : "" } });
}

export async function subscribe(req, res, next) {
  try {
    if (!pushEnabled()) return res.status(503).json({ error: "Notifications indisponibles" });
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Abonnement invalide" });
    const { subscription, audience } = parsed.data;
    const admin = adminFromToken(req);
    if (audience === "admin" && !admin) return res.status(401).json({ error: "Connexion requise" });

    await query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, audience, admin_id, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (endpoint) DO UPDATE
         SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, audience = EXCLUDED.audience,
             admin_id = EXCLUDED.admin_id, user_agent = EXCLUDED.user_agent, deleted_at = NULL`,
      [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, audience, audience === "admin" ? admin.id : null, String(req.headers["user-agent"] || "").slice(0, 300)]
    );
    res.status(201).json({ data: { subscribed: true } });
  } catch (err) {
    next(err);
  }
}

export async function unsubscribe(req, res, next) {
  try {
    const endpoint = z.string().url().max(1000).safeParse(req.body?.endpoint);
    if (!endpoint.success) return res.status(400).json({ error: "Abonnement invalide" });
    await query("UPDATE push_subscriptions SET deleted_at = now() WHERE endpoint = $1 AND deleted_at IS NULL", [endpoint.data]);
    res.json({ data: { unsubscribed: true } });
  } catch (err) {
    next(err);
  }
}

export async function sendTest(req, res, next) {
  try {
    if (!pushEnabled()) return res.status(503).json({ error: "Notifications indisponibles" });
    const { rows } = await query("SELECT * FROM push_subscriptions WHERE audience = 'admin' AND admin_id = $1 AND deleted_at IS NULL", [req.admin.id]);
    if (!rows.length) return res.status(404).json({ error: "Aucun appareil enregistré" });
    const result = await sendPush(rows, { title: "LaMaison Dany", body: "Les notifications fonctionnent sur cet appareil.", url: "/admin", tag: "test" });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function pushStats(_req, res, next) {
  try {
    const { rows } = await query("SELECT audience, COUNT(*)::int AS n FROM push_subscriptions WHERE deleted_at IS NULL GROUP BY audience");
    const get = (a) => rows.find((r) => r.audience === a)?.n ?? 0;
    res.json({ data: { admins: get("admin"), visitors: get("visitor"), enabled: pushEnabled() } });
  } catch (err) {
    next(err);
  }
}
