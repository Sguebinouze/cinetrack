import { useQuery } from '@tanstack/react-query'
import { Film, Tv, Clock, Star, Award } from 'lucide-react'
import { statsApi } from '../services/api'
import { watchlistApi } from '../services/api'
import { useNavigate } from 'react-router-dom'
import MediaCard from '../components/MediaCard'

export default function ProfilePage() {
  const navigate = useNavigate()

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

  const hours = stats ? Math.floor(stats.minutesWatched / 60) : 0
  const topRecent = recent.slice(0, 6)

  return (
    <div className="flex flex-col min-h-full pb-nav">
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
