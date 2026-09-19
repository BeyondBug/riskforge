/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        surface: '#1e293b',
        edge: '#334155',
        accent: '#3b82f6',
        good: '#22c55e',
        bad: '#ef4444',
        paper: '#f1f5f9',
        muted: '#94a3b8',
      },
    },
  },
  plugins: [],
}
