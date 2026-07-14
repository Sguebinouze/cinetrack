const axios = require('axios')
const tmdb = require('./tmdb')

// TVmaze : source de vérité pour les dates/heures de diffusion.
// TMDB ne fournit qu'une date, fausse d'un jour sur les séries Apple TV+ (vérifié sur
// Silo S2 : TMDB annonce jeudi, Apple a diffusé le vendredi). TVmaze donne la bonne
// date, et l'instant exact (airstamp) pour les chaînes linéaires. Pas de clé d'API.
//
// Frontière nette : TVmaze ne sert QUE pour les dates/heures. TMDB reste la source
// pour tout le reste (fiches, posters, casting, recommandations).
const tvmaze = axios.create({ baseURL: 'https://api.tvmaze.com' })

// Une série inconnue de TVmaze renvoie 404 → null, et l'appelant retombe sur TMDB.
const orNull = (p) => p.then(r => r.data).catch(() => null)

/** Résout l'id TVmaze depuis l'imdb_id de TMDB. Le lookup répond en 301, axios suit. */
async function resolveShowId(tmdbId) {
  const { data: ext } = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}/external_ids`, {
    params: { api_key: process.env.TMDB_API_KEY },
  }).catch(() => ({ data: null }))
  if (!ext?.imdb_id) return null
  const show = await orNull(tvmaze.get('/lookup/shows', { params: { imdb: ext.imdb_id } }))
  return show?.id || null
}

const getEpisodes = (showId) => orNull(tvmaze.get(`/shows/${showId}/episodes`))

const getShowWithNextEpisode = (showId) =>
  orNull(tvmaze.get(`/shows/${showId}`, { params: { embed: 'nextepisode' } }))

// Une série de chaîne (`network`) a une heure de diffusion réelle. Une série de
// plateforme (`webChannel`) n'en a pas : TVmaze remplit alors airstamp à midi UTC,
// valeur factice qu'il ne faut jamais afficher comme une heure.
const showKind = (show) => (show?.network ? 'linear' : 'streaming')
const showChannel = (show) => (show?.network || show?.webChannel || {})?.name || null

module.exports = { resolveShowId, getEpisodes, getShowWithNextEpisode, showKind, showChannel, tmdb }
