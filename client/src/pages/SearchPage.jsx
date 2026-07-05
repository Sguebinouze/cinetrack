import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SearchIcon, X, TrendingUp } from 'lucide-react'
import { tmdbApi } from '../services/api'
import MediaCard from '../components/MediaCard'

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useState(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  })
  return debounced
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const { data: trending = [] } = useQuery({
    queryKey: ['trending'],
    queryFn: () => tmdbApi.trending('all', 'week'),
    staleTime: 1000 * 60 * 10,
  })

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => tmdbApi.search(query),
    enabled: query.length > 1,
    staleTime: 1000 * 30,
  })

  const showResults = query.length > 1
  const displayItems = showResults ? results : trending

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="safe-top px-4 pt-4 pb-3 bg-bg sticky top-0 z-10">
        <h1 className="font-serif text-xl text-text-primary mb-3">Découvrir</h1>
        <div className="relative">
          <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Films, séries…"
            className="w-full bg-card border border-border rounded-2xl pl-10 pr-10 py-3 text-sm text-text-primary placeholder:text-text-dim outline-none focus:border-gold/50 transition-colors"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-dim">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-nav scrollbar-none">
        {!showResults && (
          <div className="flex items-center gap-2 px-4 py-3 text-xs text-text-sec uppercase tracking-widest">
            <TrendingUp size={13} />
            <span>Tendances cette semaine</span>
          </div>
        )}

        {isFetching && showResults && (
          <div className="px-4 py-2 text-xs text-text-dim">Recherche…</div>
        )}

        <div className="grid grid-cols-3 gap-3 px-4">
          {displayItems.map(item => (
            <MediaCard
              key={item.id}
              item={item}
              onClick={() => navigate(`/${item.media_type || 'movie'}/${item.id}`)}
            />
          ))}
        </div>

        {showResults && results.length === 0 && !isFetching && (
          <div className="flex flex-col items-center justify-center py-20 text-text-dim">
            <SearchIcon size={40} strokeWidth={1} className="mb-3 opacity-40" />
            <p className="text-sm">Aucun résultat pour « {query} »</p>
          </div>
        )}
      </div>
    </div>
  )
}
