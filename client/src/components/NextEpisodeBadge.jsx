import { useQuery } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import { episodesApi } from '../services/api'
import { formatNextEpisode } from '../utils/airDate'

const ENDED = ['Ended', 'Canceled']

/**
 * Encart « Prochain épisode ».
 *
 * TVmaze est prioritaire sur TMDB pour la date : TMDB se trompe systématiquement d'un
 * jour sur les séries Apple TV+ (vérifié sur Silo S2 — TMDB annonce jeudi, Apple diffuse
 * le vendredi). Si TVmaze ne connaît pas la série, on retombe sur TMDB : une date
 * approximative vaut mieux que pas de badge du tout.
 *
 * Ne rend rien si la série est terminée, si aucun épisode n'est programmé, ou si la
 * date est déjà passée (source en retard).
 *
 * @param {{ tmdbId: string | number, detail: object }} props
 */
export default function NextEpisodeBadge({ tmdbId, detail }) {
  const isEnded = ENDED.includes(detail?.status)

  const { data: tvmaze } = useQuery({
    queryKey: ['next-episode', String(tmdbId)],
    queryFn: () => episodesApi.nextEpisode(tmdbId),
    enabled: !!detail && !isEnded,
    staleTime: 1000 * 60 * 60 * 6,
  })

  if (isEnded) return null

  const tmdbNext = detail?.next_episode_to_air
  const info = tvmaze
    ? tvmaze
    : tmdbNext?.air_date
      ? {
          kind: null, airdate: tmdbNext.air_date, airtime: null, airstamp: null,
          season: tmdbNext.season_number, episode: tmdbNext.episode_number, name: tmdbNext.name,
        }
      : null

  const air = formatNextEpisode(info)
  if (!air || air.isPast) return null

  const code = `S${String(info.season).padStart(2, '0')}E${String(info.episode).padStart(2, '0')}`
  const imminent = air.days <= 1

  // Heure exacte (chaîne) → « à 3h00 ». Heure dérivée de la plateforme → « à partir de
  // 9h00 » : on ne fait pas passer une convention pour une donnée.
  const quand = air.time
    ? `${air.label} ${air.exact ? 'à' : 'à partir de'} ${air.time}`
    : air.label

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-3.5 py-3 mb-5">
      <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center flex-shrink-0">
        <CalendarClock size={16} className="text-gold" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-text-dim uppercase tracking-widest">Prochain épisode</p>
        <p className={`text-sm font-medium truncate ${imminent ? 'text-gold' : 'text-text-primary'}`}>{quand}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-text-sec font-variant-numeric tabular-nums">{code}</p>
        {info.name && <p className="text-[10px] text-text-dim truncate max-w-[8rem]">{info.name}</p>}
      </div>
    </div>
  )
}
