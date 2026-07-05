const router = require('express').Router()
const prisma = require('../lib/prisma')
const tmdb = require('../services/tmdb')

// GET /api/watchlist — liste complète
router.get('/', async (req, res) => {
  try {
    const { status } = req.query
    const entries = await prisma.watchEntry.findMany({
      where: status ? { status } : undefined,
      include: { media: true },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(entries)
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
