import { createContext, useContext } from 'react'

// Le contexte vit dans son propre fichier : exporter un hook depuis Toast.jsx
// à côté du composant casserait le Fast Refresh de Vite.
export const ToastContext = createContext(() => {})

/** @returns {(message: string, variant?: 'success' | 'error') => void} */
export const useToast = () => useContext(ToastContext)
