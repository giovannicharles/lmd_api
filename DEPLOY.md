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

Pour votre site actuel (`https://la-maison-dany.vercel.app`), sans `/` final :

```
CORS_ORIGIN=https://la-maison-dany.vercel.app
FRONTEND_URL=https://la-maison-dany.vercel.app
PUBLIC_SITE_URL=https://la-maison-dany.vercel.app
```

Redéployez l'API après avoir modifié ces variables. Quand vous aurez un nom de domaine, remplacez ces trois valeurs par le domaine définitif.

4. **Commande de démarrage** : dans Render > **Settings > Build & Deploy > Start Command**, mettez `npm run start:prod` (et non `node src/server.js`). C'est elle qui crée les tables de la base au démarrage. Les journaux doivent alors afficher `OK 001_init.sql`, `OK 002_...`, etc.
5. Vérifiez `https://VOTRE-API.onrender.com/health` : la réponse est `{"status":"ok"...}`. Puis `https://VOTRE-API.onrender.com/api/categories` : la réponse doit être `{"data":[...]}` et non une erreur 500 (une erreur 500 veut presque toujours dire que les tables n'existent pas : voir « Créer les tables depuis votre ordinateur » ci-dessous).

### Créer les tables depuis votre ordinateur

L'onglet **Shell** de Render est réservé aux offres payantes. Sur l'offre gratuite, lancez les commandes depuis votre ordinateur, vers la base Neon. Dans PowerShell, dans le dossier `lmd_api` :

```powershell
$env:DATABASE_URL = "postgresql://...votre-chaine-neon..."
$env:DATABASE_SSL = "true"
npm run db:migrate
```

Les commandes `npm run admin:create` et `npm run images:migrate` s'utilisent de la même façon (voir plus bas). Fermez ensuite la fenêtre PowerShell : ces variables ne sont valables que pour elle, et votre `.env` local reste inchangé.

## 4. Votre accès admin

Depuis votre ordinateur, comme ci-dessus (même fenêtre PowerShell, avec `DATABASE_URL` pointant vers Neon) :

```powershell
npm run admin:create -- 237690000000 "UnMotDePasseLong" Dany
```

(Avec un Shell Render payant, la même commande s'y lance directement.) Connexion ensuite sur `https://VOTRE-SITE/admin` avec ce numéro. Dans **Contenu du site > Général**, vérifiez le numéro WhatsApp, la devise et les réseaux sociaux.

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
