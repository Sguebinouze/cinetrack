import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ListVideo, Search, AlertCircle, Shuffle, Clock } from 'lucide-react'
import { watchlistApi, TMDB_IMAGE } from '../services/api'
import MediaCard from '../components/MediaCard'

const durationOptions = [
  { key: 90, label: '< 1h30' },
  { key: 120, label: '< 2h' },
  { key: null, label: 'Peu importe' },
]

const filters = [
  { key: null, label: 'Tout' },
  { key: 'watchlist', label: 'À voir' },
  { key: 'watching', label: 'En cours' },
  { key: 'watched', label: 'Vus' },
  { key: 'dropped', label: 'Abandonnés' },
]

export default function WatchlistPage() {
  const [activeFilter, setActiveFilter] = useState(null)
  const [showTonight, setShowTonight] = useState(false)
  const [tonightDuration, setTonightDuration] = useState(null)
  const [tonightGenre, setTonightGenre] = useState(null)
  const [tonightPick, setTonightPick] = useState(null)
  const navigate = useNavigate()

  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ['watchlist', activeFilter],
    queryFn: () => watchlistApi.getAll(activeFilter),
    staleTime: 1000 * 30,
  })

  const { data: toWatchEntries = [] } = useQuery({
    queryKey: ['watchlist', 'watchlist'],
    queryFn: () => watchlistApi.getAll('watchlist'),
    staleTime: 1000 * 30,
    enabled: showTonight,
  })

  const availableGenres = [...new Set(toWatchEntries.flatMap(e => JSON.parse(e.media.genres || '[]')))]

  const tonightCandidates = toWatchEntries.filter(e => {
    if (tonightDuration && (e.media.runtime || 0) > tonightDuration) return false
    if (tonightGenre && !JSON.parse(e.media.genres || '[]').includes(tonightGenre)) return false
    return true
  })

  const pickRandom = () => {
    if (tonightCandidates.length === 0) return setTonightPick(null)
    setTonightPick(tonightCandidates[Math.floor(Math.random() * tonightCandidates.length)])
  }

  const closeTonight = () => {
    setShowTonight(false)
    setTonightPick(null)
    setTonightDuration(null)
    setTonightGenre(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="safe-top px-4 pt-4 bg-bg sticky top-0 z-10 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-serif text-xl text-text-primary">Ma liste</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTonight(true)}
              className="flex items-center gap-1.5 text-xs text-gold bg-gold/10 border border-gold/30 px-2.5 py-1 rounded-full font-medium"
            >
              <Shuffle size={12} /> Quoi ce soir ?
            </button>
            <span className="text-xs text-text-sec bg-card px-2.5 py-1 rounded-full border border-border font-variant-numeric tabular-nums">
              {entries.length} titre{entries.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3">
          {filters.map(({ key, label }) => (
            <button
              key={String(key)}
              onClick={() => setActiveFilter(key)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                activeFilter === key
                  ? 'bg-gold text-bg border-gold'
                  : 'text-text-sec border-border bg-card'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-nav scrollbar-none">
        {/* Erreur */}
        {isError && (
          <div className="mx-4 mt-4 flex items-center gap-3 bg-red/10 border border-red/20 rounded-xl p-4">
            <AlertCircle size={18} className="text-red flex-shrink-0" />
            <p className="text-sm text-red-300">Impossible de charger la liste.</p>
          </div>
        )}

        {/* Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-3 gap-3 px-4 pt-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="aspect-[2/3] rounded-xl bg-card animate-pulse" />
                <div className="h-2.5 w-3/4 bg-card animate-pulse rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Liste vide */}
        {!isLoading && !isError && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-text-dim px-8 text-center">
            {activeFilter ? (
              <>
                <ListVideo size={44} strokeWidth={1} className="mb-3 opacity-30" />
                <p className="text-sm text-text-sec mb-1">Aucun titre dans cette catégorie</p>
                <button onClick={() => setActiveFilter(null)} className="text-xs text-gold mt-2 underline underline-offset-2">
                  Voir toute la liste
                </button>
              </>
            ) : (
              <>
                <ListVideo size={44} strokeWidth={1} className="mb-3 opacity-30" />
                <p className="text-sm text-text-sec mb-1">Ta liste est vide</p>
                <p className="text-xs text-text-dim mb-4">Ajoute des films et séries depuis Découvrir</p>
                <button
                  onClick={() => navigate('/search')}
                  className="flex items-center gap-2 bg-gold/10 border border-gold/30 text-gold text-sm px-4 py-2.5 rounded-xl font-medium"
                >
                  <Search size={15} />
                  Explorer
                </button>
              </>
            )}
          </div>
        )}

        {/* Grille */}
        {!isLoading && !isError && entries.length > 0 && (
          <div className="grid grid-cols-3 gap-3 px-4 pt-3">
            {entries.map(entry => (
              <MediaCard
                key={entry.id}
                item={entry}
                onClick={() => navigate(`/${entry.media.mediaType}/${entry.media.tmdbId}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quoi ce soir ? */}
      {showTonight && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm max-h-[80vh] overflow-y-auto scrollbar-none">
            <h3 className="font-serif text-lg text-text-primary mb-4">Quoi ce soir ?</h3>

            <p className="text-xs text-text-dim uppercase tracking-widest mb-2">Durée</p>
            <div className="flex gap-2 mb-4">
              {durationOptions.map(({ key, label }) => (
                <button
                  key={String(key)}
                  onClick={() => setTonightDuration(key)}
                  className={`flex-1 py-2 rounded-xl border text-xs font-medium ${
                    tonightDuration === key ? 'bg-gold text-bg border-gold' : 'text-text-sec border-border bg-card'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {availableGenres.length > 0 && (
              <>
                <p className="text-xs text-text-dim uppercase tracking-widest mb-2">Genre</p>
                <div className="flex gap-2 flex-wrap mb-4">
                  <button
                    onClick={() => setTonightGenre(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                      !tonightGenre ? 'bg-gold text-bg border-gold' : 'text-text-sec border-border bg-card'
                    }`}
                  >
                    Tous
                  </button>
                  {availableGenres.map(g => (
                    <button
                      key={g}
                      onClick={() => setTonightGenre(g)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                        tonightGenre === g ? 'bg-gold text-bg border-gold' : 'text-text-sec border-border bg-card'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="text-xs text-text-dim mb-4">{tonightCandidates.length} titre{tonightCandidates.length !== 1 ? 's' : ''} correspondent</p>

            {tonightPick && (
              <div className="flex items-center gap-3 bg-card border border-gold/30 rounded-xl p-3 mb-4">
                {tonightPick.media.posterPath && (
                  <img src={TMDB_IMAGE(tonightPick.media.posterPath, 'w185')} alt={tonightPick.media.title} className="w-12 h-[72px] object-cover rounded-lg" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary font-medium truncate">{tonightPick.media.title}</p>
                  {tonightPick.media.runtime && (
                    <p className="text-xs text-text-dim flex items-center gap-1 mt-0.5"><Clock size={10} />{tonightPick.media.runtime} min</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeTonight}
                className="flex-1 py-3 rounded-xl border border-border text-text-sec text-sm font-medium"
              >
                Fermer
              </button>
              {tonightPick ? (
                <button
                  onClick={() => navigate(`/${tonightPick.media.mediaType}/${tonightPick.media.tmdbId}`)}
                  className="flex-1 py-3 rounded-xl bg-gold text-bg text-sm font-medium"
                >
                  Regarder
                </button>
              ) : (
                <button
                  onClick={pickRandom}
                  disabled={tonightCandidates.length === 0}
                  className="flex-1 py-3 rounded-xl bg-gold text-bg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Shuffle size={14} /> Tirer au sort
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
