import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Check, CheckCheck, Star, Clock, Film, Tv, ChevronDown, ChevronUp, Trash2, AlertCircle, Loader, ListPlus } from 'lucide-react'
import { tmdbApi, watchlistApi, episodesApi, listsApi, TMDB_IMAGE } from '../services/api'
import StarRating from '../components/StarRating'
import StatusPicker from '../components/StatusPicker'
import MediaCard from '../components/MediaCard'
import NextEpisodeBadge from '../components/NextEpisodeBadge'
import EpisodeSlider from '../components/EpisodeSlider'
import { useToast } from '../hooks/useToast'
import { isAired } from '../utils/airDate'

/**
 * Rejoue localement une action en masse sur le cache des saisons, en reproduisant
 * exactement les règles du serveur (épisodes non diffusés épargnés, watchedAt d'un
 * épisode déjà vu préservé). Permet de basculer les coches sans attendre le réseau.
 * @param {Array} seasons  Cache courant de ['seasons', id].
 * @param {boolean} watched
 * @param {number} [seasonId]  Restreint à une saison ; sinon toute la série.
 */
const applyBulkWatch = (seasons, watched, seasonId) => {
  const now = new Date().toISOString()
  return (seasons || []).map(season =>
    seasonId && season.id !== seasonId ? season : {
      ...season,
      episodes: season.episodes.map(ep =>
        watched && !isAired(ep)
          ? ep
          : { ...ep, watched, watchedAt: watched ? ep.watchedAt || now : null }
      ),
    }
  )
}

const bulkToastMessage = (updated, watched) => {
  if (updated === 0) return 'Tout était déjà à jour'
  const s = updated > 1 ? 's' : ''
  return watched
    ? `${updated} épisode${s} marqué${s} comme vu${s}`
    : `${updated} épisode${s} décoché${s}`
}

export default function DetailPage() {
  const { type, id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [showReview, setShowReview] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [expandedSeason, setExpandedSeason] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showListPicker, setShowListPicker] = useState(false)

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

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations', type, id],
    queryFn: () => tmdbApi.recommendations(type, id),
    enabled: !!detail,
    staleTime: 1000 * 60 * 10,
  })

  const { data: watchProviders } = useQuery({
    queryKey: ['watch-providers', type, id],
    queryFn: () => tmdbApi.watchProviders(type, id),
    enabled: !!detail,
    staleTime: 1000 * 60 * 60,
  })

  const { data: lists = [] } = useQuery({
    queryKey: ['lists'],
    queryFn: listsApi.getAll,
    enabled: showListPicker,
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

  const episodeRatingMutation = useMutation({
    mutationFn: ({ epId, rating }) => episodesApi.rate(epId, rating),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons', id] }),
  })

  // Action en masse. Seule mutation optimiste de la page : cocher 200 épisodes en
  // attendant un aller-retour réseau donnerait l'impression que le bouton est mort.
  // `seasonId` absent = toute la série.
  const bulkWatchMutation = useMutation({
    mutationFn: ({ seasonId, watched }) => seasonId
      ? episodesApi.watchAllSeason(seasonId, watched)
      : episodesApi.watchAllSeries(id, watched),
    onMutate: async ({ seasonId, watched }) => {
      await qc.cancelQueries({ queryKey: ['seasons', id] })
      const previous = qc.getQueryData(['seasons', id])
      qc.setQueryData(['seasons', id], applyBulkWatch(previous, watched, seasonId))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(['seasons', id], context?.previous)
      toast('Impossible de mettre à jour les épisodes', 'error')
    },
    onSuccess: ({ updated, watched }) => toast(bulkToastMessage(updated, watched)),
    // Le statut de la fiche a pu basculer (watchlist → watching → watched) :
    // on resynchronise les épisodes ET la watchlist / les stats.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['seasons', id] })
      invalidate()
    },
  })

  const addToListMutation = useMutation({
    mutationFn: async (listId) => {
      if (!entry) await watchlistApi.add(id, type, 'watchlist')
      return listsApi.addItem(listId, id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lists'] }); invalidate(); setShowListPicker(false) },
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

  // Les actions en masse ne portent que sur les épisodes déjà diffusés : un épisode
  // à venir ne doit jamais être coché, et ne doit pas empêcher le bouton de passer
  // en mode « Tout décocher » une fois la série rattrapée.
  const airedEpisodes = seasons.flatMap(s => s.episodes).filter(ep => isAired(ep))
  const allAiredWatched = airedEpisodes.length > 0 && airedEpisodes.every(ep => ep.watched)

  // « À voir » : les prochains épisodes non-vus déjà diffusés, dans l'ordre.
  // Un épisode à venir n'est jamais « à voir » (cf. progress.js), d'où isAired.
  const upcomingToWatch = seasons
    .flatMap(s => s.episodes.map(ep => ({ ...ep, seasonNumber: s.seasonNumber })))
    .filter(ep => !ep.watched && isAired(ep))
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)
    .slice(0, 10)
  const seriesBulkPending = bulkWatchMutation.isPending && !bulkWatchMutation.variables?.seasonId

  const isMutating = addMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-none pb-nav">
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

        {/* Actions */}
        <div className="absolute top-4 right-4 safe-top flex gap-2">
          <button
            onClick={() => setShowListPicker(true)}
            className="w-9 h-9 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full"
          >
            <ListPlus size={16} className="text-text-primary" />
          </button>
          {entry && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-9 h-9 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full"
            >
              <Trash2 size={16} className="text-red" />
            </button>
          )}
        </div>
      </div>

      {/* Sélection de liste personnalisée */}
      {showListPicker && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-serif text-lg text-text-primary mb-4">Ajouter à une liste</h3>
            {lists.length === 0 ? (
              <p className="text-sm text-text-sec mb-4">Aucune liste pour l'instant. Crée-en une depuis ton profil.</p>
            ) : (
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto scrollbar-none">
                {lists.map(list => {
                  const alreadyIn = list.items.some(i => i.media.tmdbId === Number(id))
                  return (
                    <button
                      key={list.id}
                      onClick={() => !alreadyIn && addToListMutation.mutate(list.id)}
                      disabled={alreadyIn || addToListMutation.isPending}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card text-left text-sm text-text-primary disabled:opacity-50"
                    >
                      <span>{list.name}</span>
                      {alreadyIn && <Check size={14} className="text-green" />}
                    </button>
                  )
                })}
              </div>
            )}
            <button
              onClick={() => setShowListPicker(false)}
              className="w-full py-3 rounded-xl border border-border text-text-sec text-sm font-medium"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Confirm suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8">
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
                className="flex-1 py-3 rounded-xl bg-red/20 border border-red/30 text-red text-sm font-medium disabled:opacity-50"
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

        {/* Plateformes disponibles (France) */}
        {watchProviders && (watchProviders.flatrate?.length > 0 || watchProviders.ads?.length > 0 || watchProviders.buy?.length > 0 || watchProviders.rent?.length > 0) && (
          <div className="mb-4 space-y-3">
            {(watchProviders.flatrate?.length > 0 || watchProviders.ads?.length > 0) && (
              <div>
                <h3 className="text-xs text-text-dim uppercase tracking-widest mb-2">En streaming</h3>
                <div className="flex gap-2 overflow-x-auto scrollbar-none">
                  {[...(watchProviders.flatrate || []), ...(watchProviders.ads || [])].map(p => (
                    <img
                      key={p.provider_id}
                      src={TMDB_IMAGE(p.logo_path, 'w92')}
                      alt={p.provider_name}
                      title={p.provider_name}
                      className="w-10 h-10 rounded-lg flex-shrink-0 border border-border"
                    />
                  ))}
                </div>
              </div>
            )}

            {(watchProviders.buy?.length > 0 || watchProviders.rent?.length > 0) && (
              <div>
                <h3 className="text-xs text-text-dim uppercase tracking-widest mb-2">Achat / location</h3>
                <div className="flex gap-2 overflow-x-auto scrollbar-none">
                  {Array.from(
                    new Map([...(watchProviders.buy || []), ...(watchProviders.rent || [])].map(p => [p.provider_id, p])).values()
                  ).map(p => (
                    <img
                      key={p.provider_id}
                      src={TMDB_IMAGE(p.logo_path, 'w92')}
                      alt={p.provider_name}
                      title={p.provider_name}
                      className="w-10 h-10 rounded-lg flex-shrink-0 border border-border opacity-80"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Synopsis */}
        {detail.overview && (
          <p className="text-sm text-text-sec leading-relaxed mb-5">{detail.overview}</p>
        )}

        {/* Prochain épisode — dates TVmaze, repli TMDB. Masqué si rien n'est programmé. */}
        {type === 'tv' && <NextEpisodeBadge tmdbId={id} detail={detail} />}

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
                    {syncMutation.isPending ? 'Synchronisation…' : 'Synchroniser'}
                  </button>
                : <span className="text-xs text-text-sec font-variant-numeric tabular-nums">{watchedEpisodes}/{totalEpisodes} vus</span>
              }
            </div>

            {syncMutation.isPending && (
              <p className="text-[11px] text-text-dim mb-3 -mt-2">Ça peut prendre quelques secondes pour les séries à nombreuses saisons…</p>
            )}

            {syncMutation.isError && (
              <div className="flex items-center gap-2 bg-red/10 border border-red/20 rounded-lg px-3 py-2 mb-3 -mt-2">
                <AlertCircle size={13} className="text-red flex-shrink-0" />
                <p className="text-xs text-red">Échec de la synchronisation. <button onClick={() => syncMutation.mutate()} className="underline underline-offset-2">Réessayer</button></p>
              </div>
            )}

            {totalEpisodes > 0 && (
              <div className="h-1 bg-card rounded-full mb-4 overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full transition-all duration-300"
                  style={{ width: `${(watchedEpisodes / totalEpisodes) * 100}%` }}
                />
              </div>
            )}

            {/* Bandeau « À voir » : reprends où tu en es, résumé au tap. */}
            {upcomingToWatch.length > 0 && (
              <EpisodeSlider
                tmdbId={id}
                upcoming={upcomingToWatch}
                onToggleWatched={(epId, watched) => episodeMutation.mutate({ epId, watched })}
              />
            )}

            {/* Action en masse sur toute la série (épisodes diffusés uniquement) */}
            {airedEpisodes.length > 0 && (
              <button
                onClick={() => bulkWatchMutation.mutate({ watched: !allAiredWatched })}
                disabled={bulkWatchMutation.isPending}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 mb-4 py-2.5 rounded-xl border border-border text-xs font-medium text-text-sec active:bg-white/5 disabled:opacity-50 transition-colors"
              >
                {seriesBulkPending
                  ? <Loader size={14} className="animate-spin text-gold" />
                  : <CheckCheck size={14} className={allAiredWatched ? 'text-green' : 'text-text-dim'} />
                }
                {allAiredWatched ? 'Tout décocher' : 'Marquer la série comme vue'}
              </button>
            )}

            {seasons.map(season => {
              const label = season.name || `Saison ${season.seasonNumber}`
              const expanded = expandedSeason === season.id
              const toggle = () => setExpandedSeason(expanded ? null : season.id)

              const seasonAired = season.episodes.filter(ep => isAired(ep))
              const seasonAllWatched = seasonAired.length > 0 && seasonAired.every(ep => ep.watched)
              const seasonPending = bulkWatchMutation.isPending && bulkWatchMutation.variables?.seasonId === season.id

              return (
              <div key={season.id} className="mb-2 border border-border rounded-xl overflow-hidden">
                {/* Un <button> ne peut pas en contenir un autre : la ligne est une div,
                    le repli et l'action en masse sont deux boutons frères. */}
                <div className="flex items-center">
                  <button
                    onClick={toggle}
                    className="flex-1 min-w-0 flex items-center gap-2 px-4 py-3 text-left active:bg-white/5"
                  >
                    <span className="text-sm font-medium text-text-primary truncate">{label}</span>
                    <span className="text-xs text-text-sec bg-card px-2 py-0.5 rounded-full border border-border flex-shrink-0">
                      {season.episodes.filter(e => e.watched).length}/{season.episodes.length}
                    </span>
                  </button>

                  {seasonAired.length > 0 && (
                    <button
                      onClick={() => bulkWatchMutation.mutate({ seasonId: season.id, watched: !seasonAllWatched })}
                      disabled={bulkWatchMutation.isPending}
                      aria-label={`${seasonAllWatched ? 'Tout décocher' : 'Tout marquer comme vu'} — ${label}`}
                      // Bordure à gauche : sépare visuellement l'action en masse du repli.
                      // Sans elle, viser le chevron au pouce et toucher ✓✓ cocherait
                      // toute la saison par accident.
                      className={`w-11 h-11 flex items-center justify-center flex-shrink-0 border-l border-border active:bg-white/5 disabled:opacity-40 transition-colors ${seasonAllWatched ? 'text-green' : 'text-text-sec'}`}
                    >
                      {seasonPending
                        ? <Loader size={16} className="animate-spin text-gold" />
                        : <CheckCheck size={16} />
                      }
                    </button>
                  )}

                  <button
                    onClick={toggle}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="w-9 h-11 flex items-center justify-center flex-shrink-0 text-text-dim active:bg-white/5"
                  >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {expanded && (
                  <div className="border-t border-border">
                    {season.episodes.map(ep => (
                      <div key={ep.id} className="px-4 py-2.5 border-b border-border/40 last:border-0">
                        <button
                          onClick={() => episodeMutation.mutate({ epId: ep.id, watched: !ep.watched })}
                          className="w-full flex items-center gap-3 text-left active:opacity-70 transition-opacity"
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
                        {ep.watched && (
                          <div className="pl-8 mt-1.5">
                            <StarRating
                              size={13}
                              value={ep.rating || 0}
                              onChange={(rating) => episodeRatingMutation.mutate({ epId: ep.id, rating })}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )
            })}
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

        {/* Recommandations */}
        {recommendations.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs text-text-dim uppercase tracking-widest mb-3">Recommandé si tu as aimé</h3>
            <div className="grid grid-cols-3 gap-3">
              {recommendations.slice(0, 6).map(item => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onClick={() => navigate(`/${item.media_type || type}/${item.id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
