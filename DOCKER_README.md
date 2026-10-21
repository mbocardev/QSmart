# Q-Smart — Setup Docker

Ce dossier contient tous les fichiers Docker pour lancer **Q-Smart** sur **Node 20 LTS**
sans toucher à ton installation Node locale.

---

## Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et lancé

---

## 1. Préparation

**Copier les fichiers Docker dans ton projet Q-Smart :**

```
C:\Projects\qsmart\
├── Dockerfile          ← copier ici
├── Dockerfile.dev      ← copier ici
├── docker-compose.yml  ← copier ici
├── docker-compose.dev.yml ← copier ici
├── .dockerignore       ← copier ici
├── .env.example        ← copier ici
├── src/
├── static/
└── ...
```

**Créer ton fichier `.env` :**

```bash
copy .env.example .env
```

Puis remplir `.env` avec tes vraies clés Supabase et VAPID.

---

## 2. Mode Développement (hot-reload)

Lance le serveur de dev avec rechargement automatique :

```bash
docker compose -f docker-compose.dev.yml up --build
```

→ App disponible sur **http://localhost:5173**

Les modifications dans `src/` sont prises en compte instantanément.

Pour arrêter :
```bash
docker compose -f docker-compose.dev.yml down
```

---

## 3. Mode Production

Build et lance la version optimisée :

```bash
docker compose up --build
```

→ App disponible sur **http://localhost:3000**

Pour lancer en arrière-plan :
```bash
docker compose up --build -d
```

Pour voir les logs :
```bash
docker compose logs -f
```

Pour arrêter :
```bash
docker compose down
```

---

## 4. Commandes utiles

| Commande | Description |
|----------|-------------|
| `docker compose up --build` | Build + lancer en prod |
| `docker compose -f docker-compose.dev.yml up --build` | Build + lancer en dev |
| `docker compose down` | Arrêter les containers |
| `docker compose logs -f` | Voir les logs en temps réel |
| `docker exec -it qsmart sh` | Terminal dans le container prod |
| `docker exec -it qsmart-dev sh` | Terminal dans le container dev |

---

## Pourquoi Docker résout le problème ?

Node.js v24 (installé sur ton PC) est incompatible avec SvelteKit 2.x.
Le container Docker utilise **Node 20 LTS** — la version stable recommandée.
Ton Node.js local n'est pas modifié.

---

## Schéma Supabase

Avant de lancer l'app, exécuter le schéma SQL dans **Supabase SQL Editor** :

```
supabase/migrations/001_schema.sql
```

---

*Q-Smart — Fait pour les commerces dakarois, conçu pour le rush du vendredi.*
