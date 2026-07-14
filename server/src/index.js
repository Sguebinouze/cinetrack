require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/tmdb', require('./routes/tmdb'))
app.use('/api/watchlist', require('./routes/watchlist'))
app.use('/api/episodes', require('./routes/episodes'))
app.use('/api/stats', require('./routes/stats'))
app.use('/api/lists', require('./routes/lists'))
// Actions en masse : /api/seasons/:id/watch-all et /api/series/:tmdbId/watch-all
app.use('/api', require('./routes/bulk'))

app.get('/api/health', (_, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log(`CineTrack API running on :${PORT}`))
