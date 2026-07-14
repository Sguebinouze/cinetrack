import { useCallback, useEffect, useState } from 'react'
import { Check, AlertCircle } from 'lucide-react'
import { ToastContext } from '../hooks/useToast'

const VARIANTS = {
  success: { icon: Check, ring: 'border-green/30', tint: 'bg-green/10 border-green/25', color: 'text-green' },
  error: { icon: AlertCircle, ring: 'border-red/30', tint: 'bg-red/10 border-red/25', color: 'text-red' },
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const show = useCallback((message, variant = 'success') => {
    // La clé force le remontage : deux toasts identiques d'affilée relancent
    // bien l'animation et le minuteur au lieu de passer inaperçus.
    setToast({ message, variant, key: Symbol() })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const { icon: Icon, ring, tint, color } = VARIANTS[toast?.variant] || VARIANTS.success

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px)+12px)] inset-x-4 z-[70] max-w-lg mx-auto pointer-events-none"
        >
          <div className={`flex items-center gap-3 bg-surface border ${ring} rounded-2xl shadow-lg shadow-black/40 p-3.5 animate-toast-in`}>
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${tint}`}>
              <Icon size={15} className={color} strokeWidth={2} />
            </div>
            <p className="text-sm text-text-primary min-w-0 flex-1">{toast.message}</p>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
