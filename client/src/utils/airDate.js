// Formatage des dates/heures de diffusion en heure française.
//
// Trois cas, par ordre de fiabilité décroissante :
//  1. Chaîne linéaire (HBO, ABC, BBC…) : TVmaze fournit `airtime` + `airstamp`,
//     un instant UTC réel. Conversion directe vers Paris — heure EXACTE.
//  2. Plateforme (Apple TV+, Netflix…) : l'heure de diffusion n'existe nulle part,
//     aucune API ne l'expose. TVmaze remplit alors `airstamp` à midi UTC — valeur
//     factice, à ne jamais afficher. On DÉRIVE l'heure de la convention plateforme
//     (mise en ligne à 00h00 heure du Pacifique) — heure APPROCHÉE mais fiable.
//  3. Rien d'autre qu'une date : on n'affiche pas d'heure.

const PARIS = 'Europe/Paris'
const PACIFIC = 'America/Los_Angeles'
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
    : formatParis(date, { hour: 'numeric', minute: '2-digit' }).replace(':', 'h')

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

/** Décalage du fuseau `timeZone` par rapport à UTC, en ms, à l'instant `date`. */
function tzOffsetMs(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * Instant réel correspondant à minuit heure du Pacifique le jour `dateStr`.
 *
 * Apple TV+ et Netflix mettent en ligne à 00h00 PT. C'est une convention de
 * plateforme, pas une donnée d'API — mais elle est déterministe. En passant par une
 * vraie conversion de fuseau plutôt qu'un décalage codé en dur, les changements
 * d'heure se gèrent seuls : ça tombe sur 9h00 à Paris quasiment toute l'année, et
 * sur 8h00 pendant les deux semaines de mars où les États-Unis basculent avant l'Europe.
 * @param {string} dateStr  « AAAA-MM-JJ »
 */
function pacificMidnight(dateStr) {
  const guess = new Date(`${dateStr}T00:00:00Z`)
  if (Number.isNaN(guess.getTime())) return null
  return new Date(guess.getTime() - tzOffsetMs(PACIFIC, guess))
}

/**
 * @typedef {object} NextEpisodeInfo
 * @property {'linear'|'streaming'|null} kind
 * @property {?string} airdate   « AAAA-MM-JJ »
 * @property {?string} airtime   Heure de la chaîne, vide pour les plateformes.
 * @property {?string} airstamp  Instant ISO — factice si airtime est vide.
 */

/**
 * Résout l'instant de diffusion et sa fiabilité.
 * @param {NextEpisodeInfo} info
 * @returns {{ date: Date, exact: boolean } | { date: Date, exact: null } | null}
 *   `exact: true` = heure réelle · `false` = heure dérivée de la plateforme · `null` = pas d'heure.
 */
function resolveAirInstant({ kind, airdate, airtime, airstamp }) {
  // Chaîne linéaire : airstamp est un vrai instant, mais seulement si airtime est
  // renseigné. Sans airtime, TVmaze a rempli airstamp à midi UTC — ça ne vaut rien.
  if (airtime && airstamp) {
    const date = new Date(airstamp)
    if (!Number.isNaN(date.getTime())) return { date, exact: true }
  }
  if (kind === 'streaming' && airdate) {
    const date = pacificMidnight(airdate)
    if (date) return { date, exact: false }
  }
  const date = parseAirDate(airdate)
  return date ? { date, exact: null } : null
}

/**
 * Formate le prochain épisode pour affichage.
 * @param {NextEpisodeInfo} info
 * @param {Date} [now]  Injectable pour les tests.
 * @returns {{ label: string, time: ?string, exact: ?boolean, days: number, isPast: boolean } | null}
 */
export function formatNextEpisode(info, now = new Date()) {
  const resolved = info && resolveAirInstant(info)
  if (!resolved) return null

  const { date, exact } = resolved
  const days = daysUntil(date, now)

  let label
  if (days === 0) label = "Aujourd'hui"
  else if (days === 1) label = 'Demain'
  else if (days > 1 && days < 7) label = capitalize(formatParis(date, { weekday: 'long', day: 'numeric', month: 'long' }))
  else label = capitalize(formatParis(date, { day: 'numeric', month: 'long', year: 'numeric' }))

  const time = exact === null
    ? null
    : formatParis(date, { hour: 'numeric', minute: '2-digit' }).replace(':', 'h')

  return { label, time, exact, days, isPast: days < 0 }
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
