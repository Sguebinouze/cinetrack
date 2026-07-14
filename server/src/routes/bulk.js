const router = require('express').Router()
const prisma = require('../lib/prisma')

// Miroir dev (Prisma/SQLite) des endpoints /watch-all de functions/api/[[path]].js.
// Mêmes invariants : on ne coche que les épisodes diffusés (airDate NULL = diffusé),
// on décoche sans filtre de date, et les épisodes déjà dans l'état voulu ne sont pas
// réécrits — ils conservent leur watchedAt d'origine (journal / Wrapped intacts).
const today = () => new Date().toISOString().slice(0, 10)

/** updateMany n'accepte que des filtres scalaires : la portée est toujours une liste de seasonId. */
const bulkUpdateEpisodes = (tx, seasonIds, watched) => tx.episode.updateMany({
  where: {
    seasonId: { in: seasonIds },
    watched: !watched, // seuls les épisodes qui basculent réellement
    ...(watched ? { OR: [{ airDate: null }, { airDate: { lte: today() } }] } : {}),
  },
  data: { watched, watchedAt: watched ? new Date() : null },
})

// POST /api/seasons/:seasonId/watch-all — cocher/décocher une saison entière
router.post('/seasons/:seasonId/watch-all', async (req, res) => {
  try {
    const seasonId = Number(req.params.seasonId)
    const watched = req.body?.watched ?? true

    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season) return res.status(404).json({ error: 'Season not found' })

    const updated = await prisma.$transaction(async (tx) => {
      const { count } = await bulkUpdateEpisodes(tx, [seasonId], watched)
      // Boucler une saison entière fait sortir la fiche de la pile « à voir ».
      if (watched) {
        await tx.watchEntry.updateMany({
          where: { mediaId: season.mediaId, status: 'watchlist' },
          data: { status: 'watching' },
        })
      }
      return count
    })

    res.json({ updated, watched })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/series/:tmdbId/watch-all — cocher/décocher toute la série
router.post('/series/:tmdbId/watch-all', async (req, res) => {
  try {
    const watched = req.body?.watched ?? true

    const media = await prisma.media.findUnique({ where: { tmdbId: Number(req.params.tmdbId) } })
    if (!media) return res.status(404).json({ error: 'Media not found' })

    const seasons = await prisma.season.findMany({ where: { mediaId: media.id }, select: { id: true } })
    const seasonIds = seasons.map(s => s.id)

    const updated = await prisma.$transaction(async (tx) => {
      const { count } = await bulkUpdateEpisodes(tx, seasonIds, watched)
      if (watched) {
        const entry = await tx.watchEntry.findUnique({ where: { mediaId: media.id } })
        if (entry) {
          await tx.watchEntry.update({
            where: { mediaId: media.id },
            // watchedAt existant préservé (équivalent du COALESCE côté D1).
            data: { status: 'watched', watchedAt: entry.watchedAt ?? new Date() },
          })
        }
      }
      return count
    })

    res.json({ updated, watched })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
