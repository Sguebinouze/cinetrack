import { Download, Share, Compass } from 'lucide-react'
import { usePwaInstall } from '../hooks/usePwaInstall'

export default function InstallPrompt() {
  const { installed, canPromptInstall, isIosSafari, isIosOtherBrowser, promptInstall } = usePwaInstall()

  if (installed) return null
  if (!canPromptInstall && !isIosSafari && !isIosOtherBrowser) return null // navigateur desktop sans support d'install

  return (
    <div className="bg-card border border-border rounded-xl p-3.5">
      {canPromptInstall && (
        <button
          onClick={promptInstall}
          className="w-full flex items-center gap-3 text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center flex-shrink-0">
            <Download size={16} className="text-gold" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text-primary font-medium">Installer l'application</p>
            <p className="text-xs text-text-dim">Accès rapide depuis ton écran d'accueil</p>
          </div>
        </button>
      )}

      {isIosSafari && (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center flex-shrink-0">
            <Share size={15} className="text-gold" strokeWidth={1.8} />
          </div>
          <p className="text-xs text-text-sec leading-snug">
            Pour installer : <span className="text-text-primary font-medium">Partager</span> puis{' '}
            <span className="text-text-primary font-medium">Sur l'écran d'accueil</span>
          </p>
        </div>
      )}

      {isIosOtherBrowser && (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center flex-shrink-0">
            <Compass size={15} className="text-gold" strokeWidth={1.8} />
          </div>
          <p className="text-xs text-text-sec leading-snug">
            L'installation n'est possible que depuis <span className="text-text-primary font-medium">Safari</span> sur iPhone/iPad — ouvre ce lien dans Safari pour l'ajouter à ton écran d'accueil.
          </p>
        </div>
      )}
    </div>
  )
}
