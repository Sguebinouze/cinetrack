import { TMDB_IMAGE } from '../services/api'
import { Star, Tv, Film } from 'lucide-react'

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

export default function MediaListItem({ item, onClick }) {
  const media = item.media
  const title = media.title || media.name
  const poster = TMDB_IMAGE(media.posterPath, 'w185')
  const year = (media.releaseDate || '').slice(0, 4)

  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-2.5 text-left active:opacity-70">
      <div className="w-12 h-[72px] rounded-lg overflow-hidden bg-bg flex-shrink-0">
        {poster
          ? <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-text-dim">{media.mediaType === 'tv' ? <Tv size={16} /> : <Film size={16} />}</div>
        }
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary leading-tight line-clamp-2">{title}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {year && <span className="text-xs text-text-dim">{year}</span>}
          <span className="flex items-center gap-1 text-xs text-text-dim">
            {media.mediaType === 'tv' ? <Tv size={11} /> : <Film size={11} />}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {item.status && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[item.status]}`}>
            {statusLabels[item.status]}
          </span>
        )}
        {item.rating > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-gold">
            <Star size={10} className="fill-gold" />
            {item.rating}
          </span>
        )}
      </div>
    </button>
  )
}
