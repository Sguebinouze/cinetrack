import axios from 'axios'

// En prod (Pages), l'API est sur le même domaine via /api
// En dev local, on proxy vers Express sur :3001
const BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api'
const api = axios.create({ baseURL: BASE })

export const tmdbApi = {
  search: (q, page = 1) => api.get('/tmdb/search', { params: { q, page } }).then(r => r.data),
  trending: (type = 'all', window = 'week') => api.get('/tmdb/trending', { params: { type, window } }).then(r => r.data),
  animeTrending: () => api.get('/tmdb/anime/trending').then(r => r.data),
  movie: (id) => api.get(`/tmdb/movie/${id}`).then(r => r.data),
  tv: (id) => api.get(`/tmdb/tv/${id}`).then(r => r.data),
  tvSeason: (id, season) => api.get(`/tmdb/tv/${id}/season/${season}`).then(r => r.data),
  recommendations: (mediaType, id) => api.get(`/tmdb/${mediaType}/${id}/recommendations`).then(r => r.data),
  watchProviders: (mediaType, id) => api.get(`/tmdb/${mediaType}/${id}/watch-providers`).then(r => r.data),
}

export const watchlistApi = {
  getAll: (status) => api.get('/watchlist', { params: status ? { status } : {} }).then(r => r.data),
  add: (tmdbId, mediaType, status) => api.post('/watchlist', { tmdbId, mediaType, status }).then(r => r.data),
  update: (id, data) => api.patch(`/watchlist/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/watchlist/${id}`).then(r => r.data),
}

export const episodesApi = {
  get: (tmdbId) => api.get(`/episodes/${tmdbId}`).then(r => r.data),
  sync: (tmdbId) => api.post(`/episodes/sync/${tmdbId}`).then(r => r.data),
  markWatched: (episodeId, watched) => api.patch(`/episodes/${episodeId}/watch`, { watched }).then(r => r.data),
  rate: (episodeId, rating) => api.patch(`/episodes/${episodeId}/rate`, { rating }).then(r => r.data),
}

export const listsApi = {
  getAll: () => api.get('/lists').then(r => r.data),
  create: (name) => api.post('/lists', { name }).then(r => r.data),
  remove: (id) => api.delete(`/lists/${id}`).then(r => r.data),
  addItem: (listId, tmdbId) => api.post(`/lists/${listId}/items`, { tmdbId }).then(r => r.data),
  removeItem: (listId, mediaId) => api.delete(`/lists/${listId}/items/${mediaId}`).then(r => r.data),
}

export const statsApi = {
  get: () => api.get('/stats').then(r => r.data),
  journal: () => api.get('/stats/journal').then(r => r.data),
  wrapped: (year) => api.get('/stats/wrapped', { params: year ? { year } : {} }).then(r => r.data),
}

export const TMDB_IMAGE = (path, size = 'w500') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null
