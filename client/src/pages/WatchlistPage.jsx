import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ListVideo, Search, AlertCircle, LayoutGrid, List, Film, Tv } from 'lucide-react'
import { watchlistApi } from '../services/api'
import MediaCard from '../components/MediaCard'
import MediaListItem from '../components/MediaListItem'

const filters = [
  { key: null, label: 'Tout' },
  { key: 'watchlist', label: 'À voir' },
  { key: 'watching', label: 'En cours' },
  { key: 'watched', label: 'Vus' },
  { key: 'dropped', label: 'Abandonnés' },
]

const typeFilters = [
  { key: null, label: 'Tout', icon: null },
  { key: 'movie', label: 'Films', icon: Film },
  { key: 'tv', label: 'Séries', icon: Tv },
]

export default function WatchlistPage() {
  const [activeFilter, setActiveFilter] = useState(null)
  const [typeFilter, setTypeFilter] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('cinetrack-watchlist-view') || 'grid')
  const navigate = useNavigate()

  const { data: allEntries = [], isLoading, isError } = useQuery({
    queryKey: ['watchlist', activeFilter],
    queryFn: () => watchlistApi.getAll(activeFilter),
    staleTime: 1000 * 30,
  })

  const entries = typeFilter ? allEntries.filter(e => e.media.mediaType === typeFilter) : allEntries

  const setView = (mode) => {
    setViewMode(mode)
    localStorage.setItem('cinetrack-watchlist-view', mode)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="safe-top px-4 pt-4 bg-bg sticky top-0 z-10 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-serif text-xl text-text-primary">Ma liste</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-sec bg-card px-2.5 py-1 rounded-full border border-border font-variant-numeric tabular-nums">
              {entries.length} titre{entries.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center bg-card border border-border rounded-full p-0.5">
              <button
                onClick={() => setView('grid')}
                aria-label="Vue grille"
                className={`w-7 h-7 flex items-center justify-center rounded-full ${viewMode === 'grid' ? 'bg-gold text-bg' : 'text-text-dim'}`}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setView('list')}
                aria-label="Vue liste"
                className={`w-7 h-7 flex items-center justify-center rounded-full ${viewMode === 'list' ? 'bg-gold text-bg' : 'text-text-dim'}`}
              >
                <List size={13} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
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

        <div className="flex gap-2 pb-3 pt-1">
          {typeFilters.map(({ key, label, icon: Icon }) => (
            <button
              key={String(key)}
              onClick={() => setTypeFilter(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                typeFilter === key
                  ? 'bg-gold/15 text-gold border-gold/30'
                  : 'text-text-sec border-border bg-card'
              }`}
            >
              {Icon && <Icon size={12} />}
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
            <p className="text-sm text-red">Impossible de charger la liste.</p>
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
            {activeFilter || typeFilter ? (
              <>
                <ListVideo size={44} strokeWidth={1} className="mb-3 opacity-30" />
                <p className="text-sm text-text-sec mb-1">Aucun titre dans cette catégorie</p>
                <button
                  onClick={() => { setActiveFilter(null); setTypeFilter(null) }}
                  className="text-xs text-gold mt-2 underline underline-offset-2"
                >
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
        {!isLoading && !isError && entries.length > 0 && viewMode === 'grid' && (
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

        {/* Liste */}
        {!isLoading && !isError && entries.length > 0 && viewMode === 'list' && (
          <div className="flex flex-col gap-2 px-4 pt-3">
            {entries.map(entry => (
              <MediaListItem
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
