import { TMDB_IMAGE } from '../services/api'
import { Star, Tv, Check, CheckCircle } from 'lucide-react'
import { deriveState, remaining, progress, BEHIND, DONE, ARCHIVED } from '../utils/progress'

/**
 * Carte poster.
 *
 * @param {object}  props.item          Fiche watchlist (avec `.media`) ou item TMDB brut.
 * @param {boolean} [props.compact]     « Ma liste » : ni titre ni année, mais une barre de
 *                                      progression et le nombre d'épisodes en retard. Ailleurs
 *                                      (recherche, recommandations), le titre reste indispensable
 *                                      — on ne reconnaît pas un poster qu'on n'a jamais vu.
 * @param {boolean} [props.inWatchlist] Résultats de recherche : déjà dans la liste.
 */
export default function MediaCard({ item, onClick, compact = false, inWatchlist = false }) {
  const isEntry = !!item.media
  const media = isEntry ? item.media : item
  const entry = isEntry ? item : null

  const title = media.title || media.name
  const poster = TMDB_IMAGE(media.posterPath || media.poster_path, 'w342')
  const year = (media.releaseDate || media.release_date || media.first_air_date || '').slice(0, 4)

  const state = entry ? deriveState(entry) : null
  const left = entry ? remaining(entry) : 0
  const ratio = entry ? progress(entry) : 0
  const showBar = compact && entry?.episodes?.aired > 0

  return (
    <button
      onClick={onClick}
      aria-label={title}
      className={`flex flex-col text-left active:scale-[0.97] transition-transform ${state === ARCHIVED ? 'opacity-50' : ''}`}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-card border border-border w-full">
        {poster
          ? <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-text-dim p-2">
              <Tv size={24} />
              {/* Sans poster ET sans titre, la carte serait un carré vide : on retombe sur le titre. */}
              {compact && <span className="text-[9px] text-center leading-tight line-clamp-3">{title}</span>}
            </div>
        }

        {/* Épisodes en retard — l'information la plus actionnable de la carte */}
        {compact && state === BEHIND && left > 0 && (
          <div className="absolute top-1.5 right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-gold text-bg text-[11px] font-bold rounded-full shadow-sm font-variant-numeric tabular-nums">
            {left}
          </div>
        )}

        {/* Terminé */}
        {compact && state === DONE && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center bg-green rounded-full">
            <Check size={12} className="text-bg" strokeWidth={3} />
          </div>
        )}

        {/* Indicateur « déjà dans ma liste » (résultats de recherche) */}
        {!entry && inWatchlist && (
          <div className="absolute top-1.5 right-1.5 bg-green/90 rounded-full p-0.5">
            <CheckCircle size={14} className="text-bg" strokeWidth={2.5} />
          </div>
        )}

        {/* Note */}
        {entry?.rating && (
          <div className={`absolute right-1.5 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5 ${showBar ? 'bottom-2.5' : 'bottom-1.5'}`}>
            <Star size={9} className="text-gold fill-gold" />
            <span className="text-[10px] text-gold font-medium">{entry.rating}</span>
          </div>
        )}

        {/* Barre de progression — collée au bord bas du poster, elle ne coûte aucune
            hauteur dans la grille. Verte quand il n'y a plus rien à regarder. */}
        {showBar && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
            <div
              className={`h-full transition-all duration-500 ${state === BEHIND ? 'bg-gold' : 'bg-green'}`}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        )}
      </div>

      {!compact && (
        <div className="mt-2 px-0.5">
          <div className="text-xs font-semibold text-text-primary leading-tight line-clamp-2">{title}</div>
          <div className="text-[10px] text-text-dim mt-1">{year}</div>
        </div>
      )}
    </button>
  )
}
