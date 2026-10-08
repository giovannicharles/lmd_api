import { query } from "../config/db.js";
import { absolute, isoCurrency, loadSiteSettings, shareImage, truncate } from "./site.js";

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const jsonForHtml = (data) => JSON.stringify(data).replace(/</g, "\\u003c");

function organizationLd(site, origin) {
  const g = site.general;
  const sameAs = [g.instagram, g.facebook, g.tiktok].filter(Boolean);
  return [
    {
      "@context": "https://schema.org",
      "@type": "Store",
      name: g.brand,
      url: origin,
      logo: `${origin}/icon-512.png`,
      image: shareImage(site.seo.og_image_url || "/og-default.png", origin),
      description: site.seo.description,
      ...(g.phone ? { telephone: g.phone } : {}),
      ...(g.email ? { email: g.email } : {}),
      ...(g.address ? { address: { "@type": "PostalAddress", streetAddress: g.address } } : {}),
      ...(g.opening_hours ? { openingHours: g.opening_hours } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: g.brand, url: origin, inLanguage: "fr" },
  ];
}

function productLd(p, site, origin) {
  const photos = [p.image_url, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean);
  const url = `${origin}/produit/${p.slug}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      url,
      ...(photos.length ? { image: photos.map((x) => absolute(x, origin)) } : {}),
      ...(p.description ? { description: p.description } : {}),
      ...(p.category_name ? { category: p.category_name } : {}),
      sku: String(p.id),
      ...(p.price != null
        ? {
            offers: {
              "@type": "Offer",
              url,
              priceCurrency: isoCurrency(site.general.currency),
              price: String(Number(p.price)),
              availability: p.available === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
              itemCondition: "https://schema.org/NewCondition",
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: origin + "/" },
        { "@type": "ListItem", position: 2, name: "Boutique", item: origin + "/catalogue" },
        ...(p.category_name
          ? [{ "@type": "ListItem", position: 3, name: p.category_name, item: `${origin}/catalogue?categorie=${p.category_slug}` }]
          : []),
        { "@type": "ListItem", position: p.category_name ? 4 : 3, name: p.name, item: url },
      ],
    },
  ];
}

export async function metaFor(pathname, searchParams, origin) {
  const site = await loadSiteSettings();
  const brand = site.general.brand;
  const base = {
    status: 200,
    noindex: false,
    type: "website",
    title: site.seo.title,
    description: site.seo.description,
    image: shareImage(site.seo.og_image_url || "/og-default.png", origin),
    canonical: origin + "/",
    ld: [],
  };
  const withBrand = (t) => `${t} | ${brand}`;

  if (pathname === "/" || pathname === "") {
    return { ...base, ld: organizationLd(site, origin) };
  }

  if (pathname === "/catalogue") {
    const slug = searchParams.get("categorie");
    if (slug) {
      const { rows } = await query("SELECT name, slug FROM categories WHERE slug = $1", [slug]);
      if (rows[0]) {
        return {
          ...base,
          title: withBrand(`${rows[0].name} : la boutique`),
          description: `Découvrez notre sélection ${rows[0].name.toLowerCase()} chez ${brand}. Un clic, et la conversation WhatsApp s'ouvre.`,
          canonical: `${origin}/catalogue?categorie=${rows[0].slug}`,
        };
      }
    }
    return {
      ...base,
      title: withBrand("La boutique"),
      description: `Parfums, cosmétiques, vins et plus encore. Parcourez la boutique ${brand} et commandez sur WhatsApp.`,
      canonical: origin + "/catalogue",
    };
  }

  if (pathname === "/a-propos") {
    let about = site.seo.description;
    try {
      const { rows } = await query("SELECT content FROM pages WHERE slug = 'about'");
      if (rows[0]?.content) about = rows[0].content;
    } catch {
      /* keep default */
    }
    return { ...base, title: withBrand("À propos"), description: about, canonical: origin + "/a-propos" };
  }

  if (pathname === "/contact") {
    return {
      ...base,
      title: withBrand("Contact"),
      description: "Une question, un conseil, une commande ? Écrivez-nous sur WhatsApp ou laissez un message : nous vous répondons très vite.",
      canonical: origin + "/contact",
    };
  }

  const product = pathname.match(/^\/produit\/([^/]+)\/?$/);
  if (product) {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.slug = $1`,
      [decodeURIComponent(product[1])]
    );
    const p = rows[0];
    if (!p) {
      return { ...base, status: 404, noindex: true, title: withBrand("Produit introuvable"), canonical: origin + pathname };
    }
    return {
      ...base,
      type: "product",
      title: withBrand(p.name),
      description: p.description || `${p.name} chez ${brand}. Commandez simplement sur WhatsApp.`,
      image: p.image_url ? shareImage(p.image_url, origin) : base.image,
      canonical: `${origin}/produit/${p.slug}`,
      ld: productLd(p, site, origin),
    };
  }

  if (pathname.startsWith("/admin")) {
    return { ...base, noindex: true, title: withBrand("Administration"), canonical: origin + "/admin" };
  }

  return { ...base, canonical: origin + "/" };
}

export function renderSeoBlock(meta, site) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(truncate(meta.description));
  const image = escapeHtml(meta.image);
  const url = escapeHtml(meta.canonical);
  const brand = escapeHtml(site.general.brand);
  const lines = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${meta.type === "product" ? "product" : "website"}" />`,
    `<meta property="og:site_name" content="${brand}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    ...meta.ld.map((block) => `<script type="application/ld+json" data-seo-ld>${jsonForHtml(block)}</script>`),
  ];
  return lines.map((l) => `    ${l}`).join("\n");
}

export { loadSiteSettings };
