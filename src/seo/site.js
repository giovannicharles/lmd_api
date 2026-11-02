import fs from "node:fs";
import path from "node:path";
import { query } from "../config/db.js";
import { env } from "../config/env.js";

export const SEO_TEXT_DEFAULTS = {
  seo_shop_title: "Parfums, cosmétiques et vins",
  seo_shop_description: "Parcourez les parfums, cosmétiques et vins de {brand}. Prix, disponibilité et conseils : nous vous répondons sur WhatsApp.",
  seo_category_title: "{category}, à commander sur WhatsApp",
  seo_category_description: "Notre sélection {category} chez {brand}. Choisissez un produit, nous confirmons le prix et la disponibilité sur WhatsApp.",
  seo_about_title: "Notre histoire et nos valeurs",
  seo_about_description: "Découvrez {brand} : comment nous choisissons nos produits et accompagnons chaque client, du premier message à la remise.",
  seo_contact_title: "Contact et commandes sur WhatsApp",
  seo_contact_description: "Une question, un conseil, une commande ? Écrivez-nous sur WhatsApp ou laissez un message à {brand}, nous répondons vite.",
  seo_product_title: "{name} : {category}",
  seo_product_description: "{name} chez {brand}. Demandez le prix, la disponibilité et nos conseils directement sur WhatsApp.",
  seo_notfound_title: "Page introuvable",
};

export function fillTemplate(template, vars) {
  let out = String(template || "");
  for (const [k, v] of Object.entries(vars)) out = out.split("{" + k + "}").join(v ?? "");
  return out
    .replace(/\s*[:,]\s*(?=\s*($|\|))/g, "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const DEFAULTS = {
  texts: { ...SEO_TEXT_DEFAULTS },
  faq: [],
  general: { brand: "LaMaison Dany", currency: "FCFA", tagline: "Parfums, cosmétiques, vins & plus", phone: "", email: "", address: "", opening_hours: "", instagram: "", facebook: "", tiktok: "" },
  seo: {
    title: "LaMaison Dany : parfums, cosmétiques, vins et plus encore",
    description: "Parfums, cosmétiques, vins et bien plus. Choisissez un produit, écrivez-nous sur WhatsApp : nous nous occupons du reste.",
    og_image_url: "",
  },
};

export const frontendDist = path.resolve(process.cwd(), env.frontendDist || "../lamaison-dany/dist");
export const frontendAvailable = () => fs.existsSync(path.join(frontendDist, "index.html"));

export async function loadSiteSettings() {
  const out = structuredClone(DEFAULTS);
  try {
    const { rows } = await query("SELECT key, value FROM site_settings WHERE key IN ('general', 'seo', 'texts', 'faq', 'about_home')");
    for (const row of rows) {
      if (row.key === "about_home") continue;
      if (row.key === "faq") {
        if (Array.isArray(row.value)) out.faq = row.value.filter((f) => f && f.q && f.a);
        continue;
      }
      if (row.key === "texts") {
        for (const [k, v] of Object.entries(row.value || {})) if (k.startsWith("seo_") && typeof v === "string" && v.trim()) out.texts[k] = v;
        continue;
      }
      for (const [k, v] of Object.entries(row.value || {})) {
        if (typeof v === "string" && v.trim() === "" && out[row.key]?.[k]) continue;
        if (out[row.key]) out[row.key][k] = v;
      }
    }
  } catch {
    /* database unavailable: fall back to defaults so pages still render */
  }
  return out;
}

export function originFor(req) {
  if (env.publicSiteUrl) return env.publicSiteUrl;
  if (env.frontendUrl) return env.frontendUrl;
  return `${req.protocol}://${req.get("host")}`;
}

export function isoCurrency(label) {
  const t = String(label || "").trim().toLowerCase();
  if (/fcfa|f cfa|cfa|xaf/.test(t)) return "XAF";
  if (/xof/.test(t)) return "XOF";
  if (/gdes|gourde|htg/.test(t)) return "HTG";
  if (/eur|€/.test(t)) return "EUR";
  if (/usd|\$/.test(t)) return "USD";
  return "XAF";
}

export function truncate(text, max = 155) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

export const absolute = (value, origin) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return origin + (value.startsWith("/") ? value : `/${value}`);
};

export function shareImage(url, origin) {
  const abs = absolute(url, origin);
  if (abs.includes("res.cloudinary.com") && abs.includes("/upload/") && !/\/upload\/[^/]*(f_auto|w_\d+)/.test(abs)) {
    return abs.replace("/upload/", "/upload/f_auto,q_auto,c_limit,w_1200/");
  }
  return abs;
}
