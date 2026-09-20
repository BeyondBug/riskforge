import { lazy, Suspense } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { DISCLAIMER } from './api/client'
import Navbar from './components/Navbar'
import { Spinner } from './components/Severity'

const Advisor = lazy(() => import('./pages/Advisor'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Findings = lazy(() => import('./pages/Findings'))
const Optimizer = lazy(() => import('./pages/Optimizer'))
const Report = lazy(() => import('./pages/Report'))

const PAGE_NAMES: Record<string, string> = { '/': 'Executive overview', '/findings': 'Risk findings', '/optimizer': 'Investment optimizer', '/advisor': 'AI risk advisor', '/report': 'Executive reports' }

export default function App() {
  const location = useLocation()
  return <div className="flex min-h-full flex-col bg-base lg:flex-row">
    <a href="#main-content" className="sr-only z-50 rounded bg-accent px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
    <Navbar />
    <div className="flex min-w-0 flex-1 flex-col">
      <Topbar page={PAGE_NAMES[location.pathname] ?? 'RiskForge'} />
      <main id="main-content" className="w-full flex-1 px-4 py-7 sm:px-6 xl:px-10">
        <Suspense fallback={<div className="rf-card p-6"><Spinner label="Loading page…" /></div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/findings" element={<Findings />} />
            <Route path="/optimizer" element={<Optimizer />} />
            <Route path="/advisor" element={<Advisor />} />
            <Route path="/report" element={<Report />} />
            <Route path="*" element={<div className="rf-card p-8"><h1 className="text-xl font-semibold text-paper">Page not found</h1><p className="mt-2 text-muted">That page does not exist. Use the navigation to continue.</p></div>} />
          </Routes>
        </Suspense>
      </main>
      <footer className="border-t border-edge bg-white px-6 py-4 text-center text-xs text-muted">{DISCLAIMER} Synthetic Demo Dataset.</footer>
    </div>
  </div>
}

function Topbar({ page }: { page: string }) {
  return <header className="sticky top-0 z-10 hidden h-16 items-center gap-5 border-b border-edge bg-white px-6 lg:flex xl:px-8">
    <p className="whitespace-nowrap text-sm"><span className="font-semibold text-paper">RiskForge</span><span className="mx-2 text-edge">/</span><span className="text-muted">{page}</span></p>
    <div className="flex-1" />
    <Link to="/advisor" className="whitespace-nowrap rounded-md border border-edge bg-white px-3 py-2 text-xs font-medium text-paper hover:bg-base">Ask RiskForge AI</Link>
  </header>
}
