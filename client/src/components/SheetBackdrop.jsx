import { createPortal } from 'react-dom'

/**
 * Fond noir d'une bottom sheet, monté en **portal sur `<body>`**.
 *
 * Le portal n'est pas cosmétique : `BottomNav` vit dans `#root` en `z-50` et passe
 * par-dessus une feuille rendue au milieu de l'arbre sur iOS — le bas du panneau
 * (fin d'un texte, bouton d'action) disparaît sous la barre d'onglets. En sortir
 * garantit l'ordre d'empilement quel que soit le contexte créé par les parents.
 *
 * Le panneau lui-même reste à la charge de l'appelant (les formes varient : carte
 * flottante `max-w-sm`, feuille pleine largeur à coins arrondis en haut…). Il doit
 * juste stopper la propagation du clic, sinon se toucher ferme la feuille.
 *
 * @param {object} props
 * @param {() => void} props.onClose   Appelé au clic sur le fond.
 * @param {string} [props.className]   Padding du conteneur (marge autour du panneau).
 * @param {React.ReactNode} props.children  Le panneau.
 */
export default function SheetBackdrop({ onClose, className = '', children }) {
  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm ${className}`}
      onClick={onClose}
    >
      {children}
    </div>,
    document.body
  )
}
