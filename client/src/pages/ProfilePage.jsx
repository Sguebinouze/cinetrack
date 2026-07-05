import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Film, Tv, Clock, Star, Award, Trash2, Plus, BookOpen, Sparkles, ChevronRight } from 'lucide-react'
import { statsApi, watchlistApi, listsApi } from '../services/api'
import { useNavigate } from 'react-router-dom'
import MediaCard from '../components/MediaCard'

export default function ProfilePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [newListName, setNewListName] = useState('')
  const [showNewList, setShowNewList] = useState(false)

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.get,
    staleTime: 1000 * 60,
  })

  const { data: recent = [] } = useQuery({
    queryKey: ['watchlist', 'watched'],
    queryFn: () => watchlistApi.getAll('watched'),
    staleTime: 1000 * 30,
  })

  const { data: lists = [] } = useQuery({
    queryKey: ['lists'],
    queryFn: listsApi.getAll,
  })

  const createListMutation = useMutation({
    mutationFn: (name) => listsApi.create(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists'] })
      setNewListName('')
      setShowNewList(false)
    },
  })

  const deleteListMutation = useMutation({
    mutationFn: (id) => listsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  })

  const hours = stats ? Math.floor(stats.minutesWatched / 60) : 0
  const topRecent = recent.slice(0, 6)

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-none pb-nav">
      {/* Header hero */}
      <div className="safe-top bg-surface border-b border-border px-4 pt-6 pb-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/30 to-gold-dim/20 border border-gold/20 flex items-center justify-center">
            <Award size={28} className="text-gold" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-serif text-xl text-text-primary">Mon profil</h1>
            <p className="text-sm text-text-sec mt-0.5">Cinéphile depuis 2025</p>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Film, label: 'Films', value: stats?.movies ?? 0 },
            { icon: Tv, label: 'Séries', value: stats?.series ?? 0 },
            { icon: Clock, label: 'Heures', value: hours },
            { icon: Star, label: 'Note moy.', value: stats?.avgRating ? stats.avgRating.toFixed(1) : '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-2.5 text-center">
              <Icon size={16} className="text-gold mx-auto mb-1" strokeWidth={1.5} />
              <div className="text-base font-bold text-text-primary">{value}</div>
              <div className="text-[10px] text-text-dim">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5 space-y-6">
        {/* Navigation vers Journal / Wrapped */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/journal')}
            className="flex items-center gap-2 bg-card border border-border rounded-xl p-3 text-left active:opacity-70"
          >
            <BookOpen size={18} className="text-gold flex-shrink-0" strokeWidth={1.5} />
            <span className="text-sm text-text-primary font-medium">Journal</span>
            <ChevronRight size={14} className="text-text-dim ml-auto" />
          </button>
          <button
            onClick={() => navigate('/wrapped')}
            className="flex items-center gap-2 bg-card border border-border rounded-xl p-3 text-left active:opacity-70"
          >
            <Sparkles size={18} className="text-gold flex-shrink-0" strokeWidth={1.5} />
            <span className="text-sm text-text-primary font-medium">Bilan annuel</span>
            <ChevronRight size={14} className="text-text-dim ml-auto" />
          </button>
        </div>

        {/* Mes listes personnalisées */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs text-text-dim uppercase tracking-widest">Mes listes</h2>
            <button onClick={() => setShowNewList(v => !v)} className="text-xs text-gold flex items-center gap-1">
              <Plus size={13} /> Nouvelle liste
            </button>
          </div>

          {showNewList && (
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                placeholder="Ex : À regarder en avion"
                className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-dim outline-none focus:border-gold/50"
              />
              <button
                onClick={() => newListName.trim() && createListMutation.mutate(newListName)}
                disabled={createListMutation.isPending || !newListName.trim()}
                className="px-4 py-2 rounded-xl bg-gold text-bg text-sm font-medium disabled:opacity-50"
              >
                Créer
              </button>
            </div>
          )}

          {lists.length === 0 ? (
            <p className="text-xs text-text-dim">Aucune liste personnalisée. Crée-en une pour organiser tes envies.</p>
          ) : (
            <div className="space-y-2">
              {lists.map(list => (
                <div key={list.id} className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-primary">{list.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-dim">{list.items.length} titre{list.items.length !== 1 ? 's' : ''}</span>
                      <button onClick={() => deleteListMutation.mutate(list.id)}>
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                  {list.items.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto scrollbar-none">
                      {list.items.map(item => (
                        <img
                          key={item.id}
                          src={item.media.posterPath ? `https://image.tmdb.org/t/p/w185${item.media.posterPath}` : undefined}
                          alt={item.media.title}
                          onClick={() => navigate(`/${item.media.mediaType}/${item.media.tmdbId}`)}
                          className="w-12 h-[72px] object-cover rounded-lg flex-shrink-0 bg-bg cursor-pointer"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top genres */}
        {stats?.topGenres?.length > 0 && (
          <div>
            <h2 className="text-xs text-text-dim uppercase tracking-widest mb-3">Genres favoris</h2>
            <div className="flex gap-2 flex-wrap">
              {stats.topGenres.map((g, i) => (
                <span
                  key={g.name}
                  className={`px-3 py-1.5 rounded-full text-sm border ${
                    i === 0
                      ? 'bg-gold/15 border-gold/30 text-gold font-medium'
                      : 'bg-card border-border text-text-sec'
                  }`}
                >
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top réalisateurs */}
        {stats?.topDirectors?.length > 0 && (
          <div>
            <h2 className="text-xs text-text-dim uppercase tracking-widest mb-3">Réalisateurs favoris</h2>
            <div className="flex gap-2 flex-wrap">
              {stats.topDirectors.map(d => (
                <span key={d.name} className="px-3 py-1.5 rounded-full text-sm border bg-card border-border text-text-sec">
                  {d.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recently watched */}
        {topRecent.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-text-dim uppercase tracking-widest">Récemment vus</h2>
              <button onClick={() => navigate('/watchlist')} className="text-xs text-gold">Voir tout</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {topRecent.map(entry => (
                <MediaCard
                  key={entry.id}
                  item={entry}
                  onClick={() => navigate(`/${entry.media.mediaType}/${entry.media.tmdbId}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Watching now */}
        {stats?.watching > 0 && (
          <div className="bg-gold/8 border border-gold/20 rounded-2xl p-4">
            <p className="text-sm text-gold font-medium mb-1">En cours</p>
            <p className="text-xs text-text-sec">
              Tu as {stats.watching} série{stats.watching > 1 ? 's' : ''} en cours de visionnage.
            </p>
            <button
              onClick={() => navigate('/watchlist')}
              className="mt-2 text-xs text-gold underline underline-offset-2"
            >
              Voir ma liste →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
