import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ListVideo, Search, AlertCircle, LayoutGrid, List, Film, Tv } from 'lucide-react'
import { watchlistApi } from '../services/api'
import MediaCard from '../components/MediaCard'
import MediaListItem from '../components/MediaListItem'
import { TABS, deriveState, compareEntries, BEHIND } from '../utils/progress'

const typeFilters = [
  { key: null, label: 'Tout', icon: null },
  { key: 'movie', label: 'Films', icon: Film },
  { key: 'tv', label: 'Séries', icon: Tv },
]

export default function WatchlistPage() {
  // « À suivre » par défaut : c'est la page d'accueil de l'app, elle doit ouvrir sur
  // ce qu'on peut regarder maintenant, pas sur un inventaire.
  const [activeTab, setActiveTab] = useState('suivre')
  const [typeFilter, setTypeFilter] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('cinetrack-watchlist-view') || 'grid')
  const navigate = useNavigate()

  // Une seule requête, sans filtre serveur : l'état est déduit côté client à partir de
  // la progression, et les onglets ne correspondent plus aux statuts en base.
  const { data: allEntries = [], isLoading, isError } = useQuery({
    queryKey: ['watchlist', null],
    queryFn: () => watchlistApi.getAll(),
    staleTime: 1000 * 30,
  })

  const tab = TABS.find(t => t.key === activeTab)

  const entries = useMemo(() => allEntries
    .filter(e => tab.states.includes(deriveState(e)))
    .filter(e => !typeFilter || e.media.mediaType === typeFilter)
    .sort(compareEntries),
    [allEntries, tab, typeFilter])

  // Compteurs sur les onglets : on voit d'un coup d'œil qu'il y a 4 séries à rattraper
  // sans avoir à ouvrir chaque onglet.
  const counts = useMemo(() => {
    const byTab = Object.fromEntries(TABS.map(t => [t.key, 0]))
    for (const e of allEntries) {
      const state = deriveState(e)
      const t = TABS.find(x => x.states.includes(state))
      if (t) byTab[t.key]++
    }
    return byTab
  }, [allEntries])

  const late = useMemo(() => entries.filter(e => deriveState(e) === BEHIND).length, [entries])

  const setView = (mode) => {
    setViewMode(mode)
    localStorage.setItem('cinetrack-watchlist-view', mode)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pt-header px-4 bg-bg sticky top-0 z-10 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h1 className="font-serif text-xl text-text-primary">Ma liste</h1>
            {late > 0 && activeTab === 'suivre' && (
              <p className="text-xs text-gold mt-0.5">
                {late} série{late > 1 ? 's' : ''} à rattraper
              </p>
            )}
          </div>
          <div className="flex items-center bg-card border border-border rounded-full p-0.5 flex-shrink-0">
            <button
              onClick={() => setView('grid')}
              aria-label="Vue grille"
              className={`w-9 h-9 flex items-center justify-center rounded-full ${viewMode === 'grid' ? 'bg-gold text-bg' : 'text-text-dim'}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView('list')}
              aria-label="Vue liste"
              className={`w-9 h-9 flex items-center justify-center rounded-full ${viewMode === 'list' ? 'bg-gold text-bg' : 'text-text-dim'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 pb-2">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 min-h-[44px] px-2 rounded-full text-sm font-medium transition-colors border flex items-center justify-center gap-1.5 ${
                activeTab === key
                  ? 'bg-gold text-bg border-gold'
                  : 'text-text-sec border-border bg-card'
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className={`text-[10px] font-variant-numeric tabular-nums ${activeTab === key ? 'text-bg/70' : 'text-text-dim'}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2 pb-3 pt-1">
          {typeFilters.map(({ key, label, icon: Icon }) => (
            <button
              key={String(key)}
              onClick={() => setTypeFilter(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 min-h-[36px] rounded-full text-xs font-medium border transition-colors ${
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
        {isError && (
          <div className="mx-4 mt-4 flex items-center gap-3 bg-red/10 border border-red/20 rounded-xl p-4">
            <AlertCircle size={18} className="text-red flex-shrink-0" />
            <p className="text-sm text-red">Impossible de charger la liste.</p>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-3 gap-2 px-3 pt-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && !isError && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-text-dim px-8 text-center">
            <ListVideo size={44} strokeWidth={1} className="mb-3 opacity-30" />
            {allEntries.length === 0 ? (
              <>
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
            ) : activeTab === 'suivre' ? (
              <>
                <p className="text-sm text-text-sec mb-1">Rien à rattraper</p>
                <p className="text-xs text-text-dim">Tu es à jour sur tout ce que tu suis.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-text-sec mb-1">Aucun titre ici</p>
                {typeFilter && (
                  <button
                    onClick={() => setTypeFilter(null)}
                    className="text-xs text-gold mt-2 underline underline-offset-2"
                  >
                    Retirer le filtre
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Grille — resserrée (gap-2 / px-3) pour agrandir les posters, toujours 3 par ligne.
            Plus de titre ni d'année : le poster suffit à reconnaître ce qu'on suit, et la
            place gagnée sert à la progression. */}
        {!isLoading && !isError && entries.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-3 gap-2 px-3 pt-3">
            {entries.map(entry => (
              <MediaCard
                key={entry.id}
                item={entry}
                compact
                onClick={() => navigate(`/${entry.media.mediaType}/${entry.media.tmdbId}`)}
              />
            ))}
          </div>
        )}

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
