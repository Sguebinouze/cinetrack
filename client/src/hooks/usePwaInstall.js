import { useEffect, useState, useCallback } from 'react'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // Safari iOS (propriété non standard)
  )
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

/**
 * Gère l'installation PWA sur les deux plateformes :
 * - Android/Chrome : capture `beforeinstallprompt`, expose `promptInstall()`
 * - iOS/Safari : pas d'API d'installation programmatique — on détecte juste
 *   la plateforme pour afficher l'instruction "Partager > Sur l'écran d'accueil"
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault() // empêche la mini-infobar automatique de Chrome
      setDeferredPrompt(e)
    }
    const onAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice // 'accepted' | 'dismissed'
    setDeferredPrompt(null)
    return outcome
  }, [deferredPrompt])

  return {
    installed,
    canPromptInstall: !!deferredPrompt, // Android/Chrome : bouton natif possible
    isIosSafari: isIos() && !installed, // iOS : pas de prompt natif, afficher l'instruction manuelle
    promptInstall,
  }
}
