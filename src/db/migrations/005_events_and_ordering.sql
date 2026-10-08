-- LaMaison Dany — Statistiques d'usage (sans donnees personnelles) et ordre des categories

ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Donne un ordre initial stable (alphabetique) aux categories existantes
UPDATE categories c
SET sort_order = r.rn
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn FROM categories) r
WHERE c.id = r.id AND c.sort_order = 0;

CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  type        TEXT NOT NULL,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_type_created ON events(type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_product ON events(product_id);
