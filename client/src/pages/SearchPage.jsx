import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, X, TrendingUp, AlertCircle, Shuffle, Star } from 'lucide-react'
import { tmdbApi, watchlistApi } from '../services/api'
import { MOVIE_GENRES, TV_GENRES } from '../constants/genres'
import MediaCard from '../components/MediaCard'

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const trendingFilters = [
  { key: 'all', label: 'Tout' },
  { key: 'movie', label: 'Films' },
  { key: 'tv', label: 'Séries' },
  { key: 'anime', label: 'Anime' },
]

const durationOptions = [
  { key: 90, label: '< 1h30' },
  { key: 120, label: '< 2h' },
  { key: null, label: 'Peu importe' },
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [trendingFilter, setTrendingFilter] = useState('all')
  const debouncedQuery = useDebounce(query, 400)
  const navigate = useNavigate()

  const [showTonight, setShowTonight] = useState(false)
  const [tonightType, setTonightType] = useState('movie')
  const [tonightDuration, setTonightDuration] = useState(null)
  const [tonightGenre, setTonightGenre] = useState(null)
  const [tonightPick, setTonightPick] = useState(null)
  const [isPicking, setIsPicking] = useState(false)
  const [tonightEmpty, setTonightEmpty] = useState(false)

  const { data: trending = [], isLoading: isTrendingLoading, isError: trendingError } = useQuery({
    queryKey: ['trending', trendingFilter],
    queryFn: () => trendingFilter === 'anime' ? tmdbApi.animeTrending() : tmdbApi.trending(trendingFilter, 'week'),
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

  const genreOptions = tonightType === 'movie' ? MOVIE_GENRES : TV_GENRES

  const pickRandom = async () => {
    setIsPicking(true)
    setTonightEmpty(false)
    try {
      const pool = await tmdbApi.discover(tonightType, {
        ...(tonightGenre ? { genre: tonightGenre } : {}),
        ...(tonightDuration ? { maxRuntime: tonightDuration } : {}),
      })
      if (pool.length === 0) {
        setTonightEmpty(true)
        setTonightPick(null)
      } else {
        setTonightPick(pool[Math.floor(Math.random() * pool.length)])
      }
    } finally {
      setIsPicking(false)
    }
  }

  const closeTonight = () => {
    setShowTonight(false)
    setTonightPick(null)
    setTonightEmpty(false)
    setTonightDuration(null)
    setTonightGenre(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="safe-top px-4 pt-4 pb-3 bg-bg sticky top-0 z-10 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-serif text-xl text-text-primary">Découvrir</h1>
          <button
            onClick={() => setShowTonight(true)}
            className="flex items-center gap-1.5 text-xs text-gold bg-gold/10 border border-gold/30 px-2.5 py-1 rounded-full font-medium"
          >
            <Shuffle size={12} /> Quoi ce soir ?
          </button>
        </div>
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
        {/* Section label + filtres tendances */}
        {!showResults && (
          <>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 text-xs text-text-sec uppercase tracking-widest">
              <TrendingUp size={13} />
              <span>Tendances cette semaine</span>
            </div>
            <div className="flex gap-2 px-4 pb-3">
              {trendingFilters.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTrendingFilter(key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    trendingFilter === key
                      ? 'bg-gold text-bg border-gold'
                      : 'text-text-sec border-border bg-card'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {showResults && isFetching && (
          <div className="px-4 py-3 text-xs text-text-dim animate-pulse">Recherche en cours…</div>
        )}

        {/* Erreur réseau */}
        {isError && (
          <div className="mx-4 mt-4 flex items-center gap-3 bg-red/10 border border-red/20 rounded-xl p-4">
            <AlertCircle size={18} className="text-red flex-shrink-0" />
            <p className="text-sm text-red">Impossible de charger les données. Vérifie ta connexion.</p>
          </div>
        )}

        {/* Grille */}
        {!isError && displayItems.length > 0 && (
          <div className="grid grid-cols-3 gap-3 px-4 pt-1 pb-2">
            {displayItems.map(item => {
              const mediaType = item.media_type || (!showResults && trendingFilter === 'anime' ? 'tv' : !showResults && trendingFilter !== 'all' ? trendingFilter : 'movie')
              return (
                <MediaCard
                  key={item.id}
                  item={item}
                  inWatchlist={watchlistIds.has(item.id)}
                  onClick={() => navigate(`/${mediaType}/${item.id}`)}
                />
              )
            })}
          </div>
        )}

        {/* Aucun résultat */}
        {showResults && !isFetching && !isError && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-text-dim px-8 text-center">
            <Search size={40} strokeWidth={1} className="mb-3 opacity-30" />
            <p className="text-sm">Aucun résultat pour <span className="text-text-sec">« {debouncedQuery} »</span></p>
          </div>
        )}

        {/* Chargement des tendances */}
        {!showResults && isTrendingLoading && !isError && (
          <div className="flex flex-col items-center justify-center py-20 text-text-dim">
            <div className="w-10 h-10 border-2 border-text-dim/30 rounded-full border-t-gold animate-spin mb-3" />
            <p className="text-sm">Chargement des tendances…</p>
          </div>
        )}

        {/* Tendances vides (chargées mais aucun résultat) */}
        {!showResults && !isTrendingLoading && !isError && trending.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-text-dim px-8 text-center">
            <TrendingUp size={40} strokeWidth={1} className="mb-3 opacity-30" />
            <p className="text-sm">Aucune tendance disponible pour le moment</p>
          </div>
        )}
      </div>

      {/* Quoi ce soir ? */}
      {showTonight && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm max-h-[80vh] overflow-y-auto scrollbar-none">
            <h3 className="font-serif text-lg text-text-primary mb-1">Quoi ce soir ?</h3>
            <p className="text-xs text-text-dim mb-4">Tirage au sort dans tout le catalogue TMDB</p>

            <p className="text-xs text-text-dim uppercase tracking-widest mb-2">Type</p>
            <div className="flex gap-2 mb-4">
              {[{ key: 'movie', label: 'Films' }, { key: 'tv', label: 'Séries' }].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setTonightType(key); setTonightGenre(null); setTonightPick(null); setTonightEmpty(false) }}
                  className={`flex-1 py-2 rounded-xl border text-xs font-medium ${
                    tonightType === key ? 'bg-gold text-bg border-gold' : 'text-text-sec border-border bg-card'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

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

            <p className="text-xs text-text-dim uppercase tracking-widest mb-2">Genre</p>
            <div className="flex gap-2 flex-wrap mb-5">
              <button
                onClick={() => setTonightGenre(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                  !tonightGenre ? 'bg-gold text-bg border-gold' : 'text-text-sec border-border bg-card'
                }`}
              >
                Tous
              </button>
              {genreOptions.map(g => (
                <button
                  key={g.id}
                  onClick={() => setTonightGenre(g.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    tonightGenre === g.id ? 'bg-gold text-bg border-gold' : 'text-text-sec border-border bg-card'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {tonightEmpty && (
              <p className="text-xs text-text-dim mb-4">Aucun résultat pour ces critères — essaie une combinaison plus large.</p>
            )}

            {tonightPick && (
              <button
                onClick={() => navigate(`/${tonightType}/${tonightPick.id}`)}
                className="w-full flex items-center gap-3 bg-card border border-gold/30 rounded-xl p-3 mb-4 text-left"
              >
                {tonightPick.poster_path && (
                  <img
                    src={`https://image.tmdb.org/t/p/w185${tonightPick.poster_path}`}
                    alt={tonightPick.title || tonightPick.name}
                    className="w-14 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary font-medium truncate">{tonightPick.title || tonightPick.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {(tonightPick.release_date || tonightPick.first_air_date) && (
                      <span className="text-xs text-text-dim">{(tonightPick.release_date || tonightPick.first_air_date).slice(0, 4)}</span>
                    )}
                    {tonightPick.vote_average > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-gold"><Star size={10} className="fill-gold" />{tonightPick.vote_average.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              </button>
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
                  onClick={() => navigate(`/${tonightType}/${tonightPick.id}`)}
                  className="flex-1 py-3 rounded-xl bg-gold text-bg text-sm font-medium"
                >
                  Regarder
                </button>
              ) : (
                <button
                  onClick={pickRandom}
                  disabled={isPicking}
                  className="flex-1 py-3 rounded-xl bg-gold text-bg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Shuffle size={14} className={isPicking ? 'animate-spin' : ''} /> {isPicking ? 'Recherche…' : 'Tirer au sort'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
