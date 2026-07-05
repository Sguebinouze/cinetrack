import { useQuery } from '@tanstack/react-query'
import { Film, Tv, Star, Clock, TrendingUp } from 'lucide-react'
import { statsApi } from '../services/api'

function StatCard({ label, value, sub, icon: Icon, color = 'text-gold' }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
      <div className={`${color} mb-1`}><Icon size={20} strokeWidth={1.5} /></div>
      <div className="text-2xl font-bold text-text-primary font-variant-numeric tabular-nums">{value ?? '—'}</div>
      <div className="text-xs text-text-sec">{label}</div>
      {sub && <div className="text-xs text-text-dim">{sub}</div>}
    </div>
  )
}

export default function StatsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.get,
    staleTime: 1000 * 60,
  })

  const hours = stats ? Math.floor(stats.minutesWatched / 60) : null
  const maxBar = stats ? Math.max(...stats.monthlyActivity.map(m => m.count), 1) : 1

  return (
    <div className="flex flex-col min-h-full pb-nav">
      <div className="safe-top px-4 pt-4 pb-3">
        <h1 className="font-serif text-xl text-text-primary">Statistiques</h1>
      </div>

      <div className="px-4 space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-card rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <>
            {/* Main stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Films vus" value={stats.movies} icon={Film} />
              <StatCard label="Séries vues" value={stats.series} icon={Tv} color="text-blue-300" />
              <StatCard label="Épisodes vus" value={stats.episodesWatched} icon={TrendingUp} color="text-green" />
              <StatCard
                label="Temps visionné"
                value={`${hours}h`}
                icon={Clock}
                color="text-text-sec"
                sub={`${stats.minutesWatched} minutes`}
              />
              <StatCard
                label="Note moyenne"
                value={stats.avgRating ? stats.avgRating.toFixed(1) : '—'}
                icon={Star}
                color="text-gold"
              />
              <StatCard label="Dans la liste" value={stats.watchlist} icon={Film} color="text-text-dim" />
            </div>

            {/* Top genres */}
            {stats.topGenres.length > 0 && (
              <div>
                <h2 className="text-xs text-text-dim uppercase tracking-widest mb-3">Genres favoris</h2>
                <div className="space-y-2.5">
                  {stats.topGenres.map((g, i) => (
                    <div key={g.name} className="flex items-center gap-3">
                      <span className="text-xs text-text-dim w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-text-primary">{g.name}</span>
                          <span className="text-text-sec">{g.count}</span>
                        </div>
                        <div className="h-1.5 bg-card rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold rounded-full"
                            style={{ width: `${(g.count / stats.topGenres[0].count) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly activity chart */}
            {stats.monthlyActivity.length > 0 && (
              <div>
                <h2 className="text-xs text-text-dim uppercase tracking-widest mb-4">Activité mensuelle</h2>
                <div className="flex items-end gap-1.5 h-28">
                  {stats.monthlyActivity.map(({ label, count }) => (
                    <div key={label} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                        <div
                          className="w-full rounded-t-md bg-gold/40 transition-all"
                          style={{ height: `${(count / maxBar) * 80}px`, minHeight: count > 0 ? 4 : 0 }}
                        />
                      </div>
                      <span className="text-[9px] text-text-dim">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-text-dim text-sm text-center py-20">Aucune donnée disponible</p>
        )}
      </div>
    </div>
  )
}
