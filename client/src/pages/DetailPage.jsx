import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Check, Star, Clock, Film, Tv, ChevronDown, ChevronUp, Trash2, AlertCircle, Loader } from 'lucide-react'
import { tmdbApi, watchlistApi, episodesApi, TMDB_IMAGE } from '../services/api'
import StarRating from '../components/StarRating'
import StatusPicker from '../components/StatusPicker'

export default function DetailPage() {
  const { type, id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showReview, setShowReview] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [expandedSeason, setExpandedSeason] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['detail', type, id],
    queryFn: () => type === 'movie' ? tmdbApi.movie(id) : tmdbApi.tv(id),
  })

  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist', null],
    queryFn: () => watchlistApi.getAll(),
    staleTime: 1000 * 30,
  })

  const { data: seasons = [] } = useQuery({
    queryKey: ['seasons', id],
    queryFn: () => episodesApi.get(id),
    enabled: type === 'tv',
  })

  const entry = watchlist.find(e => e.media.tmdbId === Number(id))

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['watchlist'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
  }

  const addMutation = useMutation({
    mutationFn: ({ status }) => watchlistApi.add(id, type, status),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: (data) => watchlistApi.update(entry?.id, data),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: () => watchlistApi.remove(entry?.id),
    onSuccess: () => { invalidate(); setShowDeleteConfirm(false) },
  })

  const syncMutation = useMutation({
    mutationFn: () => episodesApi.sync(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons', id] }),
  })

  const episodeMutation = useMutation({
    mutationFn: ({ epId, watched }) => episodesApi.markWatched(epId, watched),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons', id] }),
  })

  const handleStatus = (status) => {
    if (!entry) addMutation.mutate({ status })
    else updateMutation.mutate({ status })
  }

  // Rating : si pas encore dans la liste, on ajoute PUIS on met à jour la note
  const handleRating = async (rating) => {
    if (!entry) {
      const newEntry = await watchlistApi.add(id, type, 'watched')
      await watchlistApi.update(newEntry.id, { rating })
      invalidate()
    } else {
      updateMutation.mutate({ rating })
    }
  }

  const handleReviewSave = () => {
    if (!entry) {
      watchlistApi.add(id, type, 'watchlist').then(e =>
        watchlistApi.update(e.id, { reviewPrivate: reviewText }).then(invalidate)
      )
    } else {
      updateMutation.mutate({ reviewPrivate: reviewText })
    }
  }

  // --- Loading ---
  if (isLoading) return (
    <div className="flex flex-col h-full">
      <div className="w-full aspect-[16/9] bg-card animate-pulse" />
      <div className="px-4 pt-4 space-y-3">
        <div className="h-7 w-2/3 bg-card animate-pulse rounded-lg" />
        <div className="h-4 w-1/3 bg-card animate-pulse rounded-lg" />
        <div className="h-20 w-full bg-card animate-pulse rounded-xl" />
      </div>
    </div>
  )

  // --- Erreur ---
  if (isError) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <AlertCircle size={40} className="text-red opacity-60" strokeWidth={1.5} />
      <p className="text-text-sec text-sm">Impossible de charger ce titre.<br />Vérifie ta connexion.</p>
      <button onClick={() => navigate(-1)} className="text-gold text-sm underline underline-offset-2">← Retour</button>
    </div>
  )

  if (!detail) return null

  const title = detail.title || detail.name
  const backdrop = TMDB_IMAGE(detail.backdrop_path, 'w780')
  const poster = TMDB_IMAGE(detail.poster_path, 'w342')
  const year = (detail.release_date || detail.first_air_date || '').slice(0, 4)
  const runtime = detail.runtime || detail.episode_run_time?.[0]
  const genres = (detail.genres || []).map(g => g.name)
  const cast = (detail.credits?.cast || []).slice(0, 8)

  const totalEpisodes = seasons.reduce((a, s) => a + s.episodes.length, 0)
  const watchedEpisodes = seasons.reduce((a, s) => a + s.episodes.filter(e => e.watched).length, 0)

  const isMutating = addMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col min-h-full pb-nav">
      {/* Backdrop */}
      <div className="relative">
        {backdrop
          ? <img src={backdrop} alt="" className="w-full aspect-[16/9] object-cover" />
          : <div className="w-full aspect-[16/9] bg-card" />
        }
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-bg" />

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 safe-top w-9 h-9 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>

        {/* Supprimer */}
        {entry && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="absolute top-4 right-4 safe-top w-9 h-9 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full"
          >
            <Trash2 size={16} className="text-red-400" />
          </button>
        )}
      </div>

      {/* Confirm suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-serif text-lg text-text-primary mb-2">Retirer de la liste ?</h3>
            <p className="text-sm text-text-sec mb-5">Ta note et ton avis seront aussi supprimés.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-border text-text-sec text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-red/20 border border-red/30 text-red-400 text-sm font-medium disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Suppression…' : 'Retirer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <div className="px-4 -mt-8 relative z-10">
        {/* Header avec poster */}
        <div className="flex gap-3 mb-4">
          {poster && (
            <img src={poster} alt={title} className="w-24 rounded-xl shadow-xl flex-shrink-0 -mt-8 border border-border/50" />
          )}
          <div className="pt-2 min-w-0">
            <h1 className="font-serif text-xl leading-tight text-text-primary">{title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-text-sec">{year}</span>
              {runtime && (
                <>
                  <span className="text-text-dim">·</span>
                  <span className="flex items-center gap-1 text-xs text-text-sec"><Clock size={11} />{runtime} min</span>
                </>
              )}
              <span className="text-text-dim">·</span>
              <span className="flex items-center gap-1 text-xs text-text-sec">
                {type === 'movie' ? <Film size={11} /> : <Tv size={11} />}
                {type === 'movie' ? 'Film' : 'Série'}
              </span>
            </div>
            {detail.vote_average > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Star size={11} className="text-gold fill-gold" />
                <span className="text-xs text-gold">{detail.vote_average.toFixed(1)}</span>
                <span className="text-xs text-text-dim">TMDB</span>
              </div>
            )}
          </div>
        </div>

        {/* Genres */}
        {genres.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none mb-4">
            {genres.map(g => (
              <span key={g} className="flex-shrink-0 text-xs bg-card border border-border text-text-sec px-3 py-1 rounded-full">{g}</span>
            ))}
          </div>
        )}

        {/* Synopsis */}
        {detail.overview && (
          <p className="text-sm text-text-sec leading-relaxed mb-5">{detail.overview}</p>
        )}

        {/* Statut */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs text-text-dim uppercase tracking-widest">Statut</h3>
            {isMutating && <Loader size={12} className="text-gold animate-spin" />}
          </div>
          <StatusPicker value={entry?.status} onChange={handleStatus} />
        </div>

        {/* Note */}
        <div className="mb-5">
          <h3 className="text-xs text-text-dim uppercase tracking-widest mb-3">Ma note</h3>
          <StarRating value={entry?.rating || 0} onChange={handleRating} />
        </div>

        {/* Avis privé */}
        <div className="mb-5">
          <button
            onClick={() => {
              setShowReview(v => !v)
              if (!showReview && entry?.reviewPrivate) setReviewText(entry.reviewPrivate)
            }}
            className="flex items-center gap-2 text-xs text-text-dim uppercase tracking-widest mb-3 w-full"
          >
            <span>Mon avis privé</span>
            {entry?.reviewPrivate && <span className="text-gold text-[10px] normal-case tracking-normal">— enregistré</span>}
            {showReview ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
          </button>
          {showReview && (
            <div>
              <textarea
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder="Tes pensées sur ce titre (visible uniquement par toi)…"
                rows={4}
                className="w-full bg-card border border-border rounded-xl p-3 text-sm text-text-primary placeholder:text-text-dim resize-none outline-none focus:border-gold/50 transition-colors"
              />
              <button
                onClick={handleReviewSave}
                className="mt-2 text-sm text-gold font-medium active:opacity-70"
              >
                Enregistrer l'avis
              </button>
            </div>
          )}
        </div>

        {/* Épisodes (séries uniquement) */}
        {type === 'tv' && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-text-dim uppercase tracking-widest">Épisodes</h3>
              {seasons.length === 0
                ? <button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="text-xs text-gold font-medium disabled:opacity-50 flex items-center gap-1"
                  >
                    {syncMutation.isPending && <Loader size={11} className="animate-spin" />}
                    {syncMutation.isPending ? 'Chargement…' : 'Synchroniser'}
                  </button>
                : <span className="text-xs text-text-sec font-variant-numeric tabular-nums">{watchedEpisodes}/{totalEpisodes} vus</span>
              }
            </div>

            {totalEpisodes > 0 && (
              <div className="h-1 bg-card rounded-full mb-4 overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full transition-all duration-300"
                  style={{ width: `${(watchedEpisodes / totalEpisodes) * 100}%` }}
                />
              </div>
            )}

            {seasons.map(season => (
              <div key={season.id} className="mb-2 border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSeason(expandedSeason === season.id ? null : season.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{season.name || `Saison ${season.seasonNumber}`}</span>
                    <span className="text-xs text-text-sec bg-card px-2 py-0.5 rounded-full border border-border">
                      {season.episodes.filter(e => e.watched).length}/{season.episodes.length}
                    </span>
                  </div>
                  {expandedSeason === season.id ? <ChevronUp size={16} className="text-text-dim" /> : <ChevronDown size={16} className="text-text-dim" />}
                </button>

                {expandedSeason === season.id && (
                  <div className="border-t border-border">
                    {season.episodes.map(ep => (
                      <button
                        key={ep.id}
                        onClick={() => episodeMutation.mutate({ epId: ep.id, watched: !ep.watched })}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-white/5 border-b border-border/40 last:border-0 transition-colors"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${ep.watched ? 'bg-green border-green' : 'border-border'}`}>
                          {ep.watched && <Check size={11} className="text-bg" strokeWidth={2.5} />}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-xs text-text-dim mr-2">E{ep.episodeNumber}</span>
                          <span className={`text-sm ${ep.watched ? 'text-text-sec line-through' : 'text-text-primary'} truncate`}>{ep.name}</span>
                        </div>
                        {ep.airDate && <span className="text-[10px] text-text-dim flex-shrink-0">{ep.airDate?.slice(0, 7)}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Casting */}
        {cast.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs text-text-dim uppercase tracking-widest mb-3">Casting</h3>
            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
              {cast.map(person => (
                <div key={person.id} className="flex-shrink-0 text-center w-16">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-card mx-auto mb-1 border border-border">
                    {person.profile_path
                      ? <img src={TMDB_IMAGE(person.profile_path, 'w185')} alt={person.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-card flex items-center justify-center text-text-dim text-lg">{person.name[0]}</div>
                    }
                  </div>
                  <div className="text-[10px] text-text-sec leading-tight line-clamp-2">{person.name}</div>
                  <div className="text-[9px] text-text-dim leading-tight line-clamp-1 mt-0.5">{person.character}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
