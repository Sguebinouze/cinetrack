import { Clock, Eye, CheckCircle, XCircle } from 'lucide-react'

const statuses = [
  { key: 'watchlist', label: 'À voir', icon: Clock, color: 'text-blue border-blue/30 bg-blue/10' },
  { key: 'watching', label: 'En cours', icon: Eye, color: 'text-gold border-gold/30 bg-gold/10' },
  { key: 'watched', label: 'Vu', icon: CheckCircle, color: 'text-green border-green/30 bg-green/10' },
  { key: 'dropped', label: 'Abandonné', icon: XCircle, color: 'text-red border-red/30 bg-red/10' },
]

export default function StatusPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {statuses.map(({ key, label, icon: Icon, color }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-2 px-3.5 py-3 rounded-xl border text-sm font-medium active:scale-[0.98] ${
            value === key ? color : 'text-text-sec border-border bg-card hover:border-border-strong'
          }`}
        >
          <Icon size={16} strokeWidth={1.8} />
          {label}
        </button>
      ))}
    </div>
  )
}
