// Formatage des dates de diffusion TMDB en heure française.
//
// TMDB ne renvoie qu'une DATE (« 2026-07-22 »), jamais l'heure de diffusion :
// ni /tv/{id} ni next_episode_to_air n'exposent d'horaire. On gère malgré tout
// le cas d'un ISO complet (« 2026-07-22T19:00:00Z ») au cas où la source
// changerait, mais en pratique le rendu est « Mardi 22 juillet », sans heure.

const PARIS = 'Europe/Paris'
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * @param {string | null | undefined} airDate
 * @returns {Date | null}
 */
function parseAirDate(airDate) {
  if (!airDate) return null
  // Une date seule est ancrée à midi UTC : minuit UTC basculerait d'un jour
  // dans certains fuseaux, et on veut que « 2026-07-22 » reste le 22 à Paris.
  const iso = DATE_ONLY.test(airDate) ? `${airDate}T12:00:00Z` : airDate
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Clé « AAAA-MM-JJ » du jour calendaire parisien correspondant à `date`. */
const parisDayKey = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

/**
 * Nombre de jours calendaires parisiens entre aujourd'hui et `date`.
 * On compare des clés de jour plutôt que des timestamps : insensible aux
 * heures et aux changements d'heure (DST).
 */
function daysUntil(date, now) {
  const target = Date.parse(`${parisDayKey(date)}T00:00:00Z`)
  const today = Date.parse(`${parisDayKey(now)}T00:00:00Z`)
  return Math.round((target - today) / 86_400_000)
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

const formatParis = (date, options) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, ...options }).format(date)

/**
 * @typedef {object} FormattedAirDate
 * @property {Date}    date     Instant de diffusion.
 * @property {number}  days     Jours restants (0 = aujourd'hui, négatif = passé).
 * @property {string}  label    « Aujourd'hui », « Mardi 22 juillet », « 22 juillet 2026 »…
 * @property {?string} time     « 21h00 » si TMDB fournit une heure, sinon null.
 * @property {string}  text     `label` + heure éventuelle. Prêt à afficher.
 * @property {boolean} isPast   La date est déjà passée (données TMDB en retard).
 */

/**
 * Formate une date de diffusion TMDB pour un affichage français.
 * @param {string | null | undefined} airDate  « 2026-07-22 » ou ISO complet.
 * @param {Date} [now]  Injectable pour les tests.
 * @returns {FormattedAirDate | null} null si la date est absente ou invalide.
 */
export function formatAirDate(airDate, now = new Date()) {
  const date = parseAirDate(airDate)
  if (!date) return null

  const days = daysUntil(date, now)
  const time = DATE_ONLY.test(airDate)
    ? null
    : formatParis(date, { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')

  let label
  if (days === 0) label = "Aujourd'hui"
  else if (days === 1) label = 'Demain'
  else if (days > 1 && days < 7) label = capitalize(formatParis(date, { weekday: 'long', day: 'numeric', month: 'long' }))
  else label = capitalize(formatParis(date, { day: 'numeric', month: 'long', year: 'numeric' }))

  return {
    date,
    days,
    label,
    time,
    text: time ? `${label} à ${time}` : label,
    isPast: days < 0,
  }
}

/**
 * Un épisode est « sorti » si sa date de diffusion est passée. Une date absente
 * est considérée comme sortie : TMDB laisse parfois airDate vide sur des
 * épisodes anciens, et on préfère laisser l'utilisateur les cocher.
 * Reproduit à l'identique le filtre SQL des endpoints /watch-all.
 * @param {{ airDate?: string | null }} episode
 */
export function isAired(episode, now = new Date()) {
  return !episode.airDate || episode.airDate <= parisDayKey(now)
}
