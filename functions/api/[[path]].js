import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono().basePath('/api')

app.use('*', cors({ origin: '*' }))

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

app.get('/tmdb/search', async (c) => {
  const q = c.req.query('q')
  if (!q) return c.json({ error: 'Query required' }, 400)
  const data = await tmdb(c.env).get('/search/multi', { query: q, include_adult: false })
  return c.json((data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv'))
})

app.get('/tmdb/trending', async (c) => {
  const type = c.req.query('type') || 'all'
  const window = c.req.query('window') || 'week'
  const data = await tmdb(c.env).get(`/trending/${type}/${window}`)
  return c.json(data.results || [])
})

app.get('/tmdb/anime/trending', async (c) => {
  const data = await tmdb(c.env).get('/discover/tv', {
    with_genres: 16,
    with_origin_country: 'JP',
    sort_by: 'popularity.desc',
  })
  return c.json(data.results || [])
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
  return c.json(data.results || [])
})

app.get('/tmdb/:mediaType/:id/watch-providers', async (c) => {
  const { mediaType, id } = c.req.param()
  if (!['movie', 'tv'].includes(mediaType)) return c.json({ error: 'Invalid mediaType' }, 400)
  const data = await tmdb(c.env).get(`/${mediaType}/${id}/watch/providers`)
  return c.json(data.results?.FR || null)
})

// ── WATCHLIST ─────────────────────────────────────────────
app.get('/watchlist', async (c) => {
  const status = c.req.query('status')
  const query = status
    ? 'SELECT w.*, m.tmdbId, m.mediaType, m.title, m.posterPath, m.backdropPath, m.overview, m.releaseDate, m.genres, m.runtime, m.voteAverage, m.director, m.isAnime FROM WatchEntry w JOIN Media m ON w.mediaId = m.id WHERE w.status = ? ORDER BY w.updatedAt DESC'
    : 'SELECT w.*, m.tmdbId, m.mediaType, m.title, m.posterPath, m.backdropPath, m.overview, m.releaseDate, m.genres, m.runtime, m.voteAverage, m.director, m.isAnime FROM WatchEntry w JOIN Media m ON w.mediaId = m.id ORDER BY w.updatedAt DESC'

  const { results } = status
    ? await c.env.DB.prepare(query).bind(status).all()
    : await c.env.DB.prepare(query).all()

  return c.json(results.map(row => ({
    id: row.id, status: row.status, rating: row.rating,
    reviewPrivate: row.reviewPrivate, reviewPublic: row.reviewPublic,
    watchedAt: row.watchedAt, addedAt: row.addedAt, updatedAt: row.updatedAt,
    media: {
      id: row.mediaId, tmdbId: row.tmdbId, mediaType: row.mediaType,
      title: row.title, posterPath: row.posterPath, backdropPath: row.backdropPath,
      overview: row.overview, releaseDate: row.releaseDate,
      genres: row.genres, runtime: row.runtime, voteAverage: row.voteAverage,
      director: row.director, isAnime: !!row.isAnime,
    }
  })))
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
  for (const s of (tvDetail.seasons || [])) {
    if (s.season_number === 0) continue
    await c.env.DB.prepare(`
      INSERT INTO Season (mediaId, seasonNumber, name, episodeCount) VALUES (?, ?, ?, ?)
      ON CONFLICT(mediaId, seasonNumber) DO UPDATE SET episodeCount = excluded.episodeCount
    `).bind(media.id, s.season_number, s.name, s.episode_count).run()

    const season = await c.env.DB.prepare('SELECT * FROM Season WHERE mediaId = ? AND seasonNumber = ?').bind(media.id, s.season_number).first()
    const seasonData = await tmdb(c.env).get(`/tv/${c.req.param('tmdbId')}/season/${s.season_number}`)
    for (const ep of (seasonData.episodes || [])) {
      await c.env.DB.prepare(`
        INSERT INTO Episode (seasonId, episodeNumber, name, airDate) VALUES (?, ?, ?, ?)
        ON CONFLICT(seasonId, episodeNumber) DO UPDATE SET name = excluded.name, airDate = excluded.airDate
      `).bind(season.id, ep.episode_number, ep.name, ep.air_date).run()
    }
  }

  const { results: seasons } = await c.env.DB.prepare('SELECT * FROM Season WHERE mediaId = ? ORDER BY seasonNumber').bind(media.id).all()
  for (const season of seasons) {
    const { results: episodes } = await c.env.DB.prepare('SELECT * FROM Episode WHERE seasonId = ? ORDER BY episodeNumber').bind(season.id).all()
    season.episodes = episodes
  }
  return c.json(seasons)
})

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
  const { results: entries } = await c.env.DB.prepare(`
    SELECT w.status, w.rating, w.updatedAt, m.mediaType, m.runtime, m.genres, m.director
    FROM WatchEntry w JOIN Media m ON w.mediaId = m.id
  `).all()

  const { results: episodes } = await c.env.DB.prepare('SELECT id, watchedAt FROM Episode WHERE watched = 1').all()

  const watched = entries.filter(e => e.status === 'watched')
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
  const year = Number(c.req.query('year')) || new Date().getFullYear()

  const { results: entries } = await c.env.DB.prepare(`
    SELECT w.rating, w.watchedAt, w.updatedAt, m.mediaType, m.runtime, m.genres, m.title, m.posterPath
    FROM WatchEntry w JOIN Media m ON w.mediaId = m.id WHERE w.status = 'watched'
  `).all()

  const { results: episodes } = await c.env.DB.prepare(`
    SELECT e.watchedAt, m.title FROM Episode e JOIN Season s ON e.seasonId = s.id JOIN Media m ON s.mediaId = m.id WHERE e.watched = 1
  `).all()

  const inYear = (d) => d && new Date(d).getFullYear() === year
  const yearEntries = entries.filter(e => inYear(e.watchedAt || e.updatedAt))
  const yearEpisodes = episodes.filter(ep => inYear(ep.watchedAt))

  const movies = yearEntries.filter(e => e.mediaType === 'movie')
  const series = yearEntries.filter(e => e.mediaType === 'tv')
  const movieMinutes = movies.reduce((a, e) => a + (e.runtime || 0), 0)
  const tvMinutes = yearEpisodes.length * 40

  const genreCount = {}
  for (const e of yearEntries) {
    for (const g of JSON.parse(e.genres || '[]')) genreCount[g] = (genreCount[g] || 0) + 1
  }
  const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  const rated = yearEntries.filter(e => e.rating)
  const topRated = [...rated].sort((a, b) => b.rating - a.rating)[0]

  const distinctSeries = new Set(yearEpisodes.map(ep => ep.title))

  return c.json({
    year,
    moviesWatched: movies.length,
    seriesWatched: series.length,
    episodesWatched: yearEpisodes.length,
    distinctSeries: distinctSeries.size,
    minutesWatched: movieMinutes + tvMinutes,
    topGenre,
    topRated: topRated ? { title: topRated.title, rating: topRated.rating, posterPath: topRated.posterPath } : null,
  })
})

app.get('/health', (c) => c.json({ ok: true }))

export const onRequest = (context) => app.fetch(context.request, context.env, context)
