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

// Tri unique de « Ma liste » : ordre alphabétique du titre, dans TOUS les onglets.
// `sensitivity: 'base'` ignore casse et accents (« Étoile » se range à E, pas après Z),
// `numeric` range « Saison 2 » avant « Saison 10 ».
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

/** Comparateur de tri de « Ma liste ». Alphabétique, quel que soit l'onglet. */
export function compareEntries(a, b) {
  return collator.compare(a.media?.title || '', b.media?.title || '')
}

// Libellé + pastille de couleur d'un état déduit, pour l'afficher tel quel
// (badge en lecture seule) au lieu de le laisser saisir. Couleurs = palette
// sémantique de tailwind.config.js.
export const STATE_META = {
  [BEHIND]: { label: 'À suivre', dot: 'bg-gold' },
  [NOT_STARTED]: { label: 'Pas commencé', dot: 'bg-blue' },
  [UP_TO_DATE]: { label: 'À jour', dot: 'bg-green' },
  [DONE]: { label: 'Terminé', dot: 'bg-green' },
  [ARCHIVED]: { label: 'Abandonné', dot: 'bg-red' },
}

// Les trois onglets. « À suivre » regroupe tout ce qui est commencé et pas fini
// (à rattraper comme à jour) ; à l'intérieur, l'ordre reste alphabétique.
export const TABS = [
  { key: 'suivre', label: 'À suivre', states: [BEHIND, UP_TO_DATE] },
  { key: 'avoir', label: 'À voir', states: [NOT_STARTED] },
  { key: 'termine', label: 'Terminé', states: [DONE, ARCHIVED] },
]
