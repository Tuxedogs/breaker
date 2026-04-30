/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#d7e3ff',
        mist: '#9fb4d8',
        rarity: {
          legendary: 'rgb(var(--rarity-legendary-rgb) / <alpha-value>)',
          epic: 'rgb(var(--rarity-epic-rgb) / <alpha-value>)',
          rare: 'rgb(var(--rarity-rare-rgb) / <alpha-value>)',
          uncommon: 'rgb(var(--rarity-uncommon-rgb) / <alpha-value>)',
          common: 'rgb(var(--rarity-common-rgb) / <alpha-value>)',
          quantanium: 'rgb(var(--rarity-quantanium-rgb) / <alpha-value>)',
        },
      },
      backgroundImage: {
        halo: 'radial-gradient(circle at 20% 0%, rgba(79, 113, 255, 0.24), transparent 55%)',
      },
      boxShadow: {
        glass: '0 12px 40px rgba(8, 15, 40, 0.32)',
      },
    },
  },
  plugins: [],
}
