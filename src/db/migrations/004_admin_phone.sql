-- LaMaison Dany — Connexion admin par numero de telephone

ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE admins ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_phone ON admins(phone) WHERE phone IS NOT NULL;
