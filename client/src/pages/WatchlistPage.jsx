import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ListVideo } from 'lucide-react'
import { watchlistApi } from '../services/api'
import MediaCard from '../components/MediaCard'

const filters = [
  { key: null, label: 'Tout' },
  { key: 'watchlist', label: 'À voir' },
  { key: 'watching', label: 'En cours' },
  { key: 'watched', label: 'Vus' },
]

export default function WatchlistPage() {
  const [activeFilter, setActiveFilter] = useState(null)
  const [view, setView] = useState('grid') // 'grid' | 'list'
  const navigate = useNavigate()

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['watchlist', activeFilter],
    queryFn: () => watchlistApi.getAll(activeFilter),
    staleTime: 1000 * 30,
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="safe-top px-4 pt-4 pb-0 bg-bg sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-serif text-xl text-text-primary">Ma liste</h1>
          <span className="text-xs text-text-sec bg-card px-2.5 py-1 rounded-full border border-border">
            {entries.length} titres
          </span>
        </div>

        {/* Filter tabs */}
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
      <div className="flex-1 overflow-y-auto pb-nav scrollbar-none px-4">
        {isLoading && (
          <div className="grid grid-cols-3 gap-3 pt-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-text-dim">
            <ListVideo size={48} strokeWidth={1} className="mb-3 opacity-30" />
            <p className="text-sm text-center">
              {activeFilter ? 'Aucun titre dans cette catégorie' : 'Ta liste est vide\nUtilise Découvrir pour ajouter des films'}
            </p>
          </div>
        )}

        {!isLoading && entries.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-2">
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
