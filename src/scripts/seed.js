import pool from "../config/db.js";

async function seed() {
  try {
    const categories = [
      { name: "Parfums Femme" },
      { name: "Parfums Homme" },
      { name: "Cosmetiques" },
      { name: "Soins du visage" },
      { name: "Soins du corps" },
      { name: "Vins" },
    ];

    for (const cat of categories) {
      const slug = cat.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      await pool.query(
        `INSERT INTO categories (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (slug) DO NOTHING`,
        [cat.name, slug]
      );
    }
    console.log(`  OK    ${categories.length} categories`);

    const { rows: catRows } = await pool.query("SELECT id, slug FROM categories");
    const catMap = Object.fromEntries(catRows.map((r) => [r.slug, r.id]));

    const products = [
      {
        name: "Eau de Parfum Rose Royale",
        description: "Un bouquet floral elegant aux notes de rose de mai et de peonie.",
        price: 25000,
        categorySlug: "parfums-femme",
        featured: true,
      },
      {
        name: "Eau de Toilette Oud Noir",
        description: "Bois precieux et ambre pour une signature masculine affirmee.",
        price: 30000,
        categorySlug: "parfums-homme",
        featured: true,
      },
      {
        name: "Serum Eclat Or",
        description: "Serum visage illuminateur a l'acide hyaluronique et vitamine C.",
        price: 15000,
        categorySlug: "soins-du-visage",
        featured: true,
      },
      {
        name: "Creme Hydratante Karite",
        description: "Hydratation intense au beurre de karite bio pour peaux seches.",
        price: 12000,
        categorySlug: "soins-du-corps",
        featured: false,
      },
      {
        name: "Rouge a Levres Velvet",
        description: "Fini velours longue tenue, disponible en 12 nuances.",
        price: 8000,
        categorySlug: "cosmetiques",
        featured: false,
      },
      {
        name: "Eau de Parfum Jasmin Imperial",
        description: "Sensualite florale au jasmin sambac et fleur d'oranger.",
        price: 28000,
        categorySlug: "parfums-femme",
        featured: false,
      },
      {
        name: "Noor Werr",
        description: "Un vin d'exception au caractere unique, fruit d'un savoir-faire viticole passionne. Noor Werr revele les arômes riches du terroir, avec des notes de fruits noirs et une finale elegante. Un vin de garde qui accompagne vos moments d'exception.",
        price: 50000,
        categorySlug: "vins",
        featured: true,
      },
    ];

    for (const p of products) {
      const slug = p.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      await pool.query(
        `INSERT INTO products (name, slug, description, price, category_id, featured)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (slug) DO NOTHING`,
        [p.name, slug, p.description, p.price, catMap[p.categorySlug] || null, p.featured]
      );
    }
    console.log(`  OK    ${products.length} products`);

    const pages = [
      {
        slug: "about",
        title: "A propos de LaMaison Dany",
        content:
          "LaMaison Dany est une maison de parfums, cosmetiques et vins premium, fondee avec la passion de la beaute et du bien-etre. Nos creations celebrent l'elegance et la sensorialite, pour reveler votre singularite. Du parfum qui raconte votre histoire au vin qui partage votre terroir, chaque produit est une invitation a l'art de vivre.",
      },
      {
        slug: "contact",
        title: "Contactez-nous",
        content:
          "Nous sommes disponibles sur WhatsApp pour toute question, conseil ou commande. N'hesitez pas a nous ecrire!",
      },
    ];

    for (const page of pages) {
      await pool.query(
        `INSERT INTO pages (slug, title, content)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO NOTHING`,
        [page.slug, page.title, page.content]
      );
    }
    console.log(`  OK    ${pages.length} pages`);

    console.log("Seed complete.");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
