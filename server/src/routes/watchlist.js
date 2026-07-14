const router = require('express').Router()
const prisma = require('../lib/prisma')
const tmdb = require('../services/tmdb')

// La progression épisode est agrégée en SQL et renvoyée avec chaque fiche : « Ma liste »
// en a besoin pour TRIER (séries à rattraper en premier). Le statut déclaré n'est plus la
// source de vérité — l'état réel se déduit de ces compteurs (client/src/utils/progress.js).
//
// $queryRaw plutôt qu'une reconstruction Prisma : c'est exactement le même SQL que le
// backend D1 de prod, donc les deux ne peuvent pas diverger silencieusement.
const WATCHLIST_QUERY = `
  SELECT w.id, w.status, w.rating, w.reviewPrivate, w.reviewPublic, w.watchedAt, w.addedAt, w.updatedAt,
         m.id AS mediaId, m.tmdbId, m.mediaType, m.title, m.posterPath, m.backdropPath, m.overview,
         m.releaseDate, m.genres, m.runtime, m.voteAverage, m.director, m.isAnime,
         COUNT(e.id) AS epTotal,
         COALESCE(SUM(CASE WHEN e.airDate IS NULL OR e.airDate <= date('now') THEN 1 ELSE 0 END), 0) AS epAired,
         COALESCE(SUM(COALESCE(e.watched, 0)), 0) AS epWatched,
         MAX(CASE WHEN e.watched = 0 AND (e.airDate IS NULL OR e.airDate <= date('now')) THEN e.airDate END) AS epLastUnwatched
  FROM WatchEntry w
  JOIN Media m ON w.mediaId = m.id
  LEFT JOIN Season s ON s.mediaId = m.id
  LEFT JOIN Episode e ON e.seasonId = s.id
`

// SQLite renvoie les COUNT/SUM en BigInt via Prisma : on repasse en Number, sinon
// JSON.stringify explose (« Do not know how to serialize a BigInt »).
const num = (v) => Number(v ?? 0)

const toEntry = (row) => ({
  id: num(row.id), status: row.status, rating: row.rating,
  reviewPrivate: row.reviewPrivate, reviewPublic: row.reviewPublic,
  watchedAt: row.watchedAt, addedAt: row.addedAt, updatedAt: row.updatedAt,
  media: {
    id: num(row.mediaId), tmdbId: num(row.tmdbId), mediaType: row.mediaType,
    title: row.title, posterPath: row.posterPath, backdropPath: row.backdropPath,
    overview: row.overview, releaseDate: row.releaseDate,
    genres: row.genres, runtime: row.runtime, voteAverage: row.voteAverage,
    director: row.director, isAnime: !!row.isAnime,
  },
  episodes: {
    total: num(row.epTotal),
    aired: num(row.epAired),
    watched: num(row.epWatched),
    lastUnwatchedAirDate: row.epLastUnwatched,
  },
})

// GET /api/watchlist — liste complète, avec progression
router.get('/', async (req, res) => {
  try {
    const { status } = req.query
    const rows = status
      ? await prisma.$queryRawUnsafe(`${WATCHLIST_QUERY} WHERE w.status = ? GROUP BY w.id ORDER BY w.updatedAt DESC`, status)
      : await prisma.$queryRawUnsafe(`${WATCHLIST_QUERY} GROUP BY w.id ORDER BY w.updatedAt DESC`)
    res.json(rows.map(toEntry))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/watchlist — ajouter un titre
router.post('/', async (req, res) => {
  try {
    const { tmdbId, mediaType, status = 'watchlist' } = req.body
    if (!tmdbId || !mediaType) return res.status(400).json({ error: 'tmdbId and mediaType required' })

    // Récupérer les données TMDB et upsert le Media
    const detail = mediaType === 'movie'
      ? await tmdb.getMovieDetail(tmdbId)
      : await tmdb.getTvDetail(tmdbId)

    const director = mediaType === 'movie'
      ? detail.credits?.crew?.find(c => c.job === 'Director')?.name || null
      : detail.created_by?.[0]?.name || null
    const isAnime = (detail.genres || []).some(g => g.name === 'Animation')
      && (detail.origin_country?.includes('JP') || detail.original_language === 'ja')

    const media = await prisma.media.upsert({
      where: { tmdbId: Number(tmdbId) },
      update: {},
      create: {
        tmdbId: Number(tmdbId),
        mediaType,
        title: detail.title || detail.name,
        posterPath: detail.poster_path,
        backdropPath: detail.backdrop_path,
        overview: detail.overview,
        releaseDate: detail.release_date || detail.first_air_date,
        genres: JSON.stringify((detail.genres || []).map(g => g.name)),
        runtime: detail.runtime || detail.episode_run_time?.[0] || null,
        voteAverage: detail.vote_average,
        director,
        isAnime,
      },
    })

    const entry = await prisma.watchEntry.upsert({
      where: { mediaId: media.id },
      update: { status },
      create: { mediaId: media.id, status },
      include: { media: true },
    })

    res.json(entry)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/watchlist/:id — mettre à jour statut, note, avis
router.patch('/:id', async (req, res) => {
  try {
    const { status, rating, reviewPrivate, reviewPublic, watchedAt } = req.body
    const entry = await prisma.watchEntry.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(status !== undefined && { status }),
        ...(rating !== undefined && { rating }),
        ...(reviewPrivate !== undefined && { reviewPrivate }),
        ...(reviewPublic !== undefined && { reviewPublic }),
        ...(watchedAt !== undefined && { watchedAt: new Date(watchedAt) }),
      },
      include: { media: true },
    })
    res.json(entry)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/watchlist/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.watchEntry.delete({ where: { id: Number(req.params.id) } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
