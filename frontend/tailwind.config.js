/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0f1e',
        card: '#0d1526',
        rail: '#060d1a',
        edge: '#1e3a5f',
        accent: '#3b82f6',
        good: '#22c55e',
        warn: '#f59e0b',
        bad: '#ef4444',
        paper: '#f1f5f9',
        muted: '#94a3b8',
      },
      boxShadow: {
        'glow-bad': '0 0 45px -12px rgba(239, 68, 68, 0.55)',
        'glow-good': '0 0 45px -12px rgba(34, 197, 94, 0.45)',
        'glow-accent': '0 0 45px -12px rgba(59, 130, 246, 0.45)',
      },
    },
  },
  plugins: [],
}