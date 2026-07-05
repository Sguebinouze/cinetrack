import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ListVideo, Search, AlertCircle } from 'lucide-react'
import { watchlistApi } from '../services/api'
import MediaCard from '../components/MediaCard'

const filters = [
  { key: null, label: 'Tout' },
  { key: 'watchlist', label: 'À voir' },
  { key: 'watching', label: 'En cours' },
  { key: 'watched', label: 'Vus' },
  { key: 'dropped', label: 'Abandonnés' },
]

export default function WatchlistPage() {
  const [activeFilter, setActiveFilter] = useState(null)
  const navigate = useNavigate()

  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ['watchlist', activeFilter],
    queryFn: () => watchlistApi.getAll(activeFilter),
    staleTime: 1000 * 30,
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="safe-top px-4 pt-4 bg-bg sticky top-0 z-10 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-serif text-xl text-text-primary">Ma liste</h1>
          <span className="text-xs text-text-sec bg-card px-2.5 py-1 rounded-full border border-border font-variant-numeric tabular-nums">
            {entries.length} titre{entries.length !== 1 ? 's' : ''}
          </span>
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
    </div>
  )
}
