// Helpers du programme TV.
//
// Toutes les dates du flux sont des ISO 8601 AVEC décalage, écrits en heure de
// Paris par la source (« 2026-09-20T21:10:00+02:00 »). Deux conséquences qu'on
// exploite partout ici :
//  1. On formate toujours en `Europe/Paris`, jamais dans le fuseau de l'appareil :
//     c'est une grille TV française, elle doit se lire en heure française même
//     depuis l'étranger.
//  2. L'heure murale est lisible telle quelle dans la chaîne (`slice(11, 16)`),
//     ce qui permet de comparer des horaires sans aucun calcul de fuseau.

const PARIS = 'Europe/Paris'

// Le prime time français. Sert de point de mire pour un jour qui n'est pas
// aujourd'hui : « en ce moment » n'y veut rien dire, mais « ce qu'il y avait en
// première partie de soirée » est exactement ce qu'on cherche.
const PRIME_TIME = '21:15'

/** Clé « AAAA-MM-JJ » du jour parisien courant. */
export const parisToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

const formatParis = (date, options) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, ...options }).format(date)

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** « 2026-09-20T21:10:00+02:00 » → « 21h10 ». */
export const formatTime = (iso) =>
  iso ? formatParis(new Date(iso), { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') : null

/**
 * Libellé d'un onglet de jour : « Hier », « Aujourd'hui », « Demain », sinon
 * « Sam. 26 ». Sur sept jours on ne répète jamais un même jour de semaine, le
 * numéro suffit à lever l'ambiguïté.
 * @param {string} day  « AAAA-MM-JJ »
 */
export function dayLabel(day, today = parisToday()) {
  const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Demain'
  if (diff === -1) return 'Hier'
  const date = new Date(`${day}T12:00:00Z`)
  return capitalize(formatParis(date, { weekday: 'short', day: 'numeric' })).replace(/\.$/, '.')
}

/** Date longue pour l'en-tête : « Dimanche 20 septembre ». */
export const dayTitle = (day) =>
  capitalize(formatParis(new Date(`${day}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long' }))

/** Durée en minutes, ou null si la source n'a pas d'heure de fin. */
export function durationMinutes(program) {
  if (!program?.endsAt) return null
  const ms = Date.parse(program.endsAt) - Date.parse(program.startsAt)
  return ms > 0 ? Math.round(ms / 60_000) : null
}

/** « 1h45 » / « 45 min ». */
export function formatDuration(program) {
  const min = durationMinutes(program)
  if (!min) return null
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`
}

/** Le programme est-il à l'antenne à cet instant ? */
export function isLive(program, now = new Date()) {
  const t = now.getTime()
  return Date.parse(program.startsAt) <= t && (!program.endsAt || Date.parse(program.endsAt) > t)
}

/** Avancement d'un programme en cours, entre 0 et 1. null s'il n'est pas à l'antenne. */
export function liveProgress(program, now = new Date()) {
  if (!isLive(program, now) || !program.endsAt) return null
  const start = Date.parse(program.startsAt)
  const end = Date.parse(program.endsAt)
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)))
}

/**
 * Le programme à mettre en avant pour une chaîne, sur le jour affiché : celui à
 * l'antenne si on regarde aujourd'hui, sinon celui de la première partie de soirée.
 *
 * @param {Array} programs  Ordonnés par startsAt.
 * @param {string} day      Jour de grille affiché.
 * @param {string} today    Jour parisien courant.
 */
export function featuredProgram(programs, day, today = parisToday(), now = new Date()) {
  if (!programs?.length) return null
  if (day === today) {
    const live = programs.find(p => isLive(p, now))
    if (live) return live
  }
  // Dernier programme commencé avant 21h15. La comparaison porte sur le préfixe
  // ISO complet, pas sur l'heure seule : les programmes de nuit portent la date
  // du lendemain et sortiraient sinon en tête de liste.
  const cutoff = `${day}T${PRIME_TIME}`
  let best = null
  for (const p of programs) {
    if (p.startsAt.slice(0, 16) <= cutoff) best = p
    else break
  }
  return best || programs[0]
}

// Catégories qui méritent d'être affichées : le flux en empile jusqu'à quatre
// (« Série », « Policier », « Drame »…) et les plus génériques n'apprennent rien.
const NOISE = new Set(['Programme', 'Autre', 'Services', 'Culture Infos'])

/** La catégorie la plus parlante d'un programme, ou null. */
export const mainCategory = (categories) => (categories || []).find(c => !NOISE.has(c)) || null
