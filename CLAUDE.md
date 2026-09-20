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
- `TvChannel` / `TvProgram` — programme TV, **sans aucun lien avec `Media`** (cf. section dédiée).
- `WatchLog` — **table morte**, jamais lue ni écrite.

Un `Episode` n'a **ni `mediaId` ni id TMDB** : on y accède uniquement via `Episode.seasonId → Season.mediaId → Media.tmdbId`.

`Season`/`Episode` sont un miroir local de TMDB, peuplé **uniquement** par `POST /api/episodes/sync/:tmdbId` (les saisons 0 / « Specials » sont ignorées). Tant que la synchro n'a pas tourné, `GET /api/episodes/:tmdbId` renvoie `[]`.

## Performance D1

- `db.batch(statements)` = **une seule transaction**. À privilégier pour toute écriture multiple.
- Helper `batchChunked(db, statements, 100)` dans `functions/api/[[path]].js` : D1 limite le nombre d'instructions par `.batch()`, indispensable pour les séries à ~800 épisodes (Les Simpson).
- Leçon du commit 49b766e (26s → 2s) : **jamais de `await` dans une boucle** pour les fetchs TMDB (`Promise.all`) ni pour les écritures D1 (`batch`).
- Les upserts de synchro ne touchent **jamais** `watched` / `watchedAt` / `rating` : re-synchroniser doit préserver l'état de visionnage. Conserver cette propriété.

## L'état d'un titre est DÉDUIT, jamais saisi

Le statut déclaré (`WatchEntry.status`) **n'est pas la source de vérité** et ne doit plus servir à classer quoi que ce soit. Il mentait sur la moitié de la liste : Silo était marqué « à voir » avec 10 épisodes sur 22 déjà vus, parce que personne ne maintient ce champ à la main. La vérité est dans les compteurs d'épisodes.

Règle unique, implémentée dans [`client/src/utils/progress.js`](client/src/utils/progress.js) — toute autre partie du code doit s'y référer plutôt que de recalculer :

1. `status === 'dropped'` → **archived**. Seul état encore déclaratif : abandonner est une décision, ça ne se devine pas d'une progression.
2. Film, ou série jamais synchronisée (`episodes.total === 0`) → aucune progression à lire, on retombe sur le statut : `watched` → **done**, sinon **notStarted**.
3. `episodes.watched === 0` → **notStarted**.
4. `episodes.aired - episodes.watched > 0` → **behind**.
5. Tout le sorti est vu : `episodes.aired < episodes.total` → **upToDate** (la série continue), sinon → **done**.

« Sorti » = `airDate <= date('now')` **ou** `airDate IS NULL` (TMDB laisse parfois le champ vide sur du vieux contenu). Un épisode à venir ne met jamais en retard.

Regroupement en trois onglets sur « Ma liste » :

| Onglet | États | Sens |
|---|---|---|
| **À suivre** | `behind` + `upToDate` | Commencé, pas fini |
| **À voir** | `notStarted` | Jamais lancé |
| **Terminé** | `done` + `archived` | Plus rien à regarder |

⚠️ Une série sur laquelle on est à jour reste dans **À suivre**, pas dans Terminé : elle n'est pas finie, elle attend son prochain épisode. Le jour où il tombe, elle passe simplement de `upToDate` à `behind` — même onglet, même place dans l'ordre alphabétique, seule sa pastille change.

**Tri** : **ordre alphabétique du titre, dans les trois onglets**, sans exception (`compareEntries` = un simple `Intl.Collator('fr', { sensitivity: 'base', numeric: true })`). L'état déduit sert à *ranger dans un onglet*, jamais à ordonner à l'intérieur : une liste qui se réordonne toute seule quand un épisode tombe est illisible, on cherche un titre à l'œil. Ne pas réintroduire de tri par `lastUnwatchedAirDate` ou `updatedAt`.

Côté API, `GET /api/watchlist` renvoie `episodes: { total, aired, watched, lastUnwatchedAirDate }`, agrégé **en SQL** : sans ça, trier 9 titres imposerait de télécharger 1500 épisodes. `GET /api/stats` applique la même philosophie — une série compte dès le **premier épisode vu** (l'ancienne version annonçait « 0 série vue » alors que 473 épisodes l'étaient, et laissait « Genres favoris » vide).

## Frontend

`client/` — React 19, Vite, Tailwind 3.4, TanStack Query 5, **axios** (pas fetch), react-router 7, lucide-react, PWA. Linter : **oxlint**.

**Quatre onglets** (`BottomNav.jsx`) : **Ma liste** (`/watchlist`, c'est l'accueil — `/` y redirige) · **TV** (`/tv`) · **Découvrir** (`/search`) · **Moi** (`/profile`). Pages hors nav : `/journal`, `/wrapped`, `/person/:id`, `/:type/:id`.
`/stats` n'existe plus — l'ancienne page a fusionné dans « Moi » (les deux affichaient « Genres favoris », un vrai doublon). La route redirige vers `/profile` pour ne pas casser un raccourci PWA.

- **Pas de shadcn/ui, pas de `cn()`/clsx.** Tailwind écrit à la main.
- **Dark only.** Aucune variante `dark:`. Palette sémantique dans `tailwind.config.js` — utiliser les noms (`bg`, `surface`, `card`, `border`, `gold`, `text-primary`, `text-sec`, `text-dim`, `green`, `blue`, `red`), **jamais de hex brut**.
- **Query keys inline**, pas de factory : `['detail', type, id]`, `['seasons', id]`, `['watchlist', null]`, `['stats']`, `['lists']`, `['next-episode', id]`…
- « Ma liste » garde son onglet et son filtre **dans l'URL** (`/watchlist?tab=termine`), pas dans un `useState` : on revient d'une fiche par `navigate(-1)`, qui remonte la page à neuf. Écrire avec `replace: true`, sinon la flèche retour reparcourt les onglets visités. Sans paramètre on ouvre sur « À suivre » — c'est l'accueil, il montre ce qui est regardable maintenant.
- « Ma liste » ne filtre plus côté serveur : une seule requête `['watchlist', null]`, l'état est déduit côté client (cf. section ci-dessus).
- Un nouveau préfixe de query à persister offline doit être ajouté à `PERSISTED_QUERY_PREFIXES` dans `App.jsx`.
- **Mutations : `invalidateQueries` dans `onSuccess`.** Une seule mutation optimiste dans toute l'app (l'action en masse de `DetailPage`) — c'est volontaire, elle touche des centaines de lignes.
- **Toasts** : `useToast()` depuis `client/src/hooks/useToast.js` → `toast('message')` ou `toast('message', 'error')`. Provider monté dans `App.jsx`.
- Conventions visuelles : cartes `bg-card border border-border rounded-xl` · titres de section `text-xs text-text-dim uppercase tracking-widest` · titres `font-serif` (Georgia) · CTA principal `bg-gold text-bg rounded-xl` · modales = bottom sheets · feedback tactile `active:opacity-70` / `active:bg-white/5` (mobile : pas de `hover:`) · cibles tactiles ≥ 44px · conteneur `max-w-lg mx-auto`.
- ⚠️ **Toute modale passe par [`SheetBackdrop`](client/src/components/SheetBackdrop.jsx)**, jamais par un `fixed inset-0` écrit à la main. `BottomNav` est en `z-50` **dans `#root`** : une feuille rendue au milieu de l'arbre se fait recouvrir par la barre d'onglets sur iOS et perd ~100pt en bas (fin de texte, bouton d'action). `SheetBackdrop` la monte en **portal sur `<body>`**, ce qui neutralise le problème quel que soit le parent. Prévoir aussi la safe-area (`env(safe-area-inset-bottom)`) et, si le contenu peut être long, un corps en `overflow-y-auto` avec la CTA dans un pied `flex-shrink-0` — sinon le bouton part hors écran. Unités de hauteur : `svh`, pas `vh`.
- Dates : `Intl` natif, locale `fr-FR`. Helpers de diffusion dans `client/src/utils/airDate.js` (`formatAirDate`, `isAired`). Pas de date-fns.

## TMDB

Les routes `/api/tmdb/*` sont un **proxy live** (aucun cache, aucun TTL), `language=fr-FR`, clé dans `c.env.TMDB_API_KEY` / `.env`.
`GET /tv/:id` renvoie la réponse TMDB **complète** : `next_episode_to_air`, `last_episode_to_air`, `status` (`'Returning Series'`, `'Ended'`, `'Canceled'`…) sont donc disponibles côté client sans changement backend.

## Dates de diffusion : TVmaze fait autorité, pas TMDB

Répartition des rôles, à ne pas mélanger :
- **TVmaze** → dates et heures de diffusion, **uniquement**.
- **TMDB** → tout le reste (fiches, posters, casting, recommandations, plateformes).

Deux faits vérifiés qui justifient cette frontière :

1. ⚠️ **TMDB se trompe d'un jour sur les séries Apple TV+.** Vérifié sur les 10 épisodes de Silo S2 : TMDB annonce jeudi, Apple a diffusé le vendredi ([communiqué Apple](https://www.apple.com/tv-pr/news/2024/10/apple-tv-unveils-trailer-for-second-season-of-globally-acclaimed-hit-drama-silo/)). Ce n'est pas ponctuel, c'est systématique.
2. ⚠️ **Aucune API ne connaît l'heure de diffusion d'une série de plateforme.** TVmaze remplit alors `airstamp` à **midi UTC — valeur factice**. Ne JAMAIS l'afficher comme une heure. Le discriminant est `airtime` : non vide ⇒ chaîne linéaire, heure réelle ; vide ⇒ plateforme, pas d'heure.

Conséquence pour l'affichage (`client/src/utils/airDate.js`) :
- **Chaîne linéaire** (`network` non nul, `airtime` renseigné) → `airstamp` est un vrai instant → conversion directe vers Paris → « à 3h00 ». Heure exacte.
- **Plateforme** (`webChannel`) → l'heure est **dérivée** de la convention (mise en ligne à 00h00 heure du Pacifique) → « à partir de 9h00 ». On passe par une vraie conversion `America/Los_Angeles` → `Europe/Paris`, jamais un décalage codé en dur : les changements d'heure se gèrent seuls (9h toute l'année, 8h pendant deux semaines en mars).

Détails d'intégration TVmaze : pas de clé d'API, ~20 req/10s. Le pont se fait via `imdb_id` (TMDB `/external_ids`) → `/lookup/shows?imdb=…`, qui **répond en 301** (`fetch()` suit, `curl` a besoin de `-L`). L'id TVmaze est mis en cache dans `Media.tvmazeId`, jamais recalculé.

**Garde-fou de la synchro** : une saison n'est enrichie que si TMDB et TVmaze sont d'accord sur le **nombre d'épisodes**. Les numérotations divergent parfois (épisodes doubles, spéciaux) et on collerait la date du mauvais épisode. En cas de désaccord, on ne touche pas à la saison et TMDB fait foi. Tout l'enrichissement est best-effort : une panne TVmaze ne doit jamais faire échouer une synchro.

## Programme TV : la seule donnée qui n'entre pas par l'API

Source : **[xmltvfr.fr](https://xmltvfr.fr)** (fichier TNT, 30 chaînes, ~1,2 Mo gzip / 7 Mo de XML), généré chaque nuit vers 02h10 par [racacax/XML-TV-Fr](https://github.com/racacax/XML-TV-Fr). Il couvre **J-1 → J+8** ; on n'en conserve que **J-2 → J+4**.

> ⚠️ **J-2 ne vient jamais du flux** : il est l'archive laissée par l'exécution de l'avant-veille. D'où le fonctionnement de [`scripts/import-tv-guide.mjs`](scripts/import-tv-guide.mjs) — il purge hors fenêtre, puis ne **réécrit que les jours couverts de bout en bout** par le flux. Un jour partiel (la nuit de J-1, rattachée à J-2) est complété en `INSERT OR IGNORE`, jamais remplacé. Casser ça efface l'historique.

**L'ingestion n'est pas une route.** Les Pages Functions n'ont pas de cron trigger (c'est une fonctionnalité Workers) et le plan gratuit plafonne à **10 ms de CPU par invocation** : parser 7 Mo de XML dans l'API est hors de portée. Le cron de l'app est donc [`.github/workflows/tv-guide.yml`](.github/workflows/tv-guide.yml), qui réutilise les secrets Cloudflare déjà posés pour le déploiement. L'API ne fait que des `SELECT`.

Pièges vérifiés, à ne pas réapprendre :

1. ⚠️ **D1 plafonne la longueur d'une INSTRUCTION SQL** (`SQLITE_TOOBIG` vers 100 Ko). Grouper les `INSERT` par nombre de lignes ne protège de rien : un lot de films aux longs résumés pèse cinq fois un lot de bulletins météo. On groupe **par taille** (`MAX_STATEMENT_BYTES`). SQLite en local avale les instructions géantes sans broncher — seule la D1 refuse, et l'import échoue à moitié écrit.
2. **`--local` vise `server/dev.db`** (le backend Express), pas la D1 locale de Wrangler : trois magasins distincts cohabitent.
3. Pour tester le chemin prod, lancer `wrangler pages dev client/dist` **sans `--d1=`** — le drapeau crée un magasin local séparé de celui de `d1 execute --local`, et la table paraît absente.
4. Le contenu de `<rating>` est lui-même balisé (`<rating><value>-10</value></rating>`) : descendre jusqu'au `<value>`.

**Jour de grille** : `TvProgram.day` n'est pas le jour calendaire. Ce qui commence **avant 5h du matin appartient à la soirée de la veille**, comme dans n'importe quel magazine TV. C'est la colonne sur laquelle la page filtre, et elle est calculée à l'import.

**La grille est servie sans les résumés.** `GET /api/tv-guide?day=` renvoie ~800 programmes ; embarquer `description`, `imageUrl`, `actors` et `csa` ajouterait ~350 Ko de texte que la liste n'affiche pas. Le détail est chargé à l'ouverture, par `GET /api/tv-guide/program/:id`. Même philosophie que l'agrégation SQL de `/api/watchlist`.

Toutes les dates sont des ISO 8601 **avec décalage, écrites en heure de Paris** par la source. Deux conséquences exploitées dans [`client/src/utils/tvGuide.js`](client/src/utils/tvGuide.js) : on formate toujours en `Europe/Paris` (grille française, lisible depuis n'importe où), et l'heure murale se compare directement dans la chaîne (`slice(11, 16)`) sans aucun calcul de fuseau.

## Commandes

```bash
cd client && npm run dev      # front  :5173
cd server && npm run dev      # API dev :3001 (Express + Prisma)
cd client && npm run build    # build prod (vérifie toujours après un changement front)
cd client && npx oxlint src/  # lint
npm run tv:import            # programme TV → D1 distante (ce que fait le cron)
npm run tv:import:local      # programme TV → server/dev.db (backend Express)
npx wrangler d1 execute cinetrack-db --local --command "…"   # inspecter la D1 locale
```
