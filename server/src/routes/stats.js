const router = require('express').Router()
const prisma = require('../lib/prisma')

router.get('/', async (req, res) => {
  try {
    const [entries, episodes] = await Promise.all([
      prisma.watchEntry.findMany({ include: { media: true } }),
      prisma.episode.findMany({ where: { watched: true } }),
    ])

    const watched = entries.filter(e => e.status === 'watched')
    const movies = watched.filter(e => e.media.mediaType === 'movie')
    const series = watched.filter(e => e.media.mediaType === 'tv')

    // Temps total (films : runtime en min, séries : épisodes vus × runtime moyen)
    const movieMinutes = movies.reduce((acc, e) => acc + (e.media.runtime || 0), 0)
    const tvMinutes = episodes.length * 40 // fallback 40min/épisode si pas de runtime

    // Genres
    const genreCount = {}
    for (const e of watched) {
      const genres = JSON.parse(e.media.genres || '[]')
      for (const g of genres) genreCount[g] = (genreCount[g] || 0) + 1
    }
    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    // Activité par mois (12 derniers mois)
    const now = new Date()
    const monthlyActivity = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      const count = entries.filter(e => {
        const ua = e.updatedAt
        return ua.getFullYear() === d.getFullYear() && ua.getMonth() === d.getMonth()
      }).length
      return { label, count }
    })

    res.json({
      totalWatched: watched.length,
      movies: movies.length,
      series: series.length,
      episodesWatched: episodes.length,
      minutesWatched: movieMinutes + tvMinutes,
      watchlist: entries.filter(e => e.status === 'watchlist').length,
      watching: entries.filter(e => e.status === 'watching').length,
      avgRating: watched.filter(e => e.rating).reduce((s, e, _, a) => s + e.rating / a.length, 0),
      topGenres,
      monthlyActivity,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
