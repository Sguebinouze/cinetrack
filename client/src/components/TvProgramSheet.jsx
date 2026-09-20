import { useQuery } from '@tanstack/react-query'
import { X, Clock, Film, Users } from 'lucide-react'
import { tvGuideApi } from '../services/api'
import SheetBackdrop from './SheetBackdrop'
import { formatTime, formatDuration, dayTitle } from '../utils/tvGuide'

/**
 * Fiche d'un programme TV, en bottom sheet.
 *
 * La grille est servie sans les résumés (trop lourds à rapatrier pour 700 lignes) :
 * c'est ici qu'on va les chercher, à l'ouverture. `program` est la version légère
 * déjà affichée dans la liste — elle sert à peindre l'en-tête immédiatement pendant
 * que le détail charge, plutôt que d'ouvrir sur une feuille vide.
 *
 * @param {object} props
 * @param {{ id: number, title: string, startsAt: string, endsAt?: string }} props.program
 * @param {string} props.channelName
 * @param {() => void} props.onClose
 */
export default function TvProgramSheet({ program, channelName, onClose }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['tv-program', program.id],
    queryFn: () => tvGuideApi.program(program.id),
    staleTime: 1000 * 60 * 60,
  })

  const duration = formatDuration(detail || program)
  const day = (detail || program).day

  return (
    <SheetBackdrop onClose={onClose}>
      {/* Corps scrollable + en-tête figé : un résumé long ne doit pas pousser la
          croix de fermeture hors de l'écran. Hauteur en svh, pas vh. */}
      <div
        className="w-full max-w-lg bg-surface border-t border-border rounded-t-2xl flex flex-col max-h-[85svh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-start gap-3 p-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-text-dim uppercase tracking-widest mb-1">
              {channelName}
            </p>
            <h2 className="font-serif text-lg text-text-primary leading-snug">{program.title}</h2>
            {detail?.subTitle && (
              <p className="text-sm text-text-sec mt-0.5">{detail.subTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center text-text-dim active:opacity-70 flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-none">
          {/* L'image ne voyage que dans le détail : la grille en transporterait 800. */}
          {detail?.imageUrl && (
            <img
              src={detail.imageUrl}
              alt=""
              loading="lazy"
              className="w-full aspect-video object-cover rounded-xl border border-border mb-4"
            />
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-sec">
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-text-dim" />
              {formatTime(program.startsAt)}
              {program.endsAt && ` – ${formatTime(program.endsAt)}`}
            </span>
            {duration && <span className="text-text-dim">{duration}</span>}
            {detail?.episodeLabel && <span className="text-gold">{detail.episodeLabel}</span>}
          </div>
          {day && <p className="text-xs text-text-dim mt-1">{dayTitle(day)}</p>}

          {detail?.categories?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {detail.categories.map(c => (
                <span key={c} className="text-[11px] text-text-sec bg-card border border-border rounded-full px-2.5 py-1">
                  {c}
                </span>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-3 rounded bg-card animate-pulse" style={{ width: `${95 - i * 12}%` }} />
              ))}
            </div>
          )}

          {detail?.description && (
            <p className="text-sm text-text-sec leading-relaxed mt-4">{detail.description}</p>
          )}

          {detail?.director && (
            <div className="mt-4 flex items-start gap-2">
              <Film size={14} className="text-text-dim mt-0.5 flex-shrink-0" />
              <p className="text-sm text-text-sec">
                <span className="text-text-dim">Réalisation </span>
                {detail.director}
              </p>
            </div>
          )}

          {detail?.actors?.length > 0 && (
            <div className="mt-2 flex items-start gap-2">
              <Users size={14} className="text-text-dim mt-0.5 flex-shrink-0" />
              <p className="text-sm text-text-sec">{detail.actors.join(', ')}</p>
            </div>
          )}

          {detail?.csa && detail.csa !== 'Tout public' && (
            <p className="text-xs text-red mt-4">{detail.csa}</p>
          )}

          {!isLoading && !detail?.description && (
            <p className="text-sm text-text-dim mt-4">Pas de résumé pour ce programme.</p>
          )}
        </div>
      </div>
    </SheetBackdrop>
  )
}
