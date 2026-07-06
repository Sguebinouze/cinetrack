import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Sparkles, Film, Tv, Clock, Star } from 'lucide-react'
import { statsApi, TMDB_IMAGE } from '../services/api'

export default function WrappedPage() {
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  const { data, isLoading } = useQuery({
    queryKey: ['wrapped', year],
    queryFn: () => statsApi.wrapped(year),
  })

  const hours = data ? Math.round(data.minutesWatched / 60) : 0
  const isEmpty = data && data.moviesWatched === 0 && data.seriesWatched === 0

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-none pb-nav">
      <div className="safe-top px-4 pt-4 pb-3 bg-bg sticky top-0 z-10 border-b border-border/50 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center -ml-1">
          <ChevronLeft size={20} className="text-text-primary" />
        </button>
        <h1 className="font-serif text-xl text-text-primary">Bilan annuel</h1>
      </div>

      <div className="px-4 pt-5">
        {/* Sélecteur d'année */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 flex items-center justify-center text-text-dim">
            <ChevronLeft size={18} />
          </button>
          <span className="font-serif text-2xl text-gold">{year}</span>
          <button
            onClick={() => setYear(y => Math.min(y + 1, currentYear))}
            disabled={year >= currentYear}
            className="w-8 h-8 flex items-center justify-center text-text-dim disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {isLoading && <div className="h-64 bg-card rounded-2xl animate-pulse" />}

        {!isLoading && isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <Sparkles size={44} strokeWidth={1} className="text-text-dim opacity-30 mb-3" />
            <p className="text-sm text-text-sec">Rien à afficher pour {year}</p>
            <p className="text-xs text-text-dim mt-1">Regarde des films et séries pour débloquer ton bilan.</p>
          </div>
        )}

        {!isLoading && data && !isEmpty && (
          <div className="bg-gradient-to-br from-gold/10 to-transparent border border-gold/20 rounded-3xl p-6 space-y-6">
            <div className="text-center">
              <Sparkles size={28} className="text-gold mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-text-sec">Ton année {year} en un coup d'œil</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-3xl font-bold text-text-primary font-variant-numeric tabular-nums">{data.moviesWatched}</div>
                <div className="text-xs text-text-dim flex items-center justify-center gap-1 mt-1"><Film size={11} /> films vus</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-text-primary font-variant-numeric tabular-nums">{data.distinctSeries}</div>
                <div className="text-xs text-text-dim flex items-center justify-center gap-1 mt-1"><Tv size={11} /> séries suivies</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-text-primary font-variant-numeric tabular-nums">{data.episodesWatched}</div>
                <div className="text-xs text-text-dim mt-1">épisodes vus</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gold font-variant-numeric tabular-nums">{hours}h</div>
                <div className="text-xs text-text-dim flex items-center justify-center gap-1 mt-1"><Clock size={11} /> de visionnage</div>
              </div>
            </div>

            {data.topGenres?.length > 0 && (
              <div className="text-center pt-2 border-t border-gold/10">
                <p className="text-xs text-text-dim mb-2">Tes genres de l'année</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {data.topGenres.map((g, i) => (
                    <span
                      key={g.name}
                      className={`px-3 py-1 rounded-full text-sm border ${
                        i === 0 ? 'bg-gold/15 border-gold/30 text-gold font-medium' : 'bg-card border-border text-text-sec'
                      }`}
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.topMonth && (
              <div className="text-center pt-2 border-t border-gold/10">
                <p className="text-xs text-text-dim mb-1">Ton mois le plus cinéphile</p>
                <p className="text-lg font-serif text-gold">{data.topMonth.label} — {data.topMonth.count} visionnage{data.topMonth.count > 1 ? 's' : ''}</p>
              </div>
            )}

            {data.monthlyBreakdown?.some(m => m.count > 0) && (
              <div className="pt-2 border-t border-gold/10">
                <p className="text-xs text-text-dim mb-3 text-center">Répartition sur l'année</p>
                <div className="flex items-end gap-1 h-16">
                  {data.monthlyBreakdown.map(m => {
                    const max = Math.max(...data.monthlyBreakdown.map(x => x.count), 1)
                    const height = Math.max((m.count / max) * 56, m.count > 0 ? 4 : 0)
                    return (
                      <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end" style={{ height: '56px' }}>
                          <div
                            className={`w-full rounded-t ${m.label === data.topMonth?.label ? 'bg-gold' : 'bg-gold/30'}`}
                            style={{ height: `${height}px` }}
                          />
                        </div>
                        <span className="text-[8px] text-text-dim">{m.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {data.topRated && (
              <div className="flex items-center gap-3 pt-2 border-t border-gold/10">
                {data.topRated.posterPath && (
                  <img src={TMDB_IMAGE(data.topRated.posterPath, 'w185')} alt={data.topRated.title} className="w-12 h-[72px] object-cover rounded-lg" />
                )}
                <div>
                  <p className="text-xs text-text-dim mb-0.5">Ton coup de cœur</p>
                  <p className="text-sm text-text-primary font-medium">{data.topRated.title}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star size={11} className="text-gold fill-gold" />
                    <span className="text-xs text-gold">{data.topRated.rating}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
