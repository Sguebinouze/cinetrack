import { CalendarClock } from 'lucide-react'
import { formatAirDate } from '../utils/airDate'

// TMDB ne renseigne next_episode_to_air que pour les séries encore diffusées :
// c'est le signal le plus fiable, plus que `status`. On ajoute quand même un
// garde-fou sur les séries terminées, dont le champ traîne parfois.
const ENDED = ['Ended', 'Canceled']

/**
 * Encart « Prochain épisode ». Ne rend rien si aucun épisode n'est programmé,
 * si la série est terminée, ou si la date TMDB est déjà passée (donnée en retard).
 * @param {{ detail: object }} props  Détail TMDB d'une série (/tv/{id}).
 */
export default function NextEpisodeBadge({ detail }) {
  const next = detail?.next_episode_to_air
  if (!next?.air_date || ENDED.includes(detail.status)) return null

  const air = formatAirDate(next.air_date)
  if (!air || air.isPast) return null

  const code = `S${String(next.season_number).padStart(2, '0')}E${String(next.episode_number).padStart(2, '0')}`
  const imminent = air.days <= 1

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-3.5 py-3 mb-5">
      <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center flex-shrink-0">
        <CalendarClock size={16} className="text-gold" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-text-dim uppercase tracking-widest">Prochain épisode</p>
        <p className={`text-sm font-medium truncate ${imminent ? 'text-gold' : 'text-text-primary'}`}>
          {air.text}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-text-sec font-variant-numeric tabular-nums">{code}</p>
        {next.name && <p className="text-[10px] text-text-dim truncate max-w-[8rem]">{next.name}</p>}
      </div>
    </div>
  )
}
