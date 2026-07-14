---
name: add-api-endpoint
description: Ajouter ou modifier un endpoint de l'API CineTrack. À charger dès qu'une tâche touche une route `/api/*`, un accès D1/Prisma, ou `client/src/services/api.js`. Encode le piège du double backend (Hono/D1 en prod, Express/Prisma en dev) qui doivent rester synchrones.
---

# Ajouter un endpoint API (CineTrack)

## Le piège central

L'API existe **en double**. Oublier un des deux côtés = ça marche en local et casse en prod, ou l'inverse. Aucun test ne l'attrape.

| | Prod | Dev local |
|---|---|---|
| Fichier | `functions/api/[[path]].js` (**toute l'API dans ce fichier**) | `server/src/routes/*.js` + montage dans `server/src/index.js` |
| Stack | Hono + D1, SQL brut (`c.env.DB.prepare()`) | Express 5 + Prisma (SQLite) |

## Checklist

1. **Prod** — ajouter la route dans `functions/api/[[path]].js`, à côté de ses voisines thématiques (`// ── EPISODES ──`, `// ── STATS ──`…).
   - Params : `c.req.param('x')`, query : `c.req.query('x')`, body : `await c.req.json()`.
   - Coercition manuelle : `Number(tmdbId)`, `watched ? 1 : 0` (SQLite n'a pas de booléen).
   - Gardes explicites : `if (!media) return c.json({ error: 'Media not found' }, 404)`. Pas de zod dans ce projet.
   - Écritures multiples → **`db.batch([...])`** (une seule transaction). Au-delà de ~100 instructions, passer par `batchChunked()`.
2. **Dev** — mirroir Prisma dans `server/src/routes/`. Toujours `try/catch` → `res.status(500).json({ error: e.message })`.
   - ⚠️ `updateMany` n'accepte **que des filtres scalaires** : pas de filtre par relation (`{ season: { mediaId } }` échoue). Récupérer les ids d'abord, puis `{ seasonId: { in: ids } }`.
   - Nouveau fichier de routes → le monter dans `server/src/index.js`.
3. **Client** — ajouter la méthode dans `client/src/services/api.js` (axios, `.then(r => r.data)`).
4. **Query cache** — si la donnée doit survivre hors-ligne, ajouter le préfixe de clé à `PERSISTED_QUERY_PREFIXES` dans `client/src/App.jsx`.

## Sémantique métier à ne pas casser

- L'état « vu » d'un épisode est **sur la ligne `Episode`** (`watched`, `watchedAt`). `WatchEntry` = une ligne par média, pas par épisode.
- Une écriture ne doit **jamais** réécrire le `watchedAt` d'un épisode déjà vu : le journal et le Wrapped s'appuient dessus (`strftime('%Y', watchedAt)`). Filtrer avec `AND watched != ?` ou `COALESCE(watchedAt, ?)`.
- Ne jamais marquer « vu » un épisode non diffusé : `AND (airDate IS NULL OR airDate <= date('now'))`. Un `airDate` NULL compte comme diffusé.
- La synchro TMDB ne doit jamais écraser `watched` / `watchedAt` / `rating`.

## Vérifier

Le SQL est la partie risquée, et la D1 locale est souvent vide. Le tester pour de vrai sur une base jetable plutôt que le relire :

```bash
cd "$(mktemp -d)" && cat ~/…/CineTrack/migrations/*.sql | sqlite3 t.db
# seeder les cas limites (déjà vu / non diffusé / airDate NULL), lancer l'UPDATE, vérifier changes()
```

Puis, systématiquement :

```bash
cd client && npx oxlint src/ && npm run build
node -c server/src/routes/<fichier>.js
```
