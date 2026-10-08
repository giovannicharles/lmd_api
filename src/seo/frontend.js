import fs from "node:fs";
import path from "node:path";
import express from "express";
import { env } from "../config/env.js";
import { query } from "../config/db.js";
import { frontendAvailable, frontendDist, loadSiteSettings, originFor, absolute } from "./site.js";
import { metaFor, renderSeoBlock } from "./pageMeta.js";

const xmlEscape = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

let localCache = { mtime: 0, html: "" };
function readLocalTemplate() {
  const file = path.join(frontendDist, "index.html");
  const mtime = fs.statSync(file).mtimeMs;
  if (localCache.mtime !== mtime) localCache = { mtime, html: fs.readFileSync(file, "utf8") };
  return localCache.html;
}

let remoteCache = { at: 0, html: "" };
/** index.html du site : build local (un seul service) ou site distant (FRONTEND_URL). */
async function getTemplate() {
  if (frontendAvailable()) return readLocalTemplate();
  if (!env.frontendUrl) {
    throw Object.assign(new Error("FRONTEND_URL n'est pas configure"), { status: 503 });
  }
  if (remoteCache.html && Date.now() - remoteCache.at < 60_000) return remoteCache.html;
  try {
    const res = await fetch(`${env.frontendUrl}/index.html`, { headers: { accept: "text/html" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes("<!--seo:start-->")) throw new Error("index.html sans marqueurs seo");
    remoteCache = { at: Date.now(), html };
    return html;
  } catch (err) {
    if (remoteCache.html) return remoteCache.html;
    throw Object.assign(new Error(`Site indisponible : ${err.message}`), { status: 502 });
  }
}

async function renderPage(req, pathname) {
  const origin = originFor(req);
  const meta = await metaFor(pathname.replace(/\/+$/, "") || "/", new URL(req.originalUrl, "http://x").searchParams, origin);
  const site = await loadSiteSettings();
  const template = await getTemplate();
  const html = template.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, renderSeoBlock(meta, site));
  return { html, status: meta.status };
}

/** robots.txt, sitemap.xml et /page/* (pages du site avec leurs balises SEO) : toujours actifs. */
export function mountSeoRoutes(app) {
  app.get("/robots.txt", (req, res) => {
    const origin = originFor(req);
    res.type("text/plain").send(
      ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api/", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n")
    );
  });

  app.get("/sitemap.xml", async (req, res, next) => {
    try {
      const origin = originFor(req);
      const [products, categories] = await Promise.all([
        query("SELECT slug, name, image_url, images, updated_at FROM products ORDER BY sort_order ASC, id ASC"),
        query("SELECT slug FROM categories c WHERE EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id) ORDER BY sort_order ASC"),
      ]);
      const urls = [
        { loc: `${origin}/`, priority: "1.0" },
        { loc: `${origin}/catalogue`, priority: "0.9" },
        ...categories.rows.map((c) => ({ loc: `${origin}/catalogue?categorie=${c.slug}`, priority: "0.8" })),
        { loc: `${origin}/a-propos`, priority: "0.5" },
        { loc: `${origin}/contact`, priority: "0.5" },
        ...products.rows.map((p) => ({
          loc: `${origin}/produit/${p.slug}`,
          lastmod: new Date(p.updated_at).toISOString().slice(0, 10),
          priority: "0.7",
          images: [p.image_url, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean).map((u) => absolute(u, origin)),
          title: p.name,
        })),
      ];
      const body = urls
        .map(
          (u) =>
            `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>` +
            (u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : "") +
            `\n    <priority>${u.priority}</priority>` +
            (u.images ?? []).map((img) => `\n    <image:image><image:loc>${xmlEscape(img)}</image:loc>${u.title ? `<image:title>${xmlEscape(u.title)}</image:title>` : ""}</image:image>`).join("") +
            "\n  </url>"
        )
        .join("\n");
      res
        .type("application/xml")
        .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`);
    } catch (err) {
      next(err);
    }
  });

  // Utilisé quand le site est hébergé à part : l'hébergeur du site redirige (proxy) /produit/*, /catalogue...
  // vers /page/produit/*, /page/catalogue... et affiche la réponse sous sa propre adresse.
  app.get(/^\/page(\/.*)?$/, async (req, res, next) => {
    try {
      const { html, status } = await renderPage(req, req.path.replace(/^\/page/, "") || "/");
      // Le document est affiché sur le domaine du site : la politique de sécurité de l'API ne doit pas s'y appliquer.
      res.removeHeader("Content-Security-Policy");
      res.status(status).set("Cache-Control", "public, max-age=0, s-maxage=60, must-revalidate").type("html").send(html);
    } catch (err) {
      next(err);
    }
  });
}

/** Mode « un seul service » : l'API sert aussi le site compilé. */
export function mountFrontend(app) {
  if (!frontendAvailable()) {
    console.log("  API seule : le site est hébergé séparément (FRONTEND_URL)");
    return false;
  }

  app.use(
    express.static(frontendDist, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "public, max-age=86400");
        }
      },
    })
  );

  app.use(async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/") || req.path === "/health") return next();
    if (path.extname(req.path)) return next();
    try {
      const { html, status } = await renderPage(req, req.path);
      res.status(status).set("Cache-Control", "no-cache").type("html").send(html);
    } catch (err) {
      next(err);
    }
  });

  console.log(`  Site servi depuis ${frontendDist}`);
  return true;
}
