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

    // Réalisateurs
    const directorCount = {}
    for (const e of watched) {
      if (!e.media.director) continue
      directorCount[e.media.director] = (directorCount[e.media.director] || 0) + 1
    }
    const topDirectors = Object.entries(directorCount)
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

    // Heatmap quotidienne (90 derniers jours)
    const dailyMap = {}
    for (const e of entries) {
      const key = e.updatedAt.toISOString().slice(0, 10)
      dailyMap[key] = (dailyMap[key] || 0) + 1
    }
    for (const ep of episodes) {
      if (!ep.watchedAt) continue
      const key = ep.watchedAt.toISOString().slice(0, 10)
      dailyMap[key] = (dailyMap[key] || 0) + 1
    }
    const dailyActivity = Array.from({ length: 90 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (89 - i))
      const key = d.toISOString().slice(0, 10)
      return { date: key, count: dailyMap[key] || 0 }
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
      topDirectors,
      monthlyActivity,
      dailyActivity,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/stats/journal — journal de visionnage daté (films + épisodes)
router.get('/journal', async (req, res) => {
  try {
    const [watchedEntries, watchedEpisodes] = await Promise.all([
      prisma.watchEntry.findMany({
        where: { status: 'watched' },
        include: { media: true },
      }),
      prisma.episode.findMany({
        where: { watched: true },
        include: { season: { include: { media: true } } },
      }),
    ])

    const movieEntries = watchedEntries.map(e => ({
      date: (e.watchedAt || e.updatedAt).toISOString(),
      type: e.media.mediaType,
      title: e.media.title,
      posterPath: e.media.posterPath,
      tmdbId: e.media.tmdbId,
      rating: e.rating,
      detail: null,
    }))

    const episodeEntries = watchedEpisodes
      .filter(ep => ep.watchedAt)
      .map(ep => ({
        date: ep.watchedAt.toISOString(),
        type: 'tv',
        title: ep.season.media.title,
        posterPath: ep.season.media.posterPath,
        tmdbId: ep.season.media.tmdbId,
        rating: ep.rating,
        detail: `S${ep.season.seasonNumber}E${ep.episodeNumber}${ep.name ? ' — ' + ep.name : ''}`,
      }))

    const journal = [...movieEntries, ...episodeEntries].sort((a, b) => new Date(b.date) - new Date(a.date))
    res.json(journal)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/stats/wrapped?year=2026 — récap annuel façon "Wrapped"
router.get('/wrapped', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear()

    const [entries, episodes] = await Promise.all([
      prisma.watchEntry.findMany({ where: { status: 'watched' }, include: { media: true } }),
      prisma.episode.findMany({ where: { watched: true }, include: { season: { include: { media: true } } } }),
    ])

    const inYear = (d) => d && new Date(d).getFullYear() === year

    const yearEntries = entries.filter(e => inYear(e.watchedAt || e.updatedAt))
    const yearEpisodes = episodes.filter(ep => inYear(ep.watchedAt))

    const movies = yearEntries.filter(e => e.media.mediaType === 'movie')
    const series = yearEntries.filter(e => e.media.mediaType === 'tv')
    const movieMinutes = movies.reduce((a, e) => a + (e.media.runtime || 0), 0)
    const tvMinutes = yearEpisodes.length * 40

    const genreCount = {}
    for (const e of yearEntries) {
      for (const g of JSON.parse(e.media.genres || '[]')) genreCount[g] = (genreCount[g] || 0) + 1
    }
    const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }))

    const rated = yearEntries.filter(e => e.rating)
    const topRated = [...rated].sort((a, b) => b.rating - a.rating)[0]

    const uniqueSeriesTitles = new Set(yearEpisodes.map(ep => ep.season.media.title))

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
    const monthlyBreakdown = monthNames.map((label, i) => {
      const count = yearEntries.filter(e => (e.watchedAt || e.updatedAt).getMonth() === i).length
        + yearEpisodes.filter(ep => ep.watchedAt.getMonth() === i).length
      return { label, count }
    })
    const topMonth = monthlyBreakdown.reduce((best, m) => (m.count > best.count ? m : best), monthlyBreakdown[0])

    res.json({
      year,
      moviesWatched: movies.length,
      seriesWatched: series.length,
      episodesWatched: yearEpisodes.length,
      distinctSeries: uniqueSeriesTitles.size,
      minutesWatched: movieMinutes + tvMinutes,
      topGenres,
      topGenre: topGenres[0]?.name || null,
      topRated: topRated ? { title: topRated.media.title, rating: topRated.rating, posterPath: topRated.media.posterPath } : null,
      monthlyBreakdown,
      topMonth: topMonth.count > 0 ? topMonth : null,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
