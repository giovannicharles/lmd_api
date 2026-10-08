-- LaMaison Dany — Disponibilite produit

ALTER TABLE products ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT true;
