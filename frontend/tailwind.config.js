/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#f6f5f8',
        card: '#ffffff',
        rail: '#ffffff',
        edge: '#e3dfea',
        accent: '#711c90',
        good: '#4f1993',
        warn: '#a7238b',
        bad: '#cc2788',
        paper: '#241d2b',
        muted: '#706979',
        brandblue: '#0e1397',
        brandviolet: '#4f1993',
        brandpurple: '#711c90',
        brandmagenta: '#a7238b',
        brandpink: '#ba2589',
        brandrose: '#cc2788',
      },
      boxShadow: {
        'glow-bad': '0 1px 2px rgba(0, 0, 0, 0.22)',
        'glow-good': '0 1px 2px rgba(0, 0, 0, 0.22)',
        'glow-accent': '0 1px 2px rgba(0, 0, 0, 0.22)',
      },
    },
  },
  plugins: [],
}
