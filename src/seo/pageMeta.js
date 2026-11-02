import { query } from "../config/db.js";
import { absolute, fillTemplate, isoCurrency, loadSiteSettings, shareImage, truncate } from "./site.js";

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
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: g.brand,
      url: origin,
      inLanguage: "fr",
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${origin}/catalogue?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
    ...(site.faq.length
      ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: site.faq.slice(0, 10).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }]
      : []),
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
  const withBrand = (t) => (`${t} | ${brand}`.length <= 62 ? `${t} | ${brand}` : t);
  const T = site.texts;
  const vars = { brand };
  const crumbs = (items) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
  });

  if (pathname === "/" || pathname === "") {
    return { ...base, ld: organizationLd(site, origin) };
  }

  if (pathname === "/catalogue") {
    const slug = searchParams.get("categorie");
    const search = (searchParams.get("q") || "").trim();
    if (search) {
      return { ...base, noindex: true, title: withBrand(fillTemplate(T.seo_shop_title, vars)), description: fillTemplate(T.seo_shop_description, vars), canonical: origin + "/catalogue" };
    }
    if (slug) {
      const { rows } = await query("SELECT name, slug FROM categories WHERE slug = $1 AND deleted_at IS NULL", [slug]);
      if (rows[0]) {
        const v = { ...vars, category: rows[0].name };
        return {
          ...base,
          title: withBrand(fillTemplate(T.seo_category_title, v)),
          description: fillTemplate(T.seo_category_description, v),
          canonical: `${origin}/catalogue?categorie=${rows[0].slug}`,
          ld: [crumbs([["Accueil", origin + "/"], ["Boutique", origin + "/catalogue"], [rows[0].name, `${origin}/catalogue?categorie=${rows[0].slug}`]])],
        };
      }
    }
    return {
      ...base,
      title: withBrand(fillTemplate(T.seo_shop_title, vars)),
      description: fillTemplate(T.seo_shop_description, vars),
      canonical: origin + "/catalogue",
      ld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: fillTemplate(T.seo_shop_title, vars), url: origin + "/catalogue", inLanguage: "fr" }, crumbs([["Accueil", origin + "/"], ["Boutique", origin + "/catalogue"]])],
    };
  }

  if (pathname === "/a-propos") {
    let about = fillTemplate(T.seo_about_description, vars);
    try {
      const { rows } = await query("SELECT content FROM pages WHERE slug = 'about' AND deleted_at IS NULL");
      if (rows[0]?.content) about = rows[0].content;
    } catch {
      /* keep default */
    }
    return { ...base, title: withBrand(fillTemplate(T.seo_about_title, vars)), description: about, canonical: origin + "/a-propos", ld: [crumbs([["Accueil", origin + "/"], ["À propos", origin + "/a-propos"]])] };
  }

  if (pathname === "/contact") {
    return {
      ...base,
      title: withBrand(fillTemplate(T.seo_contact_title, vars)),
      description: fillTemplate(T.seo_contact_description, vars),
      canonical: origin + "/contact",
      ld: [{ "@context": "https://schema.org", "@type": "ContactPage", name: fillTemplate(T.seo_contact_title, vars), url: origin + "/contact", inLanguage: "fr" }, crumbs([["Accueil", origin + "/"], ["Contact", origin + "/contact"]])],
    };
  }

  const product = pathname.match(/^\/produit\/([^/]+)\/?$/);
  if (product) {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
       WHERE p.slug = $1 AND p.deleted_at IS NULL`,
      [decodeURIComponent(product[1])]
    );
    const p = rows[0];
    if (!p) {
      return { ...base, status: 404, noindex: true, title: withBrand(fillTemplate(T.seo_notfound_title, vars)), canonical: origin + pathname };
    }
    return {
      ...base,
      type: "product",
      title: withBrand(fillTemplate(T.seo_product_title, { ...vars, name: p.name, category: p.category_name || "" })),
      description: p.description ? truncate(p.description) : fillTemplate(T.seo_product_description, { ...vars, name: p.name, category: p.category_name || "" }),
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
  const noDash = (t) => String(t ?? "").replace(/\s*[—–]\s*/g, ", ");
  const title = escapeHtml(noDash(meta.title));
  const description = escapeHtml(truncate(noDash(meta.description)));
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
