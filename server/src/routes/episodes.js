const router = require('express').Router()
const prisma = require('../lib/prisma')
const tmdb = require('../services/tmdb')
const tvmaze = require('../services/tvmaze')

// Corrige les dates TMDB avec celles de TVmaze et ajoute l'instant exact (airstamp).
//
// Garde-fou : une saison n'est enrichie que si les deux sources sont d'accord sur le
// NOMBRE d'épisodes. TVmaze et TMDB numérotent parfois différemment (épisodes doubles,
// spéciaux) ; en cas de désaccord on collerait la date du mauvais épisode sur le bon.
// Mieux vaut ne rien faire et rester sur TMDB pour cette saison-là.
//
// Best-effort : toute erreur TVmaze est avalée. La synchro TMDB a déjà réussi à ce
// stade, elle ne doit pas échouer parce qu'une source secondaire est indisponible.
async function enrichWithTvmaze(media, seasonsToSync, seasonDataList) {
  try {
    let showId = media.tvmazeId
    if (!showId) {
      showId = await tvmaze.resolveShowId(media.tmdbId)
      if (!showId) return
      await prisma.media.update({ where: { id: media.id }, data: { tvmazeId: showId } })
    }

    const tvEpisodes = await tvmaze.getEpisodes(showId)
    if (!tvEpisodes?.length) return

    const bySeason = new Map()
    for (const ep of tvEpisodes) {
      if (!bySeason.has(ep.season)) bySeason.set(ep.season, [])
      bySeason.get(ep.season).push(ep)
    }

    for (let i = 0; i < seasonsToSync.length; i++) {
      const num = seasonsToSync[i].season_number
      const tmdbCount = (seasonDataList[i].episodes || []).length
      const tvList = bySeason.get(num) || []
      if (tvList.length !== tmdbCount) continue // numérotation divergente → on saute

      const season = await prisma.season.findUnique({
        where: { mediaId_seasonNumber: { mediaId: media.id, seasonNumber: num } },
      })
      if (!season) continue

      await prisma.$transaction(tvList.map(ep => prisma.episode.updateMany({
        where: { seasonId: season.id, episodeNumber: ep.number },
        data: { airDate: ep.airdate, airstamp: ep.airstamp },
      })))
    }
  } catch {
    // TVmaze indisponible : on garde les dates TMDB, rien n'est cassé.
  }
}

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

    await enrichWithTvmaze(media, seasonsToSync, seasonDataList)

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
