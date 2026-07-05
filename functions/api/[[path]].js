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

// ── WATCHLIST ─────────────────────────────────────────────
app.get('/watchlist', async (c) => {
  const status = c.req.query('status')
  const query = status
    ? 'SELECT w.*, m.tmdbId, m.mediaType, m.title, m.posterPath, m.backdropPath, m.overview, m.releaseDate, m.genres, m.runtime, m.voteAverage FROM WatchEntry w JOIN Media m ON w.mediaId = m.id WHERE w.status = ? ORDER BY w.updatedAt DESC'
    : 'SELECT w.*, m.tmdbId, m.mediaType, m.title, m.posterPath, m.backdropPath, m.overview, m.releaseDate, m.genres, m.runtime, m.voteAverage FROM WatchEntry w JOIN Media m ON w.mediaId = m.id ORDER BY w.updatedAt DESC'

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
    }
  })))
})

app.post('/watchlist', async (c) => {
  const { tmdbId, mediaType, status = 'watchlist' } = await c.req.json()
  if (!tmdbId || !mediaType) return c.json({ error: 'tmdbId and mediaType required' }, 400)

  const detail = await tmdb(c.env).get(
    mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`,
    { append_to_response: 'genres' }
  )

  const title = detail.title || detail.name
  const releaseDate = detail.release_date || detail.first_air_date
  const runtime = detail.runtime || detail.episode_run_time?.[0] || null
  const genres = JSON.stringify((detail.genres || []).map(g => g.name))

  // Upsert Media
  await c.env.DB.prepare(`
    INSERT INTO Media (tmdbId, mediaType, title, posterPath, backdropPath, overview, releaseDate, genres, runtime, voteAverage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tmdbId) DO NOTHING
  `).bind(Number(tmdbId), mediaType, title, detail.poster_path, detail.backdrop_path,
    detail.overview, releaseDate, genres, runtime, detail.vote_average).run()

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

// ── STATS ─────────────────────────────────────────────────
app.get('/stats', async (c) => {
  const { results: entries } = await c.env.DB.prepare(`
    SELECT w.status, w.rating, w.updatedAt, m.mediaType, m.runtime, m.genres
    FROM WatchEntry w JOIN Media m ON w.mediaId = m.id
  `).all()

  const { results: episodes } = await c.env.DB.prepare('SELECT id FROM Episode WHERE watched = 1').all()

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

  const rated = watched.filter(e => e.rating)
  const avgRating = rated.length ? rated.reduce((s, e) => s + e.rating, 0) / rated.length : 0

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
    monthlyActivity: [],
  })
})

app.get('/health', (c) => c.json({ ok: true }))

export const onRequest = app.fetch
