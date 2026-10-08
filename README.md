# lmd_api — Backend LaMaison Dany

API REST (Node.js + Express + PostgreSQL + Cloudinary) pour le site vitrine
et le CMS admin de **LaMaison Dany** (parfums, cosmétiques, vins & plus).

## Stack

- **Runtime** : Node.js >= 20 (ESM)
- **Framework** : Express
- **Base de données** : PostgreSQL
- **Stockage médias** : Cloudinary
- **Rechargement à chaud** : `node --watch` (Node 20+)

## Démarrage

```bash
cp .env.example .env   # puis renseigner les valeurs
npm install
npm run dev            # http://localhost:4000
```

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Démarrage en développement (hot reload) |
| `npm start` | Démarrage simple |
| `npm run start:prod` | Production : applique les migrations puis démarre (sert aussi le site compilé) |
| `npm run admin:create -- <tel> <mot_de_passe> [nom]` | Créer ou réinitialiser un accès admin |
| `npm run images:migrate` | Envoyer les photos locales vers Cloudinary (`-- --dry-run` pour simuler) |
| `npm run db:migrate` | Appliquer les migrations |
| `npm run db:seed` | Insérer des données de démonstration |
| `npm run lint` | Vérification de syntaxe |

## Structure

```
src/
├── server.js          # Point d'entrée Express
├── config/            # Config (db, cloudinary, env)
├── db/                # Pool PostgreSQL + migrations
├── middleware/        # errors, auth, upload...
├── routes/            # Routeurs Express par ressource
├── controllers/       # Logique métier
├── services/          # Cloudinary, etc.
└── scripts/           # migrate.js, seed.js
```

## Périmètre V1

Voir `../AGENTS.md` à la racine du monorepo.
