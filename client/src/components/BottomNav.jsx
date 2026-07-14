import { NavLink } from 'react-router-dom'
import { Search, ListVideo, User } from 'lucide-react'

// « Ma liste » en premier : c'est la page d'accueil. Stats a fusionné dans « Moi ».
const tabs = [
  { to: '/watchlist', icon: ListVideo, label: 'Ma liste' },
  { to: '/search', icon: Search, label: 'Découvrir' },
  { to: '/profile', icon: User, label: 'Moi' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-border safe-bottom">
      <div className="flex">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                isActive ? 'text-gold' : 'text-text-dim'
              }`
            }
          >
            <Icon size={22} strokeWidth={1.8} />
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
