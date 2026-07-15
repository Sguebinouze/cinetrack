import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Star, BookOpen, AlertCircle } from 'lucide-react'
import { statsApi, TMDB_IMAGE } from '../services/api'

function groupByDate(entries) {
  const groups = []
  let lastKey = null
  for (const e of entries) {
    const key = e.date.slice(0, 10)
    if (key !== lastKey) {
      groups.push({ key, date: e.date, items: [] })
      lastKey = key
    }
    groups[groups.length - 1].items.push(e)
  }
  return groups
}

export default function JournalPage() {
  const navigate = useNavigate()

  const { data: journal = [], isLoading, isError } = useQuery({
    queryKey: ['journal'],
    queryFn: statsApi.journal,
  })

  const groups = groupByDate(journal)

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-none pb-nav">
      <div className="pt-header px-4 pb-3 bg-bg sticky top-0 z-10 border-b border-border/50 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center -ml-1">
          <ChevronLeft size={20} className="text-text-primary" />
        </button>
        <h1 className="font-serif text-xl text-text-primary">Journal de visionnage</h1>
      </div>

      <div className="px-4 pt-4">
        {isError && (
          <div className="flex items-center gap-3 bg-red/10 border border-red/20 rounded-xl p-4">
            <AlertCircle size={18} className="text-red flex-shrink-0" />
            <p className="text-sm text-red">Impossible de charger le journal.</p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-text-dim text-center px-8">
            <BookOpen size={44} strokeWidth={1} className="mb-3 opacity-30" />
            <p className="text-sm text-text-sec">Ton journal est vide</p>
            <p className="text-xs text-text-dim mt-1">Chaque film ou épisode marqué comme vu apparaîtra ici, daté.</p>
          </div>
        )}

        <div className="space-y-6 pb-4">
          {groups.map(group => (
            <div key={group.key}>
              <h2 className="text-xs text-text-dim uppercase tracking-widest mb-2">
                {new Date(group.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
              <div className="space-y-2">
                {group.items.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(`/${item.type}/${item.tmdbId}`)}
                    className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-2.5 text-left active:opacity-70"
                  >
                    {item.posterPath
                      ? <img src={TMDB_IMAGE(item.posterPath, 'w185')} alt={item.title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                      : <div className="w-10 h-14 rounded-lg bg-bg flex-shrink-0" />
                    }
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary truncate">{item.title}</p>
                      {item.detail && <p className="text-xs text-text-dim truncate">{item.detail}</p>}
                    </div>
                    {item.rating > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Star size={11} className="text-gold fill-gold" />
                        <span className="text-xs text-gold">{item.rating}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
