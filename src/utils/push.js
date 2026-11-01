import webpush from "web-push";
import { query } from "../config/db.js";

const publicKey = () => process.env.VAPID_PUBLIC_KEY || "";
const privateKey = () => process.env.VAPID_PRIVATE_KEY || "";

let ready = false;

export const pushEnabled = () => Boolean(publicKey() && privateKey());
export const vapidPublicKey = publicKey;

function init() {
  if (ready) return true;
  if (!pushEnabled()) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://la-maison-dany.vercel.app", publicKey(), privateKey());
  ready = true;
  return true;
}

export async function sendPush(subscriptions, payload) {
  let sent = 0;
  let failed = 0;
  if (!init()) return { sent, failed: subscriptions.length };
  const body = JSON.stringify(payload);
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 86400, timeout: 10000 });
        sent += 1;
        await query("UPDATE push_subscriptions SET last_used_at = now() WHERE id = $1", [s.id]);
      } catch (err) {
        failed += 1;
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await query("UPDATE push_subscriptions SET deleted_at = now() WHERE id = $1", [s.id]).catch(() => {});
        }
      }
    })
  );
  return { sent, failed };
}

export async function notifyAdmins(payload) {
  try {
    if (!pushEnabled()) return;
    const { rows } = await query("SELECT * FROM push_subscriptions WHERE audience = 'admin' AND deleted_at IS NULL");
    if (rows.length) await sendPush(rows, payload);
  } catch (err) {
    console.error("notifyAdmins:", err.message);
  }
}

const DEFAULTS = { on_message: true, on_handoff: true, on_whatsapp_request: false };

export async function notificationPrefs() {
  try {
    const { rows } = await query("SELECT value FROM site_settings WHERE key = 'notifications'");
    return { ...DEFAULTS, ...(rows[0]?.value || {}) };
  } catch {
    return DEFAULTS;
  }
}
