import { z } from "zod";
import { query } from "../config/db.js";

const short = z.string().trim().max(200);
const long = z.string().trim().max(2000);

const settingsSchema = z
  .object({
    general: z.object({
      brand: short,
      currency: short,
      tagline: short,
      whatsapp_number: z
        .string()
        .trim()
        .regex(/^(\d{6,15})?$/, "Numero au format international, chiffres uniquement"),
      whatsapp_message: long,
      product_message: long,
      email: short,
      phone: short,
      address: short,
      instagram: short,
      facebook: short,
      tiktok: short,
      opening_hours: short,
    }),
    texts: z.record(z.string().max(60), long).refine((o) => Object.keys(o).length <= 80, "Trop de textes"),
    seo: z.object({
      title: short,
      description: long,
      og_image_url: z.string().trim().max(500),
    }),
    hero: z.object({
      line1: short,
      line2: short,
      accent: short,
      text: long,
      cta_primary: short,
      cta_secondary: short,
      badge_title: short,
      badge_text: short,
      image_url: z.string().trim().max(500),
    }),
    reassurance: z
      .array(z.object({ icon: short, title: short, text: short }))
      .max(8),
    about_home: z.object({ line1: short, line2: short, accent: short, text: long, cta: short }),
    banner: z.object({ line1: short, accent: short, text: long, cta: short }),
    how_to_order: z.array(z.object({ title: short, text: long })).max(6),
    faq: z.array(z.object({ q: short, a: long })).max(30),
    values: z.array(z.object({ title: short, desc: long })).max(6),
    order_dialog: z.object({
      intro: long,
      quick_messages: z.array(short).max(8),
    }),
    chatbot: z.object({
      enabled: z.boolean(),
      name: short,
      welcome: long,
      fallback: long,
      quick_replies: z.array(z.object({ label: short, answer: long })).max(12),
    }),
  })
  .partial();

export async function getSettings(_req, res, next) {
  try {
    const { rows } = await query("SELECT key, value FROM site_settings");
    const data = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const parsed = settingsSchema.strict().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const entries = Object.entries(parsed.data);
    for (const [key, value] of entries) {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
        [key, JSON.stringify(value)]
      );
    }

    const { rows } = await query("SELECT key, value FROM site_settings");
    res.json({ data: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  } catch (err) {
    next(err);
  }
}
