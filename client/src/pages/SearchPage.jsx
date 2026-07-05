import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, X, TrendingUp, AlertCircle } from 'lucide-react'
import { tmdbApi, watchlistApi } from '../services/api'
import MediaCard from '../components/MediaCard'

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 400)
  const navigate = useNavigate()

  const { data: trending = [], isError: trendingError } = useQuery({
    queryKey: ['trending'],
    queryFn: () => tmdbApi.trending('all', 'week'),
    staleTime: 1000 * 60 * 10,
  })

  const { data: results = [], isFetching, isError: searchError } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => tmdbApi.search(debouncedQuery),
    enabled: debouncedQuery.length > 1,
    staleTime: 1000 * 30,
  })

  // Watchlist locale pour afficher l'indicateur "déjà dans ma liste"
  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist', null],
    queryFn: () => watchlistApi.getAll(),
    staleTime: 1000 * 30,
  })

  const watchlistIds = new Set(watchlist.map(e => e.media.tmdbId))

  const showResults = debouncedQuery.length > 1
  const displayItems = showResults ? results : trending
  const isError = showResults ? searchError : trendingError

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="safe-top px-4 pt-4 pb-3 bg-bg sticky top-0 z-10 border-b border-border/50">
        <h1 className="font-serif text-xl text-text-primary mb-3">Découvrir</h1>
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Films, séries…"
            className="w-full bg-card border border-border rounded-2xl pl-10 pr-10 py-3 text-sm text-text-primary placeholder:text-text-dim outline-none focus:border-gold/50 transition-colors"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-dim active:text-text-primary">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-nav scrollbar-none">
        {/* Section label */}
        {!showResults && (
          <div className="flex items-center gap-2 px-4 py-3 text-xs text-text-sec uppercase tracking-widest">
            <TrendingUp size={13} />
            <span>Tendances cette semaine</span>
          </div>
        )}

        {showResults && isFetching && (
          <div className="px-4 py-3 text-xs text-text-dim animate-pulse">Recherche en cours…</div>
        )}

        {/* Erreur réseau */}
        {isError && (
          <div className="mx-4 mt-4 flex items-center gap-3 bg-red/10 border border-red/20 rounded-xl p-4">
            <AlertCircle size={18} className="text-red flex-shrink-0" />
            <p className="text-sm text-red-300">Impossible de charger les données. Vérifie ta connexion.</p>
          </div>
        )}

        {/* Grille */}
        {!isError && displayItems.length > 0 && (
          <div className="grid grid-cols-3 gap-3 px-4 pt-1 pb-2">
            {displayItems.map(item => (
              <MediaCard
                key={item.id}
                item={item}
                inWatchlist={watchlistIds.has(item.id)}
                onClick={() => navigate(`/${item.media_type || 'movie'}/${item.id}`)}
              />
            ))}
          </div>
        )}

        {/* Aucun résultat */}
        {showResults && !isFetching && !isError && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-text-dim px-8 text-center">
            <Search size={40} strokeWidth={1} className="mb-3 opacity-30" />
            <p className="text-sm">Aucun résultat pour <span className="text-text-sec">« {debouncedQuery} »</span></p>
          </div>
        )}

        {/* Trending vide */}
        {!showResults && !isFetching && !isError && trending.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-text-dim">
            <div className="w-10 h-10 border-2 border-text-dim/30 rounded-full border-t-gold animate-spin mb-3" />
            <p className="text-sm">Chargement des tendances…</p>
          </div>
        )}
      </div>
    </div>
  )
}
