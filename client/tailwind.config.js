/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0D12',
        surface: '#151820',
        card: '#1C1F28',
        border: '#252830',
        gold: '#E9C46A',
        'gold-dim': '#9C7D33',
        'text-primary': '#F0EDE6',
        'text-sec': '#8890A0',
        'text-dim': '#505668',
        green: '#4CAF82',
        red: '#C4554A',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
        serif: ['Georgia', "'Times New Roman'", 'serif'],
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
}
