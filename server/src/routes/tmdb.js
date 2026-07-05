const router = require('express').Router()
const tmdb = require('../services/tmdb')

router.get('/search', async (req, res) => {
  try {
    const { q, page } = req.query
    if (!q) return res.status(400).json({ error: 'Query required' })
    const results = await tmdb.search(q, page)
    res.json(results)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/trending', async (req, res) => {
  try {
    const { type = 'all', window = 'week' } = req.query
    const results = await tmdb.getTrending(type, window)
    res.json(results)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/movie/:id', async (req, res) => {
  try {
    const data = await tmdb.getMovieDetail(req.params.id)
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/tv/:id', async (req, res) => {
  try {
    const data = await tmdb.getTvDetail(req.params.id)
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/tv/:id/season/:season', async (req, res) => {
  try {
    const data = await tmdb.getTvSeason(req.params.id, req.params.season)
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
