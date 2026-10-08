# Mise en ligne de l'API (Render)

Ce dépôt contient l'API et l'admin. Le site public est dans un autre dépôt (`LaMaisonDany`), hébergé à part : voir son `DEPLOY.md`.

Ordre conseillé : **1. Neon, 2. Cloudinary, 3. API sur Render, 4. site (autre dépôt), 5. réglages finaux.**

## 1. Base de données (Neon)

1. Créez un projet sur <https://neon.tech>.
2. Copiez la chaîne de connexion (`postgresql://...?sslmode=require`). C'est `DATABASE_URL`.

## 2. Photos (Cloudinary)

Sur <https://cloudinary.com>, relevez `Cloud name`, `API Key` et `API Secret` (tableau de bord). **Sans Cloudinary, les photos envoyées depuis l'admin disparaissent** à chaque redémarrage de Render (le disque est temporaire).

## 3. API sur Render

1. Poussez ce dépôt sur GitHub (`.env` et `uploads/` ne partent pas : ils sont ignorés).
2. Render > **New** > **Blueprint**, choisissez le dépôt : `render.yaml` crée le service.
   (Sans Blueprint : **New > Web Service**, Runtime *Node*, Build `npm ci`, Start `npm run start:prod`, Health check `/health`.)
3. Renseignez les variables :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | Chaîne Neon |
| `DATABASE_SSL` | `true` |
| `JWT_SECRET` | Générée par Render (32 caractères minimum exigés) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Valeurs Cloudinary |
| `CORS_ORIGIN` | Adresse du site (ex. `https://lamaisondany.netlify.app`) |
| `FRONTEND_URL` | Adresse du site, sans `/` final |
| `PUBLIC_SITE_URL` | Adresse publique du site (votre domaine définitif quand il existe) |

Les trois dernières peuvent être renseignées après l'étape 4, quand l'adresse du site existe. Redéployez ensuite.

4. Au démarrage, les migrations de la base s'appliquent toutes seules (`npm run start:prod`).
5. Vérifiez `https://VOTRE-API.onrender.com/health` : la réponse est `{"status":"ok"...}`.

## 4. Votre accès admin

Dans l'onglet **Shell** du service Render :

```bash
npm run admin:create -- 237690000000 "UnMotDePasseLong" Dany
```

Connexion ensuite sur `https://VOTRE-SITE/admin` avec ce numéro. Dans **Contenu du site > Général**, vérifiez le numéro WhatsApp, la devise et les réseaux sociaux.

## 5. Reprendre les produits saisis en local

```bash
# 1. Exporter la base locale
pg_dump -Fc -d lmd_db > lmd.dump

# 2. L'importer dans Neon
pg_restore --no-owner --clean --if-exists -d "postgresql://...neon..." lmd.dump
```

Puis envoyer les photos locales vers Cloudinary et mettre la base distante à jour. Dans ce dépôt, avec un `.env` qui pointe vers Neon **et** vos identifiants Cloudinary, et le dossier `uploads/` local :

```bash
npm run images:migrate -- --dry-run   # simulation
npm run images:migrate                # envoi réel
```

Ou repartez de zéro en saisissant les produits dans l'admin en ligne.

## 6. Éviter la mise en veille (offre gratuite)

Render met un service gratuit en veille après 15 minutes sans visite : la visite suivante attend environ une minute. Deux solutions : l'offre payante (environ 7 $/mois), ou un contrôle gratuit toutes les 5 minutes sur `https://VOTRE-API.onrender.com/health` avec <https://uptimerobot.com>. C'est important ici : les liens produits partagés sur WhatsApp passent par l'API pour afficher leur aperçu.

## 7. Après la mise en ligne

- `https://VOTRE-SITE/sitemap.xml` doit lister vos produits (sinon `PUBLIC_SITE_URL` est mal réglée).
- Envoyez-vous un lien produit sur WhatsApp : la photo, le nom et la description doivent s'afficher.
- Déclarez le sitemap dans Google Search Console.
- Changez votre mot de passe dans **Mon compte** si vous avez utilisé un mot de passe provisoire.
- Activez les sauvegardes chez Neon.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `NODE_ENV` | `production` en ligne |
| `PORT` | Fourni par Render |
| `DATABASE_URL`, `DATABASE_SSL` | PostgreSQL (`DATABASE_SSL=true` pour une base distante) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Connexions admin (secret de 32 caractères minimum en production) |
| `CORS_ORIGIN` | Origines autorisées à appeler l'API, séparées par des virgules |
| `FRONTEND_URL` | Adresse du site : l'API s'en sert pour fabriquer les pages produit avec leur aperçu |
| `PUBLIC_SITE_URL` | Adresse publique du site (sitemap, liens canoniques) |
| `CLOUDINARY_*` | Stockage des photos |
| `FRONTEND_DIST` | Seulement pour servir un site compilé depuis l'API (hébergement en un seul service) |
| `PUBLIC_URL` | Seulement pour des photos stockées localement, sans Cloudinary |
