import { useQuery } from '@tanstack/react-query'
import { Film, Tv, Star, Clock, TrendingUp, AlertCircle, Search } from 'lucide-react'
import { statsApi } from '../services/api'
import { useNavigate } from 'react-router-dom'

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

export default function StatsPage() {
  const navigate = useNavigate()
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.get,
    staleTime: 1000 * 60,
  })

  const hours = stats ? Math.floor(stats.minutesWatched / 60) : null
  const maxBar = stats ? Math.max(...(stats.monthlyActivity || []).map(m => m.count), 1) : 1
  const isEmpty = stats && stats.totalWatched === 0 && stats.watchlist === 0 && stats.watching === 0

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
      <div className="safe-top px-4 pt-4 pb-3 border-b border-border/50">
        <h1 className="font-serif text-xl text-text-primary">Statistiques</h1>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {/* Erreur */}
        {isError && (
          <div className="flex items-center gap-3 bg-red/10 border border-red/20 rounded-xl p-4">
            <AlertCircle size={18} className="text-red flex-shrink-0" />
            <p className="text-sm text-red">Impossible de charger les statistiques.</p>
          </div>
        )}

        {/* Skeletons */}
        {isLoading && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 bg-card rounded-2xl animate-pulse" />
              ))}
            </div>
            <div className="h-48 bg-card rounded-2xl animate-pulse" />
          </>
        )}

        {/* État vide — aucun titre */}
        {!isLoading && !isError && isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <TrendingUp size={44} strokeWidth={1} className="text-text-dim opacity-30 mb-3" />
            <p className="text-sm text-text-sec mb-1">Tes stats apparaîtront ici</p>
            <p className="text-xs text-text-dim mb-5">Commence par ajouter des films et séries à ta liste</p>
            <button
              onClick={() => navigate('/search')}
              className="flex items-center gap-2 bg-gold/10 border border-gold/30 text-gold text-sm px-4 py-2.5 rounded-xl font-medium"
            >
              <Search size={15} />
              Découvrir
            </button>
          </div>
        )}

        {/* Contenu */}
        {!isLoading && !isError && stats && !isEmpty && (
          <>
            {/* Grille stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Films vus" value={stats.movies} icon={Film} />
              <StatCard label="Séries vues" value={stats.series} icon={Tv} color="text-blue" />
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
                color="text-gold"
              />
              <StatCard label="À voir" value={stats.watchlist} icon={Film} color="text-text-dim" sub={stats.watching > 0 ? `${stats.watching} en cours` : null} />
            </div>

            {/* Top genres */}
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

            {/* Graphique activité mensuelle */}
            {stats.monthlyActivity?.length > 0 && (
              <div>
                <h2 className="text-xs text-text-dim uppercase tracking-widest mb-4">Activité — 12 derniers mois</h2>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-end gap-1 h-24">
                    {stats.monthlyActivity.map(({ label, count }, i) => {
                      const isLast = i === stats.monthlyActivity.length - 1
                      const height = maxBar > 0 ? Math.max((count / maxBar) * 80, count > 0 ? 4 : 0) : 0
                      return (
                        <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                          <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                            <div
                              className={`w-full rounded-t transition-all duration-500 ${isLast ? 'bg-gold' : 'bg-gold/30'}`}
                              style={{ height: `${height}px` }}
                            />
                          </div>
                          {count > 0 && (
                            <span className="text-[8px] text-gold font-variant-numeric tabular-nums">{count}</span>
                          )}
                          <span className={`text-[8px] ${isLast ? 'text-text-sec' : 'text-text-dim'}`}>{label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Heatmap d'activité (90 derniers jours) */}
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
      </div>
    </div>
  )
}
