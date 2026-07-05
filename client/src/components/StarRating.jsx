import { Star } from 'lucide-react'

export default function StarRating({ value, onChange, size = 28 }) {
  const stars = [1, 2, 3, 4, 5]

  return (
    <div className="flex gap-1">
      {stars.map(star => (
        <button
          key={star}
          onClick={() => onChange(value === star ? 0 : star)}
          className="active:scale-110 transition-transform"
        >
          <Star
            size={size}
            strokeWidth={1.5}
            className={star <= value ? 'text-gold fill-gold' : 'text-text-dim'}
          />
        </button>
      ))}
    </div>
  )
}
