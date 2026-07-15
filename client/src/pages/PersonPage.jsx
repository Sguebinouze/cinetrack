import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, User, AlertCircle, Film, Tv } from 'lucide-react'
import { tmdbApi, TMDB_IMAGE } from '../services/api'
import MediaCard from '../components/MediaCard'

// TMDB renvoie le métier principal en anglais — on le traduit pour les plus courants.
const DEPARTMENTS = {
  Acting: 'Interprétation',
  Directing: 'Réalisation',
  Writing: 'Scénario',
  Production: 'Production',
  Sound: 'Musique / Son',
  Camera: 'Image',
  Editing: 'Montage',
}

// Personnage = « soi-même » → apparition (talk-show, remise de prix…), pas un rôle.
const SELF_ROLE = /\bself\b|lui-m[êe]me|elle-m[êe]me|soi-m[êe]me/i
// Genres TMDB à écarter d'une filmographie : Talk (10767), News (10763).
const TALK_GENRES = new Set([10767, 10763])

export default function PersonPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [bioExpanded, setBioExpanded] = useState(false)
  const [tab, setTab] = useState(null)       // null → onglet par défaut (le plus fourni)
  const [showAll, setShowAll] = useState(false)

  const GRID_LIMIT = 12

  const { data: person, isLoading, isError } = useQuery({
    queryKey: ['person', id],
    queryFn: () => tmdbApi.person(id),
    staleTime: 1000 * 60 * 60,
  })

  if (isLoading) return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-none pb-nav px-4 pt-6">
      <div className="w-28 h-28 rounded-full bg-card animate-pulse mx-auto" />
      <div className="h-6 w-1/2 bg-card animate-pulse rounded-lg mx-auto mt-4" />
      <div className="grid grid-cols-3 gap-3 mt-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] bg-card animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  )

  if (isError) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <AlertCircle size={40} className="text-red opacity-60" strokeWidth={1.5} />
      <p className="text-text-sec text-sm">Impossible de charger cette personne.<br />Vérifie ta connexion.</p>
      <button onClick={() => navigate(-1)} className="text-gold text-sm underline underline-offset-2">← Retour</button>
    </div>
  )

  if (!person) return null

  const photo = TMDB_IMAGE(person.profile_path, 'w342')
  const dept = DEPARTMENTS[person.known_for_department] || person.known_for_department
  const birthYear = person.birthday?.slice(0, 4)

  // Filmo : rôles d'acteur, les plus connus d'abord, dédoublonnés (un acteur est
  // parfois crédité plusieurs fois sur un même titre — voix, caméo, épisodes…).
  // On écarte les apparitions « en tant que soi-même » (talk-shows) : la popularité
  // TMDB les fait remonter en tête alors que ce ne sont pas des rôles.
  const seen = new Set()
  const filmography = (person.combined_credits?.cast || [])
    .filter(c => c.media_type === 'movie' || c.media_type === 'tv')
    .filter(c => !SELF_ROLE.test(c.character || ''))
    .filter(c => !(c.genre_ids || []).some(g => TALK_GENRES.has(g)))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .filter(c => {
      const key = `${c.media_type}-${c.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  const movies = filmography.filter(c => c.media_type === 'movie')
  const series = filmography.filter(c => c.media_type === 'tv')
  // Onglets seulement si les deux types existent ; sinon une simple grille suffit.
  const tabs = [
    { key: 'movie', label: 'Films', icon: Film, items: movies },
    { key: 'tv', label: 'Séries', icon: Tv, items: series },
  ].filter(t => t.items.length > 0)

  // Défaut : l'onglet le plus fourni (un acteur surtout ciné vs surtout séries).
  const activeKey = tab || (movies.length >= series.length ? 'movie' : 'tv')
  const activeItems = (tabs.find(t => t.key === activeKey) || tabs[0])?.items || filmography
  const visible = showAll ? activeItems : activeItems.slice(0, GRID_LIMIT)

  const selectTab = (key) => { setTab(key); setShowAll(false) }

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-none pb-nav">
      {/* Back */}
      <div className="sticky top-0 z-10 pt-header px-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>
      </div>

      <div className="px-4 -mt-9 pb-6">
        {/* En-tête */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-28 h-28 rounded-full overflow-hidden bg-card border border-border">
            {photo
              ? <img src={photo} alt={person.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-text-dim"><User size={40} /></div>}
          </div>
          <h1 className="font-serif text-xl text-text-primary mt-3 leading-tight">{person.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-text-sec flex-wrap justify-center">
            {dept && <span>{dept}</span>}
            {birthYear && (<><span className="text-text-dim">·</span><span>{birthYear}</span></>)}
            {person.place_of_birth && (<><span className="text-text-dim">·</span><span>{person.place_of_birth}</span></>)}
          </div>
        </div>

        {/* Biographie */}
        {person.biography && (
          <div className="mb-6">
            <p className={`text-sm text-text-sec leading-relaxed ${bioExpanded ? '' : 'line-clamp-4'}`}>
              {person.biography}
            </p>
            <button
              onClick={() => setBioExpanded(v => !v)}
              className="mt-1 text-sm text-gold font-medium active:opacity-70"
            >
              {bioExpanded ? 'Réduire' : 'Lire la suite'}
            </button>
          </div>
        )}

        {/* Filmographie */}
        {filmography.length > 0 ? (
          <div>
            <h3 className="text-xs text-text-dim uppercase tracking-widest mb-3">Filmographie</h3>

            {/* Onglets Films / Séries — affichés seulement si les deux types coexistent. */}
            {tabs.length > 1 && (
              <div className="flex gap-2 mb-3">
                {tabs.map(({ key, label, icon: Icon, items }) => (
                  <button
                    key={key}
                    onClick={() => selectTab(key)}
                    className={`flex-1 min-h-[40px] px-2 rounded-full text-sm font-medium transition-colors border flex items-center justify-center gap-1.5 ${
                      activeKey === key ? 'bg-gold text-bg border-gold' : 'text-text-sec border-border bg-card'
                    }`}
                  >
                    <Icon size={13} />
                    {label}
                    <span className={`text-[10px] font-variant-numeric tabular-nums ${activeKey === key ? 'text-bg/70' : 'text-text-dim'}`}>
                      {items.length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {visible.map(item => (
                <MediaCard
                  key={`${item.media_type}-${item.id}`}
                  item={item}
                  onClick={() => navigate(`/${item.media_type}/${item.id}`)}
                />
              ))}
            </div>

            {/* Repli : on ne montre que les GRID_LIMIT plus connus, le reste à la demande. */}
            {activeItems.length > GRID_LIMIT && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full min-h-[44px] mt-4 rounded-xl border border-border text-sm font-medium text-text-sec active:bg-white/5 transition-colors"
              >
                {showAll ? 'Réduire' : `Voir tout (${activeItems.length})`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-dim text-center py-8">Aucune œuvre à afficher.</p>
        )}
      </div>
    </div>
  )
}
