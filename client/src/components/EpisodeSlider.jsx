import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Tv, Check, X, Clock, Star } from 'lucide-react'
import { tmdbApi, TMDB_IMAGE } from '../services/api'
import { formatAirDate } from '../utils/airDate'

/**
 * Bandeau « À voir » : slider horizontal des prochains épisodes non-vus déjà
 * diffusés. Le résumé (`overview`) et la vignette (`still_path`) ne sont pas
 * stockés en D1 — on les récupère en live via le proxy TMDB, saison par saison,
 * uniquement pour les saisons présentes dans la liste (souvent une seule).
 *
 * @param {object}   props
 * @param {string}   props.tmdbId
 * @param {Array}    props.upcoming  Épisodes locaux enrichis de `seasonNumber`,
 *                                   déjà filtrés (non-vus, sortis) et triés.
 * @param {(epId: number, watched: boolean) => void} props.onToggleWatched
 */
export default function EpisodeSlider({ tmdbId, upcoming, onToggleWatched }) {
  const [selectedId, setSelectedId] = useState(null)

  const seasonNumbers = [...new Set(upcoming.map(e => e.seasonNumber))]

  // Une query par saison concernée : réutilise le cache si la saison a déjà été
  // ouverte, et se persiste offline via le préfixe TMDB (cf. App.jsx).
  const seasonQueries = useQueries({
    queries: seasonNumbers.map(n => ({
      queryKey: ['tmdb-season', tmdbId, n],
      queryFn: () => tmdbApi.tvSeason(tmdbId, n),
      staleTime: 1000 * 60 * 60,
    })),
  })

  // Index « seasonNumber-episodeNumber » → épisode TMDB (overview, still, runtime…).
  const tmdbByKey = {}
  seasonQueries.forEach((q, i) => {
    const n = seasonNumbers[i]
    for (const ep of q.data?.episodes || []) {
      tmdbByKey[`${n}-${ep.episode_number}`] = ep
    }
  })

  const enrich = (ep) => {
    const t = tmdbByKey[`${ep.seasonNumber}-${ep.episodeNumber}`]
    return { ...ep, overview: t?.overview, still: t?.still_path, runtime: t?.runtime, voteAverage: t?.vote_average }
  }

  const found = selectedId != null ? upcoming.find(e => e.id === selectedId) : null
  const selected = found ? enrich(found) : null
  const selectedLoading = selected
    ? seasonQueries[seasonNumbers.indexOf(selected.seasonNumber)]?.isLoading
    : false

  return (
    <div className="mb-4">
      <h4 className="text-xs text-text-dim uppercase tracking-widest mb-2">À voir</h4>
      {/* -mx-4 px-4 : les cartes affleurent le bord de l'écran en défilant. */}
      <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
        {upcoming.map((ep) => {
          const still = TMDB_IMAGE(enrich(ep).still, 'w300')
          return (
            <button
              key={ep.id}
              onClick={() => setSelectedId(ep.id)}
              className="flex-shrink-0 w-40 text-left active:opacity-70 transition-opacity"
            >
              <div className="aspect-video rounded-lg overflow-hidden bg-card border border-border mb-1.5 flex items-center justify-center">
                {still
                  ? <img src={still} alt="" className="w-full h-full object-cover" />
                  : <Tv size={20} className="text-text-dim" />}
              </div>
              <div className="text-[10px] text-gold font-medium">S{ep.seasonNumber}E{ep.episodeNumber}</div>
              <div className="text-xs text-text-primary leading-tight line-clamp-2">{ep.name}</div>
            </button>
          )
        })}
      </div>

      {selected && (
        <EpisodeSheet
          episode={selected}
          loading={selectedLoading}
          onClose={() => setSelectedId(null)}
          onMarkWatched={() => { onToggleWatched(selected.id, true); setSelectedId(null) }}
        />
      )}
    </div>
  )
}

/** Fiche épisode en bottom sheet : vignette large, méta, synopsis, action « vu ». */
function EpisodeSheet({ episode, loading, onClose, onMarkWatched }) {
  const still = TMDB_IMAGE(episode.still, 'w780')
  const air = episode.airDate ? formatAirDate(episode.airDate) : null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border-t border-border rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto scrollbar-none"
        onClick={e => e.stopPropagation()}
      >
        {still
          ? <img src={still} alt="" className="w-full aspect-video object-cover" />
          : <div className="w-full aspect-video bg-card flex items-center justify-center"><Tv size={28} className="text-text-dim" /></div>}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="text-xs text-gold font-medium mb-0.5">S{episode.seasonNumber}E{episode.episodeNumber}</div>
              <h3 className="font-serif text-lg text-text-primary leading-tight">{episode.name}</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-card border border-border flex-shrink-0 active:bg-white/5"
            >
              <X size={16} className="text-text-sec" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs text-text-sec mb-4">
            {air && <span>{air.label}</span>}
            {episode.runtime > 0 && (
              <>
                <span className="text-text-dim">·</span>
                <span className="flex items-center gap-1"><Clock size={11} />{episode.runtime} min</span>
              </>
            )}
            {episode.voteAverage > 0 && (
              <>
                <span className="text-text-dim">·</span>
                <span className="flex items-center gap-1"><Star size={11} className="text-gold fill-gold" />{episode.voteAverage.toFixed(1)}</span>
              </>
            )}
          </div>

          {loading ? (
            <div className="space-y-2 mb-5">
              <div className="h-3 w-full bg-card animate-pulse rounded" />
              <div className="h-3 w-full bg-card animate-pulse rounded" />
              <div className="h-3 w-2/3 bg-card animate-pulse rounded" />
            </div>
          ) : episode.overview ? (
            <p className="text-sm text-text-sec leading-relaxed mb-5">{episode.overview}</p>
          ) : (
            <p className="text-sm text-text-dim italic mb-5">Pas de résumé disponible pour cet épisode.</p>
          )}

          <button
            onClick={onMarkWatched}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-bg text-sm font-medium active:opacity-90"
          >
            <Check size={16} />
            Marquer comme vu
          </button>
        </div>
      </div>
    </div>
  )
}
