-- LaMaison Dany — Galerie photos des produits (photos supplementaires, en plus de image_url)

ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
