import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import { Spinner } from './components/Severity'
import { DISCLAIMER } from './api/client'

const Advisor = lazy(() => import('./pages/Advisor'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Findings = lazy(() => import('./pages/Findings'))
const Optimizer = lazy(() => import('./pages/Optimizer'))
const Report = lazy(() => import('./pages/Report'))

export default function App() {
  return (
    <div className="flex min-h-full flex-col bg-base">
      <a href="#main-content" className="sr-only z-50 rounded bg-accent px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
      <Navbar />
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Suspense fallback={<div className="rf-card p-6"><Spinner label="Loading page…" /></div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/findings" element={<Findings />} />
          <Route path="/optimizer" element={<Optimizer />} />
          <Route path="/advisor" element={<Advisor />} />
          <Route path="/report" element={<Report />} />
          <Route
            path="*"
            element={
              <div className="rf-card p-8"><h1 className="text-xl font-semibold text-paper">Page not found</h1><p className="mt-2 text-muted">That page does not exist. Use the navigation above.</p></div>
            }
          />
        </Routes>
        </Suspense>
      </main>
      <footer className="border-t border-edge bg-rail px-6 py-4 text-center text-xs text-muted">
        {DISCLAIMER} Synthetic Demo Dataset.
      </footer>
    </div>
  )
}
