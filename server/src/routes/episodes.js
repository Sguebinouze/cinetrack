const router = require('express').Router()
const prisma = require('../lib/prisma')
const tmdb = require('../services/tmdb')

// POST /api/episodes/sync/:tmdbId — synchro les saisons depuis TMDB
router.post('/sync/:tmdbId', async (req, res) => {
  try {
    const media = await prisma.media.findUnique({ where: { tmdbId: Number(req.params.tmdbId) } })
    if (!media) return res.status(404).json({ error: 'Media not found' })

    const tvDetail = await tmdb.getTvDetail(req.params.tmdbId)
    const seasonsToSync = (tvDetail.seasons || []).filter(s => s.season_number !== 0)

    // Récupère toutes les saisons EN PARALLÈLE — un fetch séquentiel par saison
    // pouvait prendre 20-30s+ pour une série à nombreuses saisons (ex. Les Simpson).
    const seasonDataList = await Promise.all(
      seasonsToSync.map(s => tmdb.getTvSeason(req.params.tmdbId, s.season_number))
    )

    for (let i = 0; i < seasonsToSync.length; i++) {
      const s = seasonsToSync[i]
      const season = await prisma.season.upsert({
        where: { mediaId_seasonNumber: { mediaId: media.id, seasonNumber: s.season_number } },
        update: { episodeCount: s.episode_count },
        create: {
          mediaId: media.id,
          seasonNumber: s.season_number,
          name: s.name,
          episodeCount: s.episode_count,
        },
      })

      for (const ep of seasonDataList[i].episodes || []) {
        await prisma.episode.upsert({
          where: { seasonId_episodeNumber: { seasonId: season.id, episodeNumber: ep.episode_number } },
          update: { name: ep.name, airDate: ep.air_date },
          create: {
            seasonId: season.id,
            episodeNumber: ep.episode_number,
            name: ep.name,
            airDate: ep.air_date,
          },
        })
      }
    }

    const seasons = await prisma.season.findMany({
      where: { mediaId: media.id },
      include: { episodes: { orderBy: { episodeNumber: 'asc' } } },
      orderBy: { seasonNumber: 'asc' },
    })
    res.json(seasons)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/episodes/:tmdbId — récupérer les saisons locales
router.get('/:tmdbId', async (req, res) => {
  try {
    const media = await prisma.media.findUnique({ where: { tmdbId: Number(req.params.tmdbId) } })
    if (!media) return res.status(404).json({ error: 'Media not found' })

    const seasons = await prisma.season.findMany({
      where: { mediaId: media.id },
      include: { episodes: { orderBy: { episodeNumber: 'asc' } } },
      orderBy: { seasonNumber: 'asc' },
    })
    res.json(seasons)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/episodes/:episodeId/watch — marquer un épisode comme vu
router.patch('/:episodeId/watch', async (req, res) => {
  try {
    const { watched } = req.body
    const episode = await prisma.episode.update({
      where: { id: Number(req.params.episodeId) },
      data: {
        watched,
        watchedAt: watched ? new Date() : null,
      },
    })
    res.json(episode)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/episodes/:episodeId/rate — noter un épisode
router.patch('/:episodeId/rate', async (req, res) => {
  try {
    const { rating } = req.body
    const episode = await prisma.episode.update({
      where: { id: Number(req.params.episodeId) },
      data: { rating },
    })
    res.json(episode)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
