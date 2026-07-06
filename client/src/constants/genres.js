// Genres TMDB les plus courants (id officiel + libellé FR), utilisés pour
// filtrer /discover côté "Quoi ce soir ?". Sous-ensemble volontairement
// restreint pour garder le sélecteur lisible sur mobile.
export const MOVIE_GENRES = [
  { id: 28, label: 'Action' },
  { id: 35, label: 'Comédie' },
  { id: 18, label: 'Drame' },
  { id: 27, label: 'Horreur' },
  { id: 10749, label: 'Romance' },
  { id: 878, label: 'Science-Fiction' },
  { id: 53, label: 'Thriller' },
  { id: 16, label: 'Animation' },
]

export const TV_GENRES = [
  { id: 10759, label: 'Action & Aventure' },
  { id: 35, label: 'Comédie' },
  { id: 18, label: 'Drame' },
  { id: 9648, label: 'Mystère' },
  { id: 10765, label: 'Sci-Fi & Fantastique' },
  { id: 80, label: 'Crime' },
  { id: 16, label: 'Animation' },
]
