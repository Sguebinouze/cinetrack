import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Film, Tv, Clock, Star, Award, Trash2, Plus, BookOpen, Sparkles,
  ChevronRight, TrendingUp, AlertCircle, Search,
} from 'lucide-react'
import { statsApi, watchlistApi, listsApi } from '../services/api'
import MediaCard from '../components/MediaCard'
import InstallPrompt from '../components/InstallPrompt'

function StatCard({ label, value, sub, icon: Icon, color = 'text-gold' }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className={`${color} mb-2`}><Icon size={18} strokeWidth={1.5} /></div>
      <div className="text-2xl font-bold text-text-primary font-variant-numeric tabular-nums leading-none mb-1">{value ?? '—'}</div>
      <div className="text-xs text-text-sec">{label}</div>
      {sub && <div className="text-[10px] text-text-dim mt-0.5">{sub}</div>}
    </div>
  )
}

/**
 * Page « Moi » — fusion des anciennes pages Stats et Profil.
 *
 * Les deux affichaient « Genres favoris », chacune à sa façon : un vrai doublon, pas
 * seulement deux onglets de trop. On garde ici la version la plus lisible de chaque
 * bloc (les barres de Stats, les pastilles de réalisateurs de Profil).
 */
export default function ProfilePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [newListName, setNewListName] = useState('')
  const [showNewList, setShowNewList] = useState(false)

  const { data: stats, isLoading, isError } = useQuery({
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

  const hours = stats ? Math.floor(stats.minutesWatched / 60) : null
  const isEmpty = stats && stats.totalWatched === 0 && stats.watchlist === 0 && stats.watching === 0
  const maxBar = stats ? Math.max(...(stats.monthlyActivity || []).map(m => m.count), 1) : 1

  const heatmapWeeks = []
  if (stats?.dailyActivity) {
    for (let i = 0; i < stats.dailyActivity.length; i += 7) {
      heatmapWeeks.push(stats.dailyActivity.slice(i, i + 7))
    }
  }
  const maxDaily = stats ? Math.max(...(stats.dailyActivity || []).map(d => d.count), 1) : 1
  const heatColor = (count) => {
    if (count === 0) return 'bg-white/5'
    const ratio = count / maxDaily
    if (ratio > 0.75) return 'bg-gold'
    if (ratio > 0.5) return 'bg-gold/70'
    if (ratio > 0.25) return 'bg-gold/45'
    return 'bg-gold/20'
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-none pb-nav">
      {/* Identité */}
      <div className="bg-surface border-b border-border px-4 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/30 to-gold-dim/20 border border-gold/20 flex items-center justify-center flex-shrink-0">
            <Award size={28} className="text-gold" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-serif text-xl text-text-primary">Moi</h1>
            <p className="text-sm text-text-sec mt-0.5">Cinéphile depuis 2025</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-6">
        {isError && (
          <div className="flex items-center gap-3 bg-red/10 border border-red/20 rounded-xl p-4">
            <AlertCircle size={18} className="text-red flex-shrink-0" />
            <p className="text-sm text-red">Impossible de charger les statistiques.</p>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-card rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && !isError && isEmpty && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp size={44} strokeWidth={1} className="text-text-dim opacity-30 mb-3" />
            <p className="text-sm text-text-sec mb-1">Tes stats apparaîtront ici</p>
            <p className="text-xs text-text-dim mb-5">Commence par ajouter des films et séries</p>
            <button
              onClick={() => navigate('/search')}
              className="flex items-center gap-2 bg-gold/10 border border-gold/30 text-gold text-sm px-4 py-2.5 rounded-xl font-medium"
            >
              <Search size={15} />
              Découvrir
            </button>
          </div>
        )}

        {!isLoading && !isError && stats && !isEmpty && (
          <>
            {/* Chiffres */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Films vus" value={stats.movies} icon={Film} />
              {/* « suivies » et non « vues » : une série compte dès le premier épisode. */}
              <StatCard label="Séries suivies" value={stats.series} icon={Tv} color="text-blue" />
              <StatCard label="Épisodes vus" value={stats.episodesWatched} icon={TrendingUp} color="text-green" />
              <StatCard
                label="Temps visionné"
                value={`${hours}h`}
                icon={Clock}
                color="text-text-sec"
                sub={stats.minutesWatched > 0 ? `≈ ${(stats.minutesWatched / 60 / 24).toFixed(1)} jours` : null}
              />
              <StatCard
                label="Note moyenne"
                value={stats.avgRating ? stats.avgRating.toFixed(1) : '—'}
                icon={Star}
              />
              <StatCard label="À voir" value={stats.watchlist} icon={Film} color="text-text-dim" />
            </div>

            {/* Journal / Bilan */}
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

            {/* Genres favoris */}
            {stats.topGenres?.length > 0 && (
              <div>
                <h2 className="text-xs text-text-dim uppercase tracking-widest mb-3">Genres favoris</h2>
                <div className="space-y-3">
                  {stats.topGenres.map((g, i) => (
                    <div key={g.name} className="flex items-center gap-3">
                      <span className="text-xs text-text-dim w-4 font-variant-numeric tabular-nums">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-text-primary">{g.name}</span>
                          <span className="text-text-sec font-variant-numeric tabular-nums">{g.count}</span>
                        </div>
                        <div className="h-1.5 bg-card rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(g.count / stats.topGenres[0].count) * 100}%`,
                              background: i === 0 ? '#E9C46A' : i === 1 ? '#4CAF82' : '#4A7CB5',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Réalisateurs favoris */}
            {stats.topDirectors?.length > 0 && (
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

            {/* Activité mensuelle */}
            {stats.monthlyActivity?.length > 0 && (
              <div>
                <h2 className="text-xs text-text-dim uppercase tracking-widest mb-4">Activité — 12 derniers mois</h2>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-end gap-1.5 h-24">
                    {stats.monthlyActivity.map(({ label, count }, i) => {
                      const isLast = i === stats.monthlyActivity.length - 1
                      const isFirst = i === 0
                      const height = maxBar > 0 ? Math.max((count / maxBar) * 80, count > 0 ? 4 : 0) : 0
                      const [month, year] = label.split(' ')
                      // N'affiche le mois en clair qu'un mois sur deux (+ toujours le dernier)
                      // pour éviter la surcharge de 12 libellés collés sur mobile.
                      const showLabel = i % 2 === 0 || isLast
                      return (
                        <div key={label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                          <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                            <div
                              className={`w-full rounded-t transition-all duration-500 ${isLast ? 'bg-gold' : 'bg-gold/30'}`}
                              style={{ height: `${height}px` }}
                            />
                          </div>
                          {count > 0 && (
                            <span className="text-[8px] text-gold font-variant-numeric tabular-nums">{count}</span>
                          )}
                          {showLabel ? (
                            <span className={`text-[9px] leading-tight ${isLast ? 'text-text-sec font-medium' : 'text-text-dim'}`}>
                              {month}
                              {(isFirst || isLast) && <><br />{year}</>}
                            </span>
                          ) : (
                            <span className="text-[9px] leading-tight opacity-0 select-none">·</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Heatmap 90 jours */}
            {heatmapWeeks.length > 0 && (
              <div>
                <h2 className="text-xs text-text-dim uppercase tracking-widest mb-4">Activité — 90 derniers jours</h2>
                <div className="bg-card border border-border rounded-2xl p-4 overflow-x-auto scrollbar-none">
                  <div className="flex gap-1 w-max">
                    {heatmapWeeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-1">
                        {week.map(day => (
                          <div
                            key={day.date}
                            title={`${day.date} · ${day.count} activité${day.count !== 1 ? 's' : ''}`}
                            className={`w-3 h-3 rounded-sm ${heatColor(day.count)}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <InstallPrompt />

        {/* Mes listes */}
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
                      <button onClick={() => deleteListMutation.mutate(list.id)} aria-label={`Supprimer la liste ${list.name}`} className="w-8 h-8 flex items-center justify-center">
                        <Trash2 size={13} className="text-red" />
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

        {/* Récemment vus */}
        {recent.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-text-dim uppercase tracking-widest">Récemment vus</h2>
              <button onClick={() => navigate('/watchlist')} className="text-xs text-gold">Voir tout</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {recent.slice(0, 6).map(entry => (
                <MediaCard
                  key={entry.id}
                  item={entry}
                  onClick={() => navigate(`/${entry.media.mediaType}/${entry.media.tmdbId}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
