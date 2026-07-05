const axios = require('axios')

const tmdb = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  params: {
    api_key: process.env.TMDB_API_KEY,
    language: 'fr-FR',
  },
})

async function search(query, page = 1) {
  const { data } = await tmdb.get('/search/multi', {
    params: { query, page, include_adult: false },
  })
  return data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv')
}

async function getMovieDetail(tmdbId) {
  const { data } = await tmdb.get(`/movie/${tmdbId}`, {
    params: { append_to_response: 'credits,videos' },
  })
  return data
}

async function getTvDetail(tmdbId) {
  const { data } = await tmdb.get(`/tv/${tmdbId}`, {
    params: { append_to_response: 'credits,videos' },
  })
  return data
}

async function getTvSeason(tmdbId, seasonNumber) {
  const { data } = await tmdb.get(`/tv/${tmdbId}/season/${seasonNumber}`)
  return data
}

async function getTrending(mediaType = 'all', timeWindow = 'week') {
  const { data } = await tmdb.get(`/trending/${mediaType}/${timeWindow}`)
  return data.results
}

async function discover(mediaType, params = {}) {
  const endpoint = mediaType === 'movie' ? '/discover/movie' : '/discover/tv'
  const { data } = await tmdb.get(endpoint, { params })
  return data
}

module.exports = { search, getMovieDetail, getTvDetail, getTvSeason, getTrending, discover }
