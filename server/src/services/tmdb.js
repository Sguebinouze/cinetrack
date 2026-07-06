const axios = require('axios')

const tmdb = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  params: {
    api_key: process.env.TMDB_API_KEY,
    language: 'fr-FR',
  },
})

// Mots-clés TMDB à exclure systématiquement (contenu pornographique / hentai).
// TMDB ne marque pas toujours ce contenu comme `adult: true` de façon fiable
// (particulièrement les OAV hentai côté anime), d'où l'exclusion explicite
// par mot-clé en complément de `include_adult: false`.
const EXCLUDED_KEYWORDS = '198385,195669,281741,329280,325693,256466,161919,155477,267122' // hentai, ecchi, nudity, sexual content, erotica, erotic, adult animation, softcore, sex

async function search(query, page = 1) {
  const { data } = await tmdb.get('/search/multi', {
    params: { query, page, include_adult: false },
  })
  return data.results
    .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
    .filter(r => !r.adult)
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
  return (data.results || []).filter(r => !r.adult)
}

async function discover(mediaType, params = {}) {
  const endpoint = mediaType === 'movie' ? '/discover/movie' : '/discover/tv'
  const { data } = await tmdb.get(endpoint, {
    params: { include_adult: false, without_keywords: EXCLUDED_KEYWORDS, ...params },
  })
  data.results = (data.results || []).filter(r => !r.adult)
  return data
}

async function getRecommendations(mediaType, tmdbId) {
  const { data } = await tmdb.get(`/${mediaType}/${tmdbId}/recommendations`)
  return (data.results || []).filter(r => !r.adult)
}

async function getWatchProviders(mediaType, tmdbId) {
  const { data } = await tmdb.get(`/${mediaType}/${tmdbId}/watch/providers`)
  return data.results?.FR || null
}

async function getAnimeTrending() {
  const { data } = await tmdb.get('/discover/tv', {
    params: {
      with_genres: 16,
      with_origin_country: 'JP',
      sort_by: 'popularity.desc',
      include_adult: false,
      without_keywords: EXCLUDED_KEYWORDS,
    },
  })
  return (data.results || []).filter(r => !r.adult)
}

module.exports = {
  search, getMovieDetail, getTvDetail, getTvSeason, getTrending, discover,
  getRecommendations, getWatchProviders, getAnimeTrending,
}
