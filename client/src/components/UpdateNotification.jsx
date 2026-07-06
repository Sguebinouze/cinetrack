import { RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdateNotification() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Vérifie s'il existe une version plus récente toutes les heures —
      // utile pour une PWA gardée ouverte longtemps sans jamais être rechargée.
      if (!registration) return
      setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px)+12px)] inset-x-4 z-[70] max-w-lg mx-auto">
      <div className="flex items-center gap-3 bg-surface border border-gold/30 rounded-2xl shadow-lg shadow-black/40 p-3.5">
        <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center flex-shrink-0">
          <RefreshCw size={16} className="text-gold" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-primary font-medium">Nouvelle version disponible</p>
          <p className="text-xs text-text-dim">Recharge pour profiter des dernières nouveautés</p>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          className="flex-shrink-0 px-3 py-2 rounded-xl bg-gold text-bg text-xs font-medium active:opacity-80"
        >
          Mettre à jour
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-text-dim"
          aria-label="Ignorer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
