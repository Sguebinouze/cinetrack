import { TMDB_IMAGE } from '../services/api'
import { Star, Clock, Tv } from 'lucide-react'

const statusColors = {
  watchlist: 'bg-blue-500/20 text-blue-300',
  watching: 'bg-gold/20 text-gold',
  watched: 'bg-green/20 text-green',
  dropped: 'bg-red/20 text-red-300',
}

const statusLabels = {
  watchlist: 'À voir',
  watching: 'En cours',
  watched: 'Vu',
  dropped: 'Abandonné',
}

export default function MediaCard({ item, onClick, compact = false }) {
  const isEntry = !!item.media
  const media = isEntry ? item.media : item
  const entry = isEntry ? item : null

  const title = media.title || media.name
  const poster = TMDB_IMAGE(media.posterPath || media.poster_path, 'w342')
  const year = (media.releaseDate || media.release_date || media.first_air_date || '').slice(0, 4)
  const type = media.mediaType || media.media_type

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex gap-3 items-center w-full text-left active:bg-white/5 rounded-xl p-2 transition-colors"
      >
        <div className="w-12 h-18 flex-shrink-0 rounded-lg overflow-hidden bg-card">
          {poster
            ? <img src={poster} alt={title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-text-dim"><Tv size={20} /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-text-primary truncate">{title}</div>
          <div className="text-xs text-text-sec mt-0.5">{year} · {type === 'movie' ? 'Film' : 'Série'}</div>
          {entry?.rating && (
            <div className="flex items-center gap-1 mt-1">
              <Star size={11} className="text-gold fill-gold" />
              <span className="text-xs text-gold">{entry.rating}</span>
            </div>
          )}
        </div>
        {entry?.status && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColors[entry.status]}`}>
            {statusLabels[entry.status]}
          </span>
        )}
      </button>
    )
  }

  return (
    <button onClick={onClick} className="flex flex-col text-left active:scale-95 transition-transform">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-card w-full">
        {poster
          ? <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-text-dim"><Tv size={32} /></div>
        }
        {entry?.status && (
          <div className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[entry.status]}`}>
            {statusLabels[entry.status]}
          </div>
        )}
        {entry?.rating && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
            <Star size={10} className="text-gold fill-gold" />
            <span className="text-xs text-gold font-medium">{entry.rating}</span>
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <div className="text-sm font-medium text-text-primary leading-tight line-clamp-2">{title}</div>
        <div className="text-xs text-text-sec mt-0.5">{year}</div>
      </div>
    </button>
  )
}
