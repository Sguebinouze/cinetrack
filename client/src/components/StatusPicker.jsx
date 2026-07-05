import { Clock, Eye, CheckCircle, XCircle } from 'lucide-react'

const statuses = [
  { key: 'watchlist', label: 'À voir', icon: Clock, color: 'text-blue-300 border-blue-500/40 bg-blue-500/10' },
  { key: 'watching', label: 'En cours', icon: Eye, color: 'text-gold border-gold/40 bg-gold/10' },
  { key: 'watched', label: 'Vu', icon: CheckCircle, color: 'text-green border-green/40 bg-green/10' },
  { key: 'dropped', label: 'Abandonné', icon: XCircle, color: 'text-red-400 border-red/40 bg-red/10' },
]

export default function StatusPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {statuses.map(({ key, label, icon: Icon, color }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium ${
            value === key ? color : 'text-text-sec border-border bg-card'
          }`}
        >
          <Icon size={16} strokeWidth={1.8} />
          {label}
        </button>
      ))}
    </div>
  )
}
