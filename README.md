# Q-Smart — File d'attente intelligente

Application de gestion de file d'attente virtuelle pour commerces multi-tenants.
Stack : **SvelteKit + Supabase + Tailwind CSS** — déployable sur **Vercel** (gratuit).

---

## Architecture

```
Client (scan QR)  ──→  /queue/scan?t=TOKEN  ──→  API /api/scan  ──→  Supabase (RPC atomique)
                                                                              │
Kiosque           ←── Realtime (statut file, numéro en cours)  ←─────────────┤
Dashboard Gérant  ←── Realtime (tickets, statuts)              ←─────────────┘
```

### Sécurité anti-triche (QR Code TOTP)
Le QR code encode un jeton signé HMAC-SHA1 basé sur l'heure, valide **35 secondes** seulement.
Envoyer une photo du QR code par WhatsApp → jeton expiré → ticket refusé.

### Concurrence (rush de midi)
La fonction PostgreSQL `attribuer_ticket()` utilise `SELECT FOR UPDATE` pour garantir l'atomicité.
Deux scans à la même milliseconde → numéros N et N+1, sans doublon possible.

---

## Installation

### 1. Créer le projet Supabase

1. Créer un compte sur [supabase.com](https://supabase.com)
2. Nouveau projet → noter `URL` et les clés API
3. Aller dans **SQL Editor** → coller et exécuter `supabase/migrations/001_schema.sql`
4. Dans **Authentication → Settings** → activer Email provider

### 2. Configurer l'environnement

```bash
cp .env.example .env.local
```

Remplir `.env.local` avec vos clés Supabase :

```env
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Jamais exposé côté client
PUBLIC_VAPID_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:admin@votre-domaine.com
```

Pour générer les clés VAPID (Web Push) :
```bash
npx web-push generate-vapid-keys
```

### 3. Lancer en développement

```bash
npm install
npm run dev
```

→ [http://localhost:5173](http://localhost:5173)

### 4. Créer votre premier commerce

1. S'inscrire sur `/` avec votre email
2. Dans Supabase Dashboard → Table Editor → `commerces`
3. Insérer une ligne manuellement avec votre `owner_id` (UUID visible dans Auth → Users)

Exemple SQL :
```sql
INSERT INTO public.commerces (nom, slug, statut_file, owner_id)
VALUES (
  'Ma Pharmacie',
  'ma-pharmacie',
  'OUVERTE',
  'votre-uuid-auth-ici'
);
```

---

## Déploiement Vercel

```bash
npm install -g vercel
vercel
```

Configurer les variables d'environnement dans le dashboard Vercel :
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_VAPID_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`

---

## URLs de l'application

| Interface | URL | Usage |
|-----------|-----|-------|
| Accueil / Connexion | `/` | Gérant — authentification |
| Dashboard Gérant | `/dashboard` | Gestion de la file |
| Kiosque | `/kiosk/[commerce_id]` | Écran d'entrée (tablette/écran) |
| Scan QR | `/queue/scan?t=TOKEN` | Redirection automatique après scan |
| Vue Client | `/queue/[ticket_id]` | Suivi en temps réel du ticket |

---

## Structure du projet

```
qsmart/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte          # Layout racine + fonts
│   │   ├── +page.svelte            # Landing + auth
│   │   ├── dashboard/
│   │   │   ├── +layout.server.ts   # Guard auth
│   │   │   └── +page.svelte        # Dashboard gérant
│   │   ├── kiosk/[id]/
│   │   │   └── +page.svelte        # Kiosque QR code
│   │   ├── queue/
│   │   │   ├── scan/+page.svelte   # Validation QR → redirection
│   │   │   └── [id]/+page.svelte   # Vue client ticket
│   │   └── api/
│   │       ├── scan/+server.ts     # Validation TOTP + attribution ticket
│   │       └── push/
│   │           ├── subscribe/      # Sauvegarde PushSubscription
│   │           └── notify/         # Envoi notifications push
│   ├── lib/
│   │   ├── supabase.ts             # Client Supabase + types
│   │   ├── stores/
│   │   │   └── queue.ts            # Store Svelte + Realtime
│   │   └── utils/
│   │       ├── token.ts            # TOTP QR generation/validation
│   │       └── push.ts             # Web Push client utils
│   ├── hooks.server.ts             # Injection session auth
│   ├── app.css                     # Design tokens + global styles
│   └── app.d.ts                    # Types SvelteKit
├── static/
│   ├── sw.js                       # Service Worker (Web Push)
│   └── manifest.json               # PWA manifest
├── supabase/
│   └── migrations/
│       └── 001_schema.sql          # Schéma complet PostgreSQL
├── svelte.config.js
├── tailwind.config.js
├── vite.config.js
└── .env.example
```

---

## Fonctionnalités implémentées

### Interface Gérant
- [x] Appeler le suivant (RPC atomique)
- [x] Rappeler le client en cours (push notification)
- [x] Marquer absent
- [x] Ajouter ticket physique (manuel)
- [x] Ouvrir / Pauser / Fermer la file
- [x] Réinitialiser la file (fin de journée)
- [x] Métriques temps réel (en attente, en cours, traités, attente estimée)
- [x] Multi-commerces (sélecteur)

### Kiosque
- [x] QR code dynamique (renouvellement toutes les 15s via TOTP)
- [x] Barre de progression visuelle
- [x] Affichage numéro en cours + personnes en attente
- [x] Mode fermé / pause

### Interface Client
- [x] Attribution ticket instantanée via scan
- [x] Suivi temps réel (numéro en cours, position, temps estimé)
- [x] Alertes progressives (à 3, à 1, au tour)
- [x] Barre de progression
- [x] Abonnement Web Push
- [x] Gestion état pause de la file

### Sécurité
- [x] TOTP anti-triche (jeton expiré en 35s)
- [x] Attribution atomique (FOR UPDATE — zéro doublon)
- [x] Row Level Security Supabase
- [x] Service Role Key jamais exposée côté client
- [x] Guard auth sur `/dashboard`

---

## Ajouter les notifications Web Push en production

Installer la lib `web-push` :
```bash
npm install web-push
```

Dans `src/routes/api/push/notify/+server.ts`, décommenter et compléter :
```typescript
import webpush from 'web-push';

webpush.setVapidDetails(VAPID_EMAIL, PUBLIC_VAPID_KEY, VAPID_PRIVATE_KEY);

// Remplacer le console.log par :
await webpush.sendNotification(
  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
  pushPayload
);
```

---

## Supabase Database Webhook (optionnel)

Pour déclencher les push automatiquement quand le gérant appelle le suivant,
configurer un webhook Supabase sur l'événement `UPDATE` de la table `tickets`
(filtre : `statut = 'APPELE'`) vers `https://votre-app.vercel.app/api/push/notify`.

---

*Q-Smart — Fait pour les commerces dakarois, conçu pour le rush du vendredi.*
