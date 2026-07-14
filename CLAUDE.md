# CineTrack

App perso de suivi de films/séries. Mobile-first, mono-utilisateur, PWA. Interface en français, registre informel (« tu »).

## Pièges à connaître avant de coder

1. **Il n'y a PAS de TypeScript.** Tout est en `.jsx` / `.js` (client) et `.js` (serveurs). Pas de `tsconfig`. Typage par JSDoc quand c'est utile. Ne pas introduire de `.ts` sans le demander.
2. **Il y a DEUX backends qui doivent rester synchrones.** Toute route ajoutée/modifiée doit l'être aux deux endroits, sinon ça marche en prod et pas en local (ou l'inverse) :
   - **Prod** — `functions/api/[[path]].js` : Hono + D1, **toute l'API dans ce seul fichier**, SQL brut via `c.env.DB.prepare()`.
   - **Dev local** — `server/src/` : Express 5 + Prisma sur SQLite (`server/dev.db`), routes découpées par fichier dans `server/src/routes/`.
   - Le client bascule sur `import.meta.env.PROD` (`client/src/services/api.js`) : `/api` en prod, `http://localhost:3001/api` en dev.
3. **`drizzle-orm` est installé mais n'est jamais importé.** Tout l'accès D1 est du SQL brut. Ne pas se laisser piéger.
4. **Aucune authentification.** App mono-utilisateur, CORS `origin: '*'`. Pas de session, pas de token.
5. **Aucune librairie de validation** (pas de zod). Parsing manuel : `await c.req.json()` + gardes ad hoc → `c.json({ error: '…' }, 4xx)`.

## Schéma D1 (migrations/)

Tables **PascalCase singulier**, colonnes **camelCase**. Le point non intuitif :

> **`WatchEntry` = une ligne par _média_** (`mediaId` UNIQUE), pas par épisode.
> L'état « vu » d'un épisode vit **directement sur la ligne `Episode`** (`watched INTEGER 0/1`, `watchedAt TEXT` ISO, `rating REAL`).
> Il n'existe aucune table de jonction épisode↔visionnage. Une action en masse sur les épisodes est donc **un simple `UPDATE`**, jamais un upsert.

- `Media(id, tmdbId UNIQUE, mediaType 'movie'|'tv', title, posterPath, backdropPath, overview, releaseDate, genres [JSON array], runtime, voteAverage, director, isAnime)`
- `WatchEntry(id, mediaId UNIQUE→Media, status 'watchlist'|'watching'|'watched'|'dropped', rating, reviewPrivate, reviewPublic, watchedAt, addedAt, updatedAt)`
- `Season(id, mediaId→Media, seasonNumber, name, episodeCount)` — `UNIQUE(mediaId, seasonNumber)`
- `Episode(id, seasonId→Season, episodeNumber, name, airDate TEXT 'AAAA-MM-JJ', watched, watchedAt, rating)` — `UNIQUE(seasonId, episodeNumber)`
- `CustomList` / `CustomListItem(UNIQUE(listId, mediaId))`
- `WatchLog` — **table morte**, jamais lue ni écrite.

Un `Episode` n'a **ni `mediaId` ni id TMDB** : on y accède uniquement via `Episode.seasonId → Season.mediaId → Media.tmdbId`.

`Season`/`Episode` sont un miroir local de TMDB, peuplé **uniquement** par `POST /api/episodes/sync/:tmdbId` (les saisons 0 / « Specials » sont ignorées). Tant que la synchro n'a pas tourné, `GET /api/episodes/:tmdbId` renvoie `[]`.

## Performance D1

- `db.batch(statements)` = **une seule transaction**. À privilégier pour toute écriture multiple.
- Helper `batchChunked(db, statements, 100)` dans `functions/api/[[path]].js` : D1 limite le nombre d'instructions par `.batch()`, indispensable pour les séries à ~800 épisodes (Les Simpson).
- Leçon du commit 49b766e (26s → 2s) : **jamais de `await` dans une boucle** pour les fetchs TMDB (`Promise.all`) ni pour les écritures D1 (`batch`).
- Les upserts de synchro ne touchent **jamais** `watched` / `watchedAt` / `rating` : re-synchroniser doit préserver l'état de visionnage. Conserver cette propriété.

## Frontend

`client/` — React 19, Vite, Tailwind 3.4, TanStack Query 5, **axios** (pas fetch), react-router 7, lucide-react, PWA. Linter : **oxlint**.

- **Pas de shadcn/ui, pas de `cn()`/clsx.** Tailwind écrit à la main.
- **Dark only.** Aucune variante `dark:`. Palette sémantique dans `tailwind.config.js` — utiliser les noms (`bg`, `surface`, `card`, `border`, `gold`, `text-primary`, `text-sec`, `text-dim`, `green`, `blue`, `red`), **jamais de hex brut**.
- **Query keys inline**, pas de factory : `['detail', type, id]`, `['seasons', id]`, `['watchlist', filter]`, `['stats']`, `['lists']`…
- Un nouveau préfixe de query à persister offline doit être ajouté à `PERSISTED_QUERY_PREFIXES` dans `App.jsx`.
- **Mutations : `invalidateQueries` dans `onSuccess`.** Une seule mutation optimiste dans toute l'app (l'action en masse de `DetailPage`) — c'est volontaire, elle touche des centaines de lignes.
- **Toasts** : `useToast()` depuis `client/src/hooks/useToast.js` → `toast('message')` ou `toast('message', 'error')`. Provider monté dans `App.jsx`.
- Conventions visuelles : cartes `bg-card border border-border rounded-xl` · titres de section `text-xs text-text-dim uppercase tracking-widest` · titres `font-serif` (Georgia) · CTA principal `bg-gold text-bg rounded-xl` · modales = bottom sheets · feedback tactile `active:opacity-70` / `active:bg-white/5` (mobile : pas de `hover:`) · cibles tactiles ≥ 44px · conteneur `max-w-lg mx-auto`.
- Dates : `Intl` natif, locale `fr-FR`. Helpers de diffusion dans `client/src/utils/airDate.js` (`formatAirDate`, `isAired`). Pas de date-fns.

## TMDB

Les routes `/api/tmdb/*` sont un **proxy live** (aucun cache, aucun TTL), `language=fr-FR`, clé dans `c.env.TMDB_API_KEY` / `.env`.
`GET /tv/:id` renvoie la réponse TMDB **complète** : `next_episode_to_air`, `last_episode_to_air`, `status` (`'Returning Series'`, `'Ended'`, `'Canceled'`…) sont donc déjà disponibles côté client sans changement backend.

⚠️ **TMDB ne fournit jamais l'heure de diffusion**, seulement une date (`"2026-07-22"`). Ne pas promettre un « à 21h00 » : `airDate.js` gère un ISO complet au cas où, mais en pratique l'heure est absente.

## Commandes

```bash
cd client && npm run dev      # front  :5173
cd server && npm run dev      # API dev :3001 (Express + Prisma)
cd client && npm run build    # build prod (vérifie toujours après un changement front)
cd client && npx oxlint src/  # lint
npx wrangler d1 execute cinetrack-db --local --command "…"   # inspecter la D1 locale
```
