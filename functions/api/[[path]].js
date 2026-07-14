import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono().basePath('/api')

app.use('*', cors({ origin: '*' }))

// Le fichier client/public/_headers ne s'applique qu'aux fichiers statiques : les
// réponses des Pages Functions y échappent. On repose donc l'en-tête ici, sinon
// l'API serait le seul endroit indexable de l'app.
app.use('*', async (c, next) => {
  await next()
  c.header('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet')
})

// D1 limite le nombre d'instructions par appel .batch() — on découpe en lots
// pour les séries à très nombreux épisodes (ex. Les Simpson : ~800 épisodes).
async function batchChunked(db, statements, chunkSize = 100) {
  for (let i = 0; i < statements.length; i += chunkSize) {
    await db.batch(statements.slice(i, i + chunkSize))
  }
}

// Mots-clés TMDB à exclure systématiquement (contenu pornographique / hentai).
// TMDB ne marque pas toujours ce contenu comme `adult: true` de façon fiable
// (particulièrement les OAV hentai côté anime), d'où l'exclusion explicite
// par mot-clé en complément de `include_adult: false`.
const EXCLUDED_KEYWORDS = '198385,195669,281741,329280,325693,256466,161919,155477,267122' // hentai, ecchi, nudity, sexual content, erotica, erotic, adult animation, softcore, sex
const excludeAdult = (results) => (results || []).filter(r => !r.adult)

// ── TMDB proxy ────────────────────────────────────────────
const tmdb = (env) => ({
  get: async (path, params = {}) => {
    const url = new URL(`https://api.themoviedb.org/3${path}`)
    url.searchParams.set('api_key', env.TMDB_API_KEY)
    url.searchParams.set('language', 'fr-FR')
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url)
    return res.json()
  }
})

// ── TVmaze : source de vérité pour les dates/heures de diffusion ──
// TMDB ne fournit qu'une date, et elle est fausse d'un jour sur les séries Apple TV+
// (vérifié sur Silo S2 : TMDB annonce jeudi, Apple a diffusé le vendredi — les 10
// épisodes sont décalés). TVmaze donne la bonne date, et l'instant exact pour les
// chaînes linéaires. Pas de clé d'API, pas d'auth.
//
// Frontière nette : TVmaze ne sert QUE pour les dates/heures de diffusion. TMDB
// reste la source pour tout le reste (fiches, posters, casting, recommandations).
const TVMAZE = 'https://api.tvmaze.com'

const tvmazeJson = async (path) => {
  // Le lookup répond en 301 vers /shows/{id} — fetch() suit la redirection.
  // Une série inconnue de TVmaze renvoie 404 : on retourne null, l'appelant retombe sur TMDB.
  const res = await fetch(`${TVMAZE}${path}`)
  return res.ok ? res.json() : null
}

// Résout l'id TVmaze depuis l'imdb_id fourni par TMDB, et le met en cache sur Media
// (le mapping est stable : une fois résolu, on ne le recalcule jamais).
async function resolveTvmazeId(c, tmdbId, media) {
  if (media?.tvmazeId) return media.tvmazeId
  const ext = await tmdb(c.env).get(`/tv/${tmdbId}/external_ids`)
  if (!ext?.imdb_id) return null
  const show = await tvmazeJson(`/lookup/shows?imdb=${ext.imdb_id}`)
  if (!show) return null
  if (media) {
    await c.env.DB.prepare('UPDATE Media SET tvmazeId = ? WHERE id = ?').bind(show.id, media.id).run()
  }
  return show.id
}

// Une série de chaîne (`network`) a une heure de diffusion réelle. Une série de
// plateforme (`webChannel`) n'en a pas : TVmaze remplit alors `airstamp` à midi UTC,
// valeur factice qu'il ne faut JAMAIS afficher comme une heure. Le client dérive
// l'heure de mise en ligne depuis la convention plateforme (minuit heure du Pacifique).
const showKind = (show) => (show?.network ? 'linear' : 'streaming')
const showChannel = (show) => (show?.network || show?.webChannel || {})?.name || null

app.get('/tmdb/search', async (c) => {
  const q = c.req.query('q')
  if (!q) return c.json({ error: 'Query required' }, 400)
  const data = await tmdb(c.env).get('/search/multi', { query: q, include_adult: false })
  return c.json(excludeAdult(data.results).filter(r => r.media_type === 'movie' || r.media_type === 'tv'))
})

app.get('/tmdb/trending', async (c) => {
  const type = c.req.query('type') || 'all'
  const window = c.req.query('window') || 'week'
  const data = await tmdb(c.env).get(`/trending/${type}/${window}`)
  return c.json(excludeAdult(data.results))
})

app.get('/tmdb/discover/:mediaType', async (c) => {
  const mediaType = c.req.param('mediaType')
  if (!['movie', 'tv'].includes(mediaType)) return c.json({ error: 'Invalid mediaType' }, 400)
  const genre = c.req.query('genre')
  const maxRuntime = c.req.query('maxRuntime')
  const params = { sort_by: 'popularity.desc', 'vote_count.gte': 50, include_adult: false, without_keywords: EXCLUDED_KEYWORDS }
  if (genre) params.with_genres = genre
  if (maxRuntime) params['with_runtime.lte'] = maxRuntime
  const data = await tmdb(c.env).get(`/discover/${mediaType}`, params)
  return c.json(excludeAdult(data.results))
})

app.get('/tmdb/anime/trending', async (c) => {
  const data = await tmdb(c.env).get('/discover/tv', {
    with_genres: 16,
    with_origin_country: 'JP',
    sort_by: 'popularity.desc',
    include_adult: false,
    without_keywords: EXCLUDED_KEYWORDS,
  })
  return c.json(excludeAdult(data.results))
})

app.get('/tmdb/movie/:id', async (c) => {
  const data = await tmdb(c.env).get(`/movie/${c.req.param('id')}`, { append_to_response: 'credits,videos' })
  return c.json(data)
})

app.get('/tmdb/tv/:id', async (c) => {
  const data = await tmdb(c.env).get(`/tv/${c.req.param('id')}`, { append_to_response: 'credits,videos' })
  return c.json(data)
})

app.get('/tmdb/tv/:id/season/:season', async (c) => {
  const data = await tmdb(c.env).get(`/tv/${c.req.param('id')}/season/${c.req.param('season')}`)
  return c.json(data)
})

app.get('/tmdb/:mediaType/:id/recommendations', async (c) => {
  const { mediaType, id } = c.req.param()
  if (!['movie', 'tv'].includes(mediaType)) return c.json({ error: 'Invalid mediaType' }, 400)
  const data = await tmdb(c.env).get(`/${mediaType}/${id}/recommendations`)
  return c.json(excludeAdult(data.results))
})

app.get('/tmdb/:mediaType/:id/watch-providers', async (c) => {
  const { mediaType, id } = c.req.param()
  if (!['movie', 'tv'].includes(mediaType)) return c.json({ error: 'Invalid mediaType' }, 400)
  const data = await tmdb(c.env).get(`/${mediaType}/${id}/watch/providers`)
  return c.json(data.results?.FR || null)
})

// ── WATCHLIST ─────────────────────────────────────────────
// La progression épisode est agrégée en SQL et renvoyée avec chaque fiche.
// « Ma liste » en a besoin pour TRIER (séries à rattraper en premier) : sans ça,
// le client devrait télécharger les 1400 épisodes pour classer 9 titres.
//
// Le statut déclaré (watchlist/watching/watched) n'est plus la source de vérité —
// personne ne le met à jour à la main. L'état réel se déduit de ces compteurs,
// côté client (client/src/utils/progress.js).
const WATCHLIST_QUERY = `
  SELECT w.id, w.status, w.rating, w.reviewPrivate, w.reviewPublic, w.watchedAt, w.addedAt, w.updatedAt,
         m.id AS mediaId, m.tmdbId, m.mediaType, m.title, m.posterPath, m.backdropPath, m.overview,
         m.releaseDate, m.genres, m.runtime, m.voteAverage, m.director, m.isAnime,
         COUNT(e.id) AS epTotal,
         COALESCE(SUM(CASE WHEN e.airDate IS NULL OR e.airDate <= date('now') THEN 1 ELSE 0 END), 0) AS epAired,
         COALESCE(SUM(COALESCE(e.watched, 0)), 0) AS epWatched,
         -- Date du dernier épisode SORTI mais NON VU : c'est elle qui fait remonter
         -- une série dont un épisode vient de tomber devant un vieux retard de 27 épisodes.
         MAX(CASE WHEN e.watched = 0 AND (e.airDate IS NULL OR e.airDate <= date('now')) THEN e.airDate END) AS epLastUnwatched
  FROM WatchEntry w
  JOIN Media m ON w.mediaId = m.id
  LEFT JOIN Season s ON s.mediaId = m.id
  LEFT JOIN Episode e ON e.seasonId = s.id
`

const toEntry = (row) => ({
  id: row.id, status: row.status, rating: row.rating,
  reviewPrivate: row.reviewPrivate, reviewPublic: row.reviewPublic,
  watchedAt: row.watchedAt, addedAt: row.addedAt, updatedAt: row.updatedAt,
  media: {
    id: row.mediaId, tmdbId: row.tmdbId, mediaType: row.mediaType,
    title: row.title, posterPath: row.posterPath, backdropPath: row.backdropPath,
    overview: row.overview, releaseDate: row.releaseDate,
    genres: row.genres, runtime: row.runtime, voteAverage: row.voteAverage,
    director: row.director, isAnime: !!row.isAnime,
  },
  episodes: {
    total: row.epTotal,
    aired: row.epAired,
    watched: row.epWatched,
    lastUnwatchedAirDate: row.epLastUnwatched,
  },
})

app.get('/watchlist', async (c) => {
  const status = c.req.query('status')
  const query = `${WATCHLIST_QUERY} ${status ? 'WHERE w.status = ?' : ''} GROUP BY w.id ORDER BY w.updatedAt DESC`

  const { results } = status
    ? await c.env.DB.prepare(query).bind(status).all()
    : await c.env.DB.prepare(query).all()

  return c.json(results.map(toEntry))
})

app.post('/watchlist', async (c) => {
  const { tmdbId, mediaType, status = 'watchlist' } = await c.req.json()
  if (!tmdbId || !mediaType) return c.json({ error: 'tmdbId and mediaType required' }, 400)

  const detail = await tmdb(c.env).get(
    mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`,
    { append_to_response: 'genres,credits' }
  )

  const title = detail.title || detail.name
  const releaseDate = detail.release_date || detail.first_air_date
  const runtime = detail.runtime || detail.episode_run_time?.[0] || null
  const genres = JSON.stringify((detail.genres || []).map(g => g.name))
  const director = mediaType === 'movie'
    ? detail.credits?.crew?.find(cr => cr.job === 'Director')?.name || null
    : detail.created_by?.[0]?.name || null
  const isAnime = (detail.genres || []).some(g => g.name === 'Animation')
    && (detail.origin_country?.includes('JP') || detail.original_language === 'ja')

  // Upsert Media
  await c.env.DB.prepare(`
    INSERT INTO Media (tmdbId, mediaType, title, posterPath, backdropPath, overview, releaseDate, genres, runtime, voteAverage, director, isAnime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tmdbId) DO NOTHING
  `).bind(Number(tmdbId), mediaType, title, detail.poster_path, detail.backdrop_path,
    detail.overview, releaseDate, genres, runtime, detail.vote_average, director, isAnime ? 1 : 0).run()

  const media = await c.env.DB.prepare('SELECT * FROM Media WHERE tmdbId = ?').bind(Number(tmdbId)).first()

  // Upsert WatchEntry
  const existing = await c.env.DB.prepare('SELECT * FROM WatchEntry WHERE mediaId = ?').bind(media.id).first()
  if (existing) {
    await c.env.DB.prepare('UPDATE WatchEntry SET status = ?, updatedAt = datetime("now") WHERE mediaId = ?')
      .bind(status, media.id).run()
  } else {
    await c.env.DB.prepare('INSERT INTO WatchEntry (mediaId, status) VALUES (?, ?)').bind(media.id, status).run()
  }

  const entry = await c.env.DB.prepare('SELECT * FROM WatchEntry WHERE mediaId = ?').bind(media.id).first()
  return c.json({ ...entry, media })
})

app.patch('/watchlist/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const fields = []
  const values = []

  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status) }
  if (body.rating !== undefined) { fields.push('rating = ?'); values.push(body.rating) }
  if (body.reviewPrivate !== undefined) { fields.push('reviewPrivate = ?'); values.push(body.reviewPrivate) }
  if (body.reviewPublic !== undefined) { fields.push('reviewPublic = ?'); values.push(body.reviewPublic) }
  if (body.watchedAt !== undefined) { fields.push('watchedAt = ?'); values.push(body.watchedAt) }
  fields.push('updatedAt = datetime("now")')
  values.push(id)

  await c.env.DB.prepare(`UPDATE WatchEntry SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
  const entry = await c.env.DB.prepare(`
    SELECT w.*, m.tmdbId, m.mediaType, m.title, m.posterPath FROM WatchEntry w JOIN Media m ON w.mediaId = m.id WHERE w.id = ?
  `).bind(id).first()
  return c.json(entry)
})

app.delete('/watchlist/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM WatchEntry WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ── PROCHAIN ÉPISODE (dates TVmaze) ───────────────────────
// Volontairement indépendant de la synchro : le badge doit s'afficher même sur une
// série qu'on vient de découvrir. Renvoie null si TVmaze ne connaît pas la série —
// le client retombe alors sur next_episode_to_air de TMDB.
app.get('/tv/:tmdbId/next-episode', async (c) => {
  const tmdbId = Number(c.req.param('tmdbId'))
  try {
    const media = await c.env.DB.prepare('SELECT id, tvmazeId FROM Media WHERE tmdbId = ?').bind(tmdbId).first()
    const showId = await resolveTvmazeId(c, tmdbId, media)
    if (!showId) return c.json(null)

    const show = await tvmazeJson(`/shows/${showId}?embed=nextepisode`)
    const next = show?._embedded?.nextepisode
    if (!next) return c.json(null)

    return c.json({
      kind: showKind(show),
      channel: showChannel(show),
      season: next.season,
      episode: next.number,
      name: next.name || null,
      airdate: next.airdate,
      // airtime vide ⇒ pas d'heure réelle (plateforme). airstamp ne vaut alors rien.
      airtime: next.airtime || null,
      airstamp: next.airstamp || null,
    })
  } catch {
    return c.json(null) // TVmaze indisponible : repli silencieux sur TMDB
  }
})

// ── EPISODES ──────────────────────────────────────────────
app.get('/episodes/:tmdbId', async (c) => {
  const media = await c.env.DB.prepare('SELECT * FROM Media WHERE tmdbId = ?').bind(Number(c.req.param('tmdbId'))).first()
  if (!media) return c.json({ error: 'Media not found' }, 404)

  const { results: seasons } = await c.env.DB.prepare('SELECT * FROM Season WHERE mediaId = ? ORDER BY seasonNumber').bind(media.id).all()
  for (const season of seasons) {
    const { results: episodes } = await c.env.DB.prepare('SELECT * FROM Episode WHERE seasonId = ? ORDER BY episodeNumber').bind(season.id).all()
    season.episodes = episodes
  }
  return c.json(seasons)
})

app.post('/episodes/sync/:tmdbId', async (c) => {
  const media = await c.env.DB.prepare('SELECT * FROM Media WHERE tmdbId = ?').bind(Number(c.req.param('tmdbId'))).first()
  if (!media) return c.json({ error: 'Media not found' }, 404)

  const tvDetail = await tmdb(c.env).get(`/tv/${c.req.param('tmdbId')}`)
  const seasonsToSync = (tvDetail.seasons || []).filter(s => s.season_number !== 0)

  // Récupère toutes les saisons EN PARALLÈLE — l'ancienne version faisait un
  // fetch TMDB par saison de façon séquentielle (await dans une boucle for),
  // ce qui pouvait prendre 20-30s+ pour une série à nombreuses saisons
  // (ex. Les Simpson) et donnait l'impression que le bouton ne faisait rien.
  const seasonDataList = await Promise.all(
    seasonsToSync.map(s => tmdb(c.env).get(`/tv/${c.req.param('tmdbId')}/season/${s.season_number}`))
  )

  // Upsert des saisons en batch(s) D1
  await batchChunked(c.env.DB, seasonsToSync.map(s => c.env.DB.prepare(`
    INSERT INTO Season (mediaId, seasonNumber, name, episodeCount) VALUES (?, ?, ?, ?)
    ON CONFLICT(mediaId, seasonNumber) DO UPDATE SET episodeCount = excluded.episodeCount
  `).bind(media.id, s.season_number, s.name, s.episode_count)))

  const { results: dbSeasons } = await c.env.DB.prepare('SELECT * FROM Season WHERE mediaId = ?').bind(media.id).all()
  const seasonIdByNumber = Object.fromEntries(dbSeasons.map(s => [s.seasonNumber, s.id]))

  // Upsert de tous les épisodes (toutes saisons confondues) en batch(s)
  const episodeStatements = seasonsToSync.flatMap((s, i) =>
    (seasonDataList[i].episodes || []).map(ep => c.env.DB.prepare(`
      INSERT INTO Episode (seasonId, episodeNumber, name, airDate) VALUES (?, ?, ?, ?)
      ON CONFLICT(seasonId, episodeNumber) DO UPDATE SET name = excluded.name, airDate = excluded.airDate
    `).bind(seasonIdByNumber[s.season_number], ep.episode_number, ep.name, ep.air_date))
  )
  if (episodeStatements.length > 0) await batchChunked(c.env.DB, episodeStatements)

  await enrichWithTvmaze(c, media, seasonsToSync, seasonDataList, seasonIdByNumber)

  const { results: seasons } = await c.env.DB.prepare('SELECT * FROM Season WHERE mediaId = ? ORDER BY seasonNumber').bind(media.id).all()
  for (const season of seasons) {
    const { results: episodes } = await c.env.DB.prepare('SELECT * FROM Episode WHERE seasonId = ? ORDER BY episodeNumber').bind(season.id).all()
    season.episodes = episodes
  }
  return c.json(seasons)
})

// Corrige les dates TMDB avec celles de TVmaze et ajoute l'instant exact (airstamp).
//
// Garde-fou : une saison n'est enrichie que si les deux sources sont d'accord sur le
// NOMBRE d'épisodes. TVmaze et TMDB numérotent parfois différemment (épisodes doubles,
// spéciaux) ; en cas de désaccord on collerait la date du mauvais épisode sur le bon.
// Mieux vaut ne rien faire et rester sur TMDB pour cette saison-là.
//
// Best-effort : toute erreur TVmaze est avalée. La synchro TMDB a déjà réussi à ce
// stade, elle ne doit pas échouer parce qu'une source secondaire est indisponible.
async function enrichWithTvmaze(c, media, seasonsToSync, seasonDataList, seasonIdByNumber) {
  try {
    const showId = await resolveTvmazeId(c, media.tmdbId, media)
    if (!showId) return

    const tvEpisodes = await tvmazeJson(`/shows/${showId}/episodes`)
    if (!tvEpisodes?.length) return

    const bySeason = new Map()
    for (const ep of tvEpisodes) {
      if (!bySeason.has(ep.season)) bySeason.set(ep.season, [])
      bySeason.get(ep.season).push(ep)
    }

    const statements = []
    seasonsToSync.forEach((s, i) => {
      const tmdbCount = (seasonDataList[i].episodes || []).length
      const tvList = bySeason.get(s.season_number) || []
      if (tvList.length !== tmdbCount) return // numérotation divergente → on saute cette saison

      const seasonId = seasonIdByNumber[s.season_number]
      for (const ep of tvList) {
        statements.push(c.env.DB.prepare(
          'UPDATE Episode SET airDate = ?, airstamp = ? WHERE seasonId = ? AND episodeNumber = ?'
        ).bind(ep.airdate, ep.airstamp, seasonId, ep.number))
      }
    })

    if (statements.length > 0) await batchChunked(c.env.DB, statements)
  } catch {
    // TVmaze indisponible : on garde les dates TMDB, rien n'est cassé.
  }
}

app.patch('/episodes/:episodeId/watch', async (c) => {
  const { watched } = await c.req.json()
  await c.env.DB.prepare('UPDATE Episode SET watched = ?, watchedAt = ? WHERE id = ?')
    .bind(watched ? 1 : 0, watched ? new Date().toISOString() : null, c.req.param('episodeId')).run()
  const ep = await c.env.DB.prepare('SELECT * FROM Episode WHERE id = ?').bind(c.req.param('episodeId')).first()
  return c.json(ep)
})

app.patch('/episodes/:episodeId/rate', async (c) => {
  const { rating } = await c.req.json()
  await c.env.DB.prepare('UPDATE Episode SET rating = ? WHERE id = ?').bind(rating, c.req.param('episodeId')).run()
  const ep = await c.env.DB.prepare('SELECT * FROM Episode WHERE id = ?').bind(c.req.param('episodeId')).first()
  return c.json(ep)
})

// ── ACTIONS EN MASSE (tout marquer comme vu) ──────────────
// L'état « vu » d'un épisode vit dans les colonnes Episode.watched/watchedAt :
// pas de table de jonction, donc pas d'upsert — un seul UPDATE couvre toute une
// saison ou toute une série, quel que soit le nombre d'épisodes.
//
// Trois invariants encodés dans le SQL ci-dessous :
//  · `watched != ?` ignore les épisodes déjà dans l'état voulu. Ils gardent donc
//    leur watchedAt d'origine : réappuyer sur le bouton ne réécrit pas
//    l'historique du journal ni du Wrapped. Bonus, meta.changes ne compte que les
//    épisodes réellement basculés — c'est le chiffre affiché dans le toast.
//  · Cocher n'affecte que les épisodes DIFFUSÉS (airDate passée). Un airDate NULL
//    compte comme diffusé : TMDB laisse parfois le champ vide sur du vieux contenu.
//    Décocher, lui, ne filtre rien — on nettoie tout, y compris une saisie erronée.
//  · date('now') est évalué par SQLite en UTC. Le décalage avec Paris ne peut
//    jouer que sur un épisode diffusé le jour même : sans risque de le cocher trop tôt.
const bulkUpdateEpisodes = (db, scope, scopeId, flag, now) => db.prepare(`
  UPDATE Episode
  SET watched = ?,
      watchedAt = CASE WHEN ? = 1 THEN ? ELSE NULL END
  WHERE ${scope === 'season' ? 'seasonId = ?' : 'seasonId IN (SELECT id FROM Season WHERE mediaId = ?)'}
    AND watched != ?
    AND (? = 0 OR airDate IS NULL OR airDate <= date('now'))
`).bind(flag, flag, now, scopeId, flag, flag)

app.post('/seasons/:seasonId/watch-all', async (c) => {
  const seasonId = Number(c.req.param('seasonId'))
  const { watched = true } = await c.req.json().catch(() => ({}))

  const season = await c.env.DB.prepare('SELECT id, mediaId FROM Season WHERE id = ?').bind(seasonId).first()
  if (!season) return c.json({ error: 'Season not found' }, 404)

  const flag = watched ? 1 : 0
  const statements = [bulkUpdateEpisodes(c.env.DB, 'season', seasonId, flag, new Date().toISOString())]

  // Boucler une saison entière fait sortir la fiche de la pile « à voir ».
  if (flag === 1) {
    statements.push(c.env.DB.prepare(`
      UPDATE WatchEntry SET status = 'watching', updatedAt = datetime('now')
      WHERE mediaId = ? AND status = 'watchlist'
    `).bind(season.mediaId))
  }

  // .batch() = une seule transaction D1 : épisodes et statut basculent ensemble.
  const [episodes] = await c.env.DB.batch(statements)
  return c.json({ updated: episodes.meta.changes, watched: flag === 1 })
})

app.post('/series/:tmdbId/watch-all', async (c) => {
  const media = await c.env.DB.prepare('SELECT id FROM Media WHERE tmdbId = ?')
    .bind(Number(c.req.param('tmdbId'))).first()
  if (!media) return c.json({ error: 'Media not found' }, 404)

  const { watched = true } = await c.req.json().catch(() => ({}))
  const now = new Date().toISOString()
  const flag = watched ? 1 : 0
  const statements = [bulkUpdateEpisodes(c.env.DB, 'series', media.id, flag, now)]

  if (flag === 1) {
    statements.push(c.env.DB.prepare(`
      UPDATE WatchEntry SET status = 'watched', watchedAt = COALESCE(watchedAt, ?), updatedAt = datetime('now')
      WHERE mediaId = ?
    `).bind(now, media.id))
  }

  const [episodes] = await c.env.DB.batch(statements)
  return c.json({ updated: episodes.meta.changes, watched: flag === 1 })
})

// ── CUSTOM LISTS ──────────────────────────────────────────
app.get('/lists', async (c) => {
  const { results: lists } = await c.env.DB.prepare('SELECT * FROM CustomList ORDER BY createdAt DESC').all()
  for (const list of lists) {
    const { results: items } = await c.env.DB.prepare(`
      SELECT ci.id, ci.addedAt, m.id as mediaId, m.tmdbId, m.mediaType, m.title, m.posterPath, m.voteAverage
      FROM CustomListItem ci JOIN Media m ON ci.mediaId = m.id WHERE ci.listId = ? ORDER BY ci.addedAt DESC
    `).bind(list.id).all()
    list.items = items.map(i => ({
      id: i.id, addedAt: i.addedAt,
      media: { id: i.mediaId, tmdbId: i.tmdbId, mediaType: i.mediaType, title: i.title, posterPath: i.posterPath, voteAverage: i.voteAverage },
    }))
  }
  return c.json(lists)
})

app.post('/lists', async (c) => {
  const { name } = await c.req.json()
  if (!name?.trim()) return c.json({ error: 'Name required' }, 400)
  const { meta } = await c.env.DB.prepare('INSERT INTO CustomList (name) VALUES (?)').bind(name.trim()).run()
  const list = await c.env.DB.prepare('SELECT * FROM CustomList WHERE id = ?').bind(meta.last_row_id).first()
  return c.json({ ...list, items: [] })
})

app.delete('/lists/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM CustomList WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

app.post('/lists/:id/items', async (c) => {
  const { tmdbId } = await c.req.json()
  const media = await c.env.DB.prepare('SELECT * FROM Media WHERE tmdbId = ?').bind(Number(tmdbId)).first()
  if (!media) return c.json({ error: "Media not found — ajoute-le d'abord à ta liste principale" }, 404)

  await c.env.DB.prepare(`
    INSERT INTO CustomListItem (listId, mediaId) VALUES (?, ?)
    ON CONFLICT(listId, mediaId) DO NOTHING
  `).bind(c.req.param('id'), media.id).run()

  const item = await c.env.DB.prepare('SELECT * FROM CustomListItem WHERE listId = ? AND mediaId = ?')
    .bind(c.req.param('id'), media.id).first()
  return c.json({ ...item, media })
})

app.delete('/lists/:id/items/:mediaId', async (c) => {
  await c.env.DB.prepare('DELETE FROM CustomListItem WHERE listId = ? AND mediaId = ?')
    .bind(c.req.param('id'), c.req.param('mediaId')).run()
  return c.json({ ok: true })
})

// ── STATS ─────────────────────────────────────────────────
app.get('/stats', async (c) => {
  // On rapatrie la progression épisode avec chaque fiche : le statut déclaré ne dit pas
  // la vérité (il annonçait « 0 série vue » alors que 473 épisodes étaient vus).
  const { results: entries } = await c.env.DB.prepare(`
    SELECT w.status, w.rating, w.updatedAt, m.mediaType, m.runtime, m.genres, m.director,
           COALESCE(SUM(COALESCE(e.watched, 0)), 0) AS epWatched
    FROM WatchEntry w
    JOIN Media m ON w.mediaId = m.id
    LEFT JOIN Season s ON s.mediaId = m.id
    LEFT JOIN Episode e ON e.seasonId = s.id
    GROUP BY w.id
  `).all()

  const { results: episodes } = await c.env.DB.prepare('SELECT id, watchedAt FROM Episode WHERE watched = 1').all()

  // « Compte dans mes stats » :
  //  · un film, s'il est marqué vu — un film n'a pas d'épisodes, le statut reste la
  //    seule information disponible, et on pense à le cocher pour un film ;
  //  · une série, dès qu'on en a vu AU MOINS UN épisode — c'est ça, « suivre » une série.
  //    Exiger qu'elle soit terminée viderait les genres favoris de quiconque regarde
  //    des séries en cours.
  const counts = (e) => e.mediaType === 'movie' ? e.status === 'watched' : e.epWatched > 0
  const watched = entries.filter(counts)
  const movies = watched.filter(e => e.mediaType === 'movie')
  const series = watched.filter(e => e.mediaType === 'tv')
  const movieMinutes = movies.reduce((a, e) => a + (e.runtime || 0), 0)
  const tvMinutes = episodes.length * 40

  const genreCount = {}
  for (const e of watched) {
    const genres = JSON.parse(e.genres || '[]')
    for (const g of genres) genreCount[g] = (genreCount[g] || 0) + 1
  }
  const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))

  const directorCount = {}
  for (const e of watched) {
    if (!e.director) continue
    directorCount[e.director] = (directorCount[e.director] || 0) + 1
  }
  const topDirectors = Object.entries(directorCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))

  const rated = watched.filter(e => e.rating)
  const avgRating = rated.length ? rated.reduce((s, e) => s + e.rating, 0) / rated.length : 0

  // Activité mensuelle sur 12 mois glissants (basée sur updatedAt)
  const now = new Date()
  const monthlyActivity = Array.from({ length: 12 }, (_, i) => {
    const year = now.getFullYear()
    const month = now.getMonth() - 11 + i // peut être négatif, Date le gère
    const d = new Date(year, month, 1)
    const yStr = d.getFullYear().toString()
    const mStr = String(d.getMonth() + 1).padStart(2, '0')
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    const count = entries.filter(e => {
      const ua = e.updatedAt || ''
      return ua.startsWith(`${yStr}-${mStr}`)
    }).length
    return { label, count }
  })

  // Heatmap quotidienne (90 derniers jours)
  const dailyMap = {}
  for (const e of entries) {
    const key = (e.updatedAt || '').slice(0, 10)
    if (key) dailyMap[key] = (dailyMap[key] || 0) + 1
  }
  for (const ep of episodes) {
    const key = (ep.watchedAt || '').slice(0, 10)
    if (key) dailyMap[key] = (dailyMap[key] || 0) + 1
  }
  const dailyActivity = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (89 - i))
    const key = d.toISOString().slice(0, 10)
    return { date: key, count: dailyMap[key] || 0 }
  })

  return c.json({
    totalWatched: watched.length,
    movies: movies.length,
    series: series.length,
    episodesWatched: episodes.length,
    minutesWatched: movieMinutes + tvMinutes,
    watchlist: entries.filter(e => e.status === 'watchlist').length,
    watching: entries.filter(e => e.status === 'watching').length,
    avgRating,
    topGenres,
    topDirectors,
    monthlyActivity,
    dailyActivity,
  })
})

app.get('/stats/journal', async (c) => {
  const { results: movieEntries } = await c.env.DB.prepare(`
    SELECT w.rating, w.watchedAt, w.updatedAt, m.mediaType, m.title, m.posterPath, m.tmdbId
    FROM WatchEntry w JOIN Media m ON w.mediaId = m.id WHERE w.status = 'watched'
  `).all()

  const { results: episodeEntries } = await c.env.DB.prepare(`
    SELECT e.rating, e.watchedAt, e.episodeNumber, e.name, s.seasonNumber, m.title, m.posterPath, m.tmdbId
    FROM Episode e JOIN Season s ON e.seasonId = s.id JOIN Media m ON s.mediaId = m.id WHERE e.watched = 1
  `).all()

  const journal = [
    ...movieEntries.map(e => ({
      date: e.watchedAt || e.updatedAt,
      type: e.mediaType, title: e.title, posterPath: e.posterPath, tmdbId: e.tmdbId,
      rating: e.rating, detail: null,
    })),
    ...episodeEntries.filter(ep => ep.watchedAt).map(ep => ({
      date: ep.watchedAt,
      type: 'tv', title: ep.title, posterPath: ep.posterPath, tmdbId: ep.tmdbId,
      rating: ep.rating, detail: `S${ep.seasonNumber}E${ep.episodeNumber}${ep.name ? ' — ' + ep.name : ''}`,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  return c.json(journal)
})

app.get('/stats/wrapped', async (c) => {
  const year = String(Number(c.req.query('year')) || new Date().getFullYear())
  const db = c.env.DB

  // Temps + volume : films watched dans l'année + épisodes vus dans l'année,
  // agrégés directement en SQL (SUM/COUNT côté D1, pas de rapatriement de lignes).
  const totalsQuery = db.prepare(`
    SELECT
      COUNT(CASE WHEN m.mediaType = 'movie' THEN 1 END) AS moviesWatched,
      COUNT(CASE WHEN m.mediaType = 'tv' THEN 1 END) AS seriesWatched,
      COALESCE(SUM(CASE WHEN m.mediaType = 'movie' THEN m.runtime ELSE 0 END), 0) AS movieMinutes
    FROM WatchEntry w
    JOIN Media m ON w.mediaId = m.id
    WHERE w.status = 'watched'
      AND strftime('%Y', COALESCE(w.watchedAt, w.updatedAt)) = ?
  `).bind(year)

  // Épisodes vus + nombre de séries distinctes touchées cette année — basé
  // sur l'activité épisode par épisode, indépendamment du statut de la fiche
  // (une série "en cours" compte si des épisodes ont été vus dans l'année).
  const episodesQuery = db.prepare(`
    SELECT COUNT(*) AS episodesWatched, COUNT(DISTINCT s.mediaId) AS distinctSeries
    FROM Episode e
    JOIN Season s ON e.seasonId = s.id
    WHERE e.watched = 1 AND strftime('%Y', e.watchedAt) = ?
  `).bind(year)

  // Top 3 genres : json_each() explose le tableau JSON stocké dans Media.genres
  // directement en SQL — pas besoin d'une table de jonction ni de JSON.parse() en JS.
  const topGenresQuery = db.prepare(`
    SELECT je.value AS name, COUNT(*) AS count
    FROM WatchEntry w
    JOIN Media m ON w.mediaId = m.id
    JOIN json_each(m.genres) je
    WHERE w.status = 'watched' AND strftime('%Y', COALESCE(w.watchedAt, w.updatedAt)) = ?
    GROUP BY je.value
    ORDER BY count DESC
    LIMIT 3
  `).bind(year)

  // Titre le mieux noté de l'année
  const topRatedQuery = db.prepare(`
    SELECT m.title, w.rating, m.posterPath
    FROM WatchEntry w JOIN Media m ON w.mediaId = m.id
    WHERE w.status = 'watched' AND w.rating IS NOT NULL
      AND strftime('%Y', COALESCE(w.watchedAt, w.updatedAt)) = ?
    ORDER BY w.rating DESC
    LIMIT 1
  `).bind(year)

  // Répartition mensuelle (films/séries watched + épisodes vus, unifiés) pour le graphique
  const monthlyQuery = db.prepare(`
    SELECT month, SUM(count) AS count FROM (
      SELECT strftime('%m', COALESCE(w.watchedAt, w.updatedAt)) AS month, COUNT(*) AS count
      FROM WatchEntry w
      WHERE w.status = 'watched' AND strftime('%Y', COALESCE(w.watchedAt, w.updatedAt)) = ?
      GROUP BY month
      UNION ALL
      SELECT strftime('%m', e.watchedAt) AS month, COUNT(*) AS count
      FROM Episode e
      WHERE e.watched = 1 AND strftime('%Y', e.watchedAt) = ?
      GROUP BY month
    )
    GROUP BY month
    ORDER BY month
  `).bind(year, year)

  const [totals, episodesRow, topGenres, topRatedRow, monthlyRows] = await Promise.all([
    totalsQuery.first(),
    episodesQuery.first(),
    topGenresQuery.all().then(r => r.results),
    topRatedQuery.first(),
    monthlyQuery.all().then(r => r.results),
  ])

  // Comble les mois sans activité (0) pour un graphique linéaire à 12 points fixes
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
  const monthlyMap = Object.fromEntries(monthlyRows.map(r => [r.month, r.count]))
  const monthlyBreakdown = monthNames.map((label, i) => ({
    label,
    count: monthlyMap[String(i + 1).padStart(2, '0')] || 0,
  }))
  const topMonth = monthlyBreakdown.reduce((best, m) => (m.count > best.count ? m : best), monthlyBreakdown[0])

  const minutesWatched = totals.movieMinutes + episodesRow.episodesWatched * 40

  return c.json({
    year: Number(year),
    moviesWatched: totals.moviesWatched,
    seriesWatched: totals.seriesWatched,
    distinctSeries: episodesRow.distinctSeries,
    episodesWatched: episodesRow.episodesWatched,
    minutesWatched,
    topGenres,
    topGenre: topGenres[0]?.name || null,
    topRated: topRatedRow ? { title: topRatedRow.title, rating: topRatedRow.rating, posterPath: topRatedRow.posterPath } : null,
    monthlyBreakdown,
    topMonth: topMonth.count > 0 ? topMonth : null,
  })
})

app.get('/health', (c) => c.json({ ok: true }))

export const onRequest = (context) => app.fetch(context.request, context.env, context)
