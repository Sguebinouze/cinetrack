/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0D13',
        surface: '#12151D',
        card: '#161A23',
        'card-hover': '#1B202B',
        border: '#262B38',
        'border-strong': '#343B4C',
        gold: '#DFB247',
        'gold-soft': '#DFB247',
        'gold-dim': '#8C6E2F',
        'text-primary': '#F4F2ED',
        'text-sec': '#9AA2B2',
        'text-dim': '#5B6273',
        green: '#5FAE84',
        'green-soft': '#5FAE84',
        blue: '#5B8DBE',
        red: '#C0605A',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
        serif: ['Georgia', "'Times New Roman'", 'serif'],
      },
      screens: {
        xs: '375px',
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 180ms ease-out',
      },
    },
  },
  plugins: [],
}
