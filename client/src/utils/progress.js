// État d'un titre : DÉDUIT de la progression, jamais saisi à la main.
//
// Le statut déclaré (watchlist / watching / watched) mentait sur la moitié de la liste —
// Silo était marqué « à voir » avec 10 épisodes sur 22 déjà vus. Personne ne maintient
// ce champ. La vérité est dans les compteurs d'épisodes, renvoyés par /api/watchlist.
//
// `dropped` reste la seule chose que l'utilisateur déclare : abandonner est une décision,
// ça ne se devine pas d'une progression.

export const BEHIND = 'behind'          // commencé, des épisodes sortis non vus
export const NOT_STARTED = 'notStarted' // jamais lancé
export const UP_TO_DATE = 'upToDate'    // tout le sorti est vu, la série continue
export const DONE = 'done'              // tout vu, plus rien à venir
export const ARCHIVED = 'archived'      // abandonné (déclaratif)

/**
 * @param {object} entry  Fiche de /api/watchlist (avec `episodes`).
 * @returns {typeof BEHIND | typeof NOT_STARTED | typeof UP_TO_DATE | typeof DONE | typeof ARCHIVED}
 */
export function deriveState(entry) {
  if (entry.status === 'dropped') return ARCHIVED

  const ep = entry.episodes
  const isSeries = entry.media?.mediaType === 'tv'

  // Film, ou série jamais synchronisée : aucune progression à lire, le statut déclaré
  // reste le seul indice disponible.
  if (!isSeries || !ep || ep.total === 0) {
    return entry.status === 'watched' ? DONE : NOT_STARTED
  }

  if (ep.watched === 0) return NOT_STARTED
  if (ep.aired - ep.watched > 0) return BEHIND
  // Tout le sorti est vu. Reste-t-il des épisodes à venir ?
  return ep.aired < ep.total ? UP_TO_DATE : DONE
}

/** Épisodes sortis et pas encore vus. 0 pour un film ou une série non synchronisée. */
export const remaining = (entry) => {
  const ep = entry.episodes
  if (!ep || entry.media?.mediaType !== 'tv') return 0
  return Math.max(0, ep.aired - ep.watched)
}

/**
 * Avancement 0→1, rapporté aux épisodes SORTIS (et non au total) : être à jour sur une
 * série en cours doit remplir la barre. Sinon une série qu'on suit assidûment afficherait
 * éternellement une barre à moitié vide à cause de saisons pas encore diffusées.
 */
export const progress = (entry) => {
  const ep = entry.episodes
  if (!ep || !ep.aired) return 0
  return Math.min(1, ep.watched / ep.aired)
}

// Hiérarchie d'affichage demandée : d'abord ce qu'on peut regarder maintenant.
const RANK = { [BEHIND]: 0, [NOT_STARTED]: 1, [UP_TO_DATE]: 2, [DONE]: 3, [ARCHIVED]: 4 }

/**
 * Comparateur de tri de « Ma liste ».
 * Entre deux séries à rattraper, celle dont un épisode est sorti le plus RÉCEMMENT passe
 * devant : un nouvel épisode qui vient de tomber est plus actionnable qu'un retard de
 * 27 épisodes accumulé depuis des mois.
 */
export function compareEntries(a, b) {
  const rankDiff = RANK[deriveState(a)] - RANK[deriveState(b)]
  if (rankDiff !== 0) return rankDiff

  if (deriveState(a) === BEHIND) {
    const dateA = a.episodes?.lastUnwatchedAirDate || ''
    const dateB = b.episodes?.lastUnwatchedAirDate || ''
    if (dateA !== dateB) return dateB.localeCompare(dateA)
  }

  return (b.updatedAt || '').localeCompare(a.updatedAt || '')
}

// Les trois onglets. « À suivre » regroupe tout ce qui est commencé et pas fini :
// le tri met les séries à rattraper devant celles où l'on est à jour.
export const TABS = [
  { key: 'suivre', label: 'À suivre', states: [BEHIND, UP_TO_DATE] },
  { key: 'avoir', label: 'À voir', states: [NOT_STARTED] },
  { key: 'termine', label: 'Terminé', states: [DONE, ARCHIVED] },
]
