import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tv, AlertCircle, Radio } from 'lucide-react'
import { tvGuideApi } from '../services/api'
import TvProgramSheet from '../components/TvProgramSheet'
import {
  parisToday, dayLabel, dayTitle, formatTime, formatDuration,
  isLive, liveProgress, featuredProgram, mainCategory,
} from '../utils/tvGuide'

const ALL = '__all__'

export default function TvGuidePage() {
  // `null` = « le jour courant », que le serveur résout lui-même : il connaît la
  // fenêtre réellement importée, le client non.
  const [day, setDay] = useState(null)
  const [channelId, setChannelId] = useState(() => localStorage.getItem('cinetrack-tv-channel') || ALL)
  const [opened, setOpened] = useState(null)

  // Les badges « en ce moment » et les barres d'avancement seraient figés sans ça :
  // la donnée ne change pas, c'est l'heure qui avance.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tv-guide', day],
    queryFn: () => tvGuideApi.day(day),
    staleTime: 1000 * 60 * 10,
    // Sans ça, changer de jour vide `data` le temps de la requête : les onglets de
    // jours et le rail de chaînes disparaissent puis reviennent, et la page saute.
    placeholderData: (previous) => previous,
  })

  const today = parisToday(now)
  const days = data?.days || []
  const currentDay = data?.day || null
  const channels = useMemo(() => data?.channels || [], [data])

  const selected = channels.find(c => c.id === channelId) || null
  const showAll = channelId === ALL || !selected

  const pickChannel = (id) => {
    setChannelId(id)
    localStorage.setItem('cinetrack-tv-channel', id)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="pt-header px-4 bg-bg sticky top-0 z-10 border-b border-border/50">
        <div className="mb-3">
          <h1 className="font-serif text-xl text-text-primary">Programme TV</h1>
          <p className="text-xs text-text-dim mt-0.5">
            {currentDay ? dayTitle(currentDay) : 'TNT · 30 chaînes'}
          </p>
        </div>

        {/* Jours — la fenêtre vient du serveur, elle vaut J-2 → J+4 */}
        {days.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
            {days.map(d => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`flex-shrink-0 min-h-[40px] px-3.5 rounded-full text-sm font-medium border transition-colors ${
                  d === currentDay ? 'bg-gold text-bg border-gold' : 'text-text-sec border-border bg-card'
                }`}
              >
                {dayLabel(d, today)}
              </button>
            ))}
          </div>
        )}

        {/* Chaînes — « Tout » en tête donne la photo des 30 chaînes d'un coup d'œil */}
        {channels.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-3 pt-1">
            <button
              onClick={() => pickChannel(ALL)}
              className={`flex-shrink-0 min-h-[44px] px-4 rounded-full text-xs font-medium border transition-colors ${
                showAll ? 'bg-gold/15 text-gold border-gold/30' : 'text-text-sec border-border bg-card'
              }`}
            >
              Tout
            </button>
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => pickChannel(ch.id)}
                aria-label={ch.name}
                className={`flex-shrink-0 w-11 h-11 rounded-full border overflow-hidden flex items-center justify-center transition-colors ${
                  ch.id === channelId ? 'border-gold bg-gold/10' : 'border-border bg-card'
                }`}
              >
                {ch.logo
                  ? <img src={ch.logo} alt="" loading="lazy" className="w-8 h-8 object-contain" />
                  : <span className="text-[9px] text-text-sec px-1 leading-tight">{ch.name}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-nav scrollbar-none">
        {isError && (
          <div className="mx-4 mt-4 flex items-center gap-3 bg-red/10 border border-red/20 rounded-xl p-4">
            <AlertCircle size={18} className="text-red flex-shrink-0" />
            <p className="text-sm text-red">Impossible de charger le programme.</p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col gap-2 px-4 pt-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && !isError && channels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-text-dim px-8 text-center">
            <Tv size={44} strokeWidth={1} className="mb-3 opacity-30" />
            <p className="text-sm text-text-sec mb-1">Aucun programme</p>
            <p className="text-xs text-text-dim">La grille n'a pas encore été importée.</p>
          </div>
        )}

        {!isLoading && !isError && channels.length > 0 && showAll && (
          <ChannelOverview
            channels={channels}
            day={currentDay}
            today={today}
            now={now}
            onPick={(program, channelName) => setOpened({ program, channelName })}
            onChannel={pickChannel}
          />
        )}

        {!isLoading && !isError && selected && !showAll && (
          <ChannelDay
            channel={selected}
            day={currentDay}
            today={today}
            now={now}
            onPick={(program) => setOpened({ program, channelName: selected.name })}
          />
        )}
      </div>

      {opened && (
        <TvProgramSheet
          program={opened.program}
          channelName={opened.channelName}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  )
}

/** Une ligne par chaîne : ce qui passe en ce moment, ou la première partie de soirée. */
function ChannelOverview({ channels, day, today, now, onPick, onChannel }) {
  return (
    <div className="flex flex-col gap-2 px-4 pt-3">
      <p className="text-xs text-text-dim uppercase tracking-widest mb-1">
        {day === today ? 'En ce moment' : 'Première partie de soirée'}
      </p>
      {channels.map(ch => {
        const program = featuredProgram(ch.programs, day, today, now)
        if (!program) return null
        const progress = liveProgress(program, now)
        return (
          <div key={ch.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-stretch">
              <button
                onClick={() => onChannel(ch.id)}
                aria-label={`Toute la journée sur ${ch.name}`}
                className="flex-shrink-0 w-16 flex items-center justify-center border-r border-border active:bg-white/5"
              >
                {ch.logo
                  ? <img src={ch.logo} alt={ch.name} loading="lazy" className="w-9 h-9 object-contain" />
                  : <span className="text-[10px] text-text-sec px-1 text-center leading-tight">{ch.name}</span>}
              </button>
              <button
                onClick={() => onPick(program, ch.name)}
                className="flex-1 min-w-0 text-left p-3 active:bg-white/5"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-text-dim tabular-nums">{formatTime(program.startsAt)}</span>
                  {progress !== null && (
                    <span className="flex items-center gap-1 text-[10px] text-gold">
                      <Radio size={10} />
                      en direct
                    </span>
                  )}
                  {mainCategory(program.categories) && (
                    <span className="text-[10px] text-text-dim truncate">{mainCategory(program.categories)}</span>
                  )}
                </div>
                <p className="text-sm text-text-primary leading-snug line-clamp-2">{program.title}</p>
                {program.subTitle && (
                  <p className="text-xs text-text-sec mt-0.5 line-clamp-1">{program.subTitle}</p>
                )}
              </button>
            </div>
            {progress !== null && (
              <div className="h-0.5 bg-border">
                <div className="h-full bg-gold" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** La journée complète d'une chaîne, de la matinée aux programmes de nuit. */
function ChannelDay({ channel, day, today, now, onPick }) {
  const featured = featuredProgram(channel.programs, day, today, now)
  const anchor = useRef(null)

  // Sans ça on ouvre sur les dessins animés de 5h50 et il faut faire défiler la
  // journée entière pour arriver à ce qu'on cherche.
  useEffect(() => {
    anchor.current?.scrollIntoView({ block: 'center' })
  }, [channel.id, day])

  return (
    <div className="flex flex-col px-4 pt-3">
      {channel.programs.map(program => {
        const live = isLive(program, now) && day === today
        const progress = live ? liveProgress(program, now) : null
        const category = mainCategory(program.categories)
        const duration = formatDuration(program)
        return (
          <button
            key={program.id}
            ref={program.id === featured?.id ? anchor : null}
            onClick={() => onPick(program)}
            className={`flex gap-3 text-left py-3 border-b border-border/50 active:bg-white/5 ${
              live ? 'border-l-2 border-l-gold pl-3 -ml-3' : ''
            }`}
          >
            <div className="flex-shrink-0 w-12 pt-0.5">
              <span className={`text-sm tabular-nums ${live ? 'text-gold' : 'text-text-dim'}`}>
                {formatTime(program.startsAt)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-primary leading-snug">{program.title}</p>
              {program.subTitle && (
                <p className="text-xs text-text-sec mt-0.5 line-clamp-1">{program.subTitle}</p>
              )}
              <div className="flex items-center gap-2 mt-1 text-[11px] text-text-dim">
                {category && <span>{category}</span>}
                {duration && <span>{duration}</span>}
                {program.episodeLabel && <span className="text-text-sec">{program.episodeLabel}</span>}
              </div>
              {progress !== null && (
                <div className="h-0.5 bg-border rounded-full mt-2 max-w-[160px]">
                  <div className="h-full bg-gold rounded-full" style={{ width: `${progress * 100}%` }} />
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
