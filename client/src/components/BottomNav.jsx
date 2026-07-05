import { NavLink } from 'react-router-dom'
import { Search, ListVideo, BarChart2, User } from 'lucide-react'

const tabs = [
  { to: '/search', icon: Search, label: 'Découvrir' },
  { to: '/watchlist', icon: ListVideo, label: 'Ma liste' },
  { to: '/stats', icon: BarChart2, label: 'Stats' },
  { to: '/profile', icon: User, label: 'Profil' },
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
