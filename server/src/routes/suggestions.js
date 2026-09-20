const router = require('express').Router()
const prisma = require('../lib/prisma')
const tmdb = require('../services/tmdb')

// Miroir dev de la section « SUGGESTIONS PERSONNALISÉES » de functions/api/[[path]].js.
//
// On part de ce qui a RÉELLEMENT été regardé (compteurs d'épisodes, pas le statut
// déclaré) et on agrège les recommandations TMDB de chaque titre. Un titre
// recommandé par plusieurs séries de la bibliothèque remonte.

const SEED_LIMIT = 12
const SUGGESTION_LIMIT = 30

// Un poster manquant fait un trou dans la grille ; sous 10 votes, TMDB recommande
// surtout des obscurités non traduites.
const suggestable = (item) => item.poster_path && (item.vote_count || 0) >= 10

// GET /api/suggestions — recommandations déduites de la bibliothèque
router.get('/', async (req, res) => {
  try {
    const entries = await prisma.watchEntry.findMany({
      where: { NOT: { status: 'dropped' } },
      include: { media: { include: { seasons: { include: { episodes: { select: { watched: true } } } } } } },
    })

    // Une série n'est une graine qu'à partir du premier épisode vu ; un film, qu'une
    // fois déclaré vu — il n'a pas d'épisodes pour trancher à sa place.
    const seeds = entries
      .filter(e => e.media.mediaType === 'movie'
        ? e.status === 'watched'
        : e.media.seasons.some(s => s.episodes.some(ep => ep.watched)))
      .sort((a, b) => {
        if ((a.rating == null) !== (b.rating == null)) return a.rating == null ? 1 : -1
        if (a.rating !== b.rating) return (b.rating || 0) - (a.rating || 0)
        return new Date(b.updatedAt) - new Date(a.updatedAt)
      })
      .slice(0, SEED_LIMIT)

    const owned = await prisma.media.findMany({ select: { tmdbId: true } })
    const ownedIds = new Set(owned.map(m => m.tmdbId))

    // Bibliothèque vide ou rien de commencé : on retombe sur les tendances plutôt
    // que de renvoyer une page vide.
    if (!seeds.length) {
      const trending = await tmdb.getTrending('tv', 'week')
      return res.json({
        personalized: false,
        seeds: 0,
        results: trending.filter(suggestable).map(r => ({ ...r, media_type: 'tv' })),
      })
    }

    // Promise.all, jamais d'await en boucle. Une graine qui échoue est ignorée.
    const lists = await Promise.all(seeds.map(seed =>
      tmdb.getRecommendations(seed.media.mediaType, seed.media.tmdbId)
        .then(results => ({ seed, results: results || [] }))
        .catch(() => ({ seed, results: [] }))
    ))

    const scored = new Map()
    for (const { seed, results } of lists) {
      for (const item of results) {
        if (ownedIds.has(item.id) || !suggestable(item)) continue
        const hit = scored.get(item.id)
        if (hit) hit.score += 1
        else scored.set(item.id, { item: { ...item, media_type: seed.media.mediaType }, score: 1 })
      }
    }

    const results = [...scored.values()]
      .sort((a, b) =>
        b.score - a.score ||
        (b.item.vote_average || 0) - (a.item.vote_average || 0) ||
        (b.item.popularity || 0) - (a.item.popularity || 0))
      .slice(0, SUGGESTION_LIMIT)
      .map(({ item, score }) => ({ ...item, recommendedBy: score }))

    res.json({ personalized: true, seeds: seeds.length, results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
