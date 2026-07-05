import { TMDB_IMAGE } from '../services/api'
import { Star, Tv, CheckCircle } from 'lucide-react'

const statusColors = {
  watchlist: 'bg-blue/15 text-blue border border-blue/25',
  watching: 'bg-gold/15 text-gold border border-gold/25',
  watched: 'bg-green/15 text-green border border-green/25',
  dropped: 'bg-red/15 text-red border border-red/25',
}

const statusLabels = {
  watchlist: 'À voir',
  watching: 'En cours',
  watched: 'Vu',
  dropped: 'Abandonné',
}

export default function MediaCard({ item, onClick, inWatchlist = false }) {
  const isEntry = !!item.media
  const media = isEntry ? item.media : item
  const entry = isEntry ? item : null

  const title = media.title || media.name
  const poster = TMDB_IMAGE(media.posterPath || media.poster_path, 'w342')
  const year = (media.releaseDate || media.release_date || media.first_air_date || '').slice(0, 4)

  return (
    <button onClick={onClick} className="flex flex-col text-left active:scale-[0.97] transition-transform">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-card border border-border w-full">
        {poster
          ? <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-text-dim"><Tv size={28} /></div>
        }

        {/* Badge statut (items de la watchlist) */}
        {entry?.status && (
          <div className={`absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm ${statusColors[entry.status]}`}>
            {statusLabels[entry.status]}
          </div>
        )}

        {/* Indicateur "déjà dans ma liste" (résultats de recherche) */}
        {!entry && inWatchlist && (
          <div className="absolute top-1.5 right-1.5 bg-green/90 rounded-full p-0.5">
            <CheckCircle size={14} className="text-bg" strokeWidth={2.5} />
          </div>
        )}

        {/* Note */}
        {entry?.rating && (
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <Star size={9} className="text-gold fill-gold" />
            <span className="text-[10px] text-gold font-medium">{entry.rating}</span>
          </div>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <div className="text-xs font-semibold text-text-primary leading-tight line-clamp-2">{title}</div>
        <div className="text-[10px] text-text-dim mt-1">{year}</div>
      </div>
    </button>
  )
}
