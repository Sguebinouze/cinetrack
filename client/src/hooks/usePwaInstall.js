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

// Sur iOS, Chrome/Firefox/Edge ne sont que des habillages de Safari/WebKit
// (imposé par Apple) : ils n'ont PAS le moteur d'installation PWA. Seul
// Safari peut ajouter une vraie PWA standalone à l'écran d'accueil.
function isOtherIosBrowser() {
  return /crios|fxios|edgios|opios/i.test(window.navigator.userAgent)
}

/**
 * Gère l'installation PWA sur les deux plateformes :
 * - Android/Chrome : capture `beforeinstallprompt`, expose `promptInstall()`
 * - iOS/Safari : pas d'API d'installation programmatique — on détecte juste
 *   la plateforme pour afficher l'instruction "Partager > Sur l'écran d'accueil"
 * - iOS/autre navigateur (Chrome, Firefox...) : installation impossible,
 *   on invite à rouvrir le site dans Safari
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

  const onIos = isIos() && !installed

  return {
    installed,
    canPromptInstall: !!deferredPrompt, // Android/Chrome : bouton natif possible
    isIosSafari: onIos && !isOtherIosBrowser(), // iOS Safari : instruction manuelle "Partager > Écran d'accueil"
    isIosOtherBrowser: onIos && isOtherIosBrowser(), // iOS Chrome/Firefox/... : installation impossible depuis ce navigateur
    promptInstall,
  }
}
