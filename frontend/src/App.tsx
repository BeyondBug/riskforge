import { Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import Advisor from './pages/Advisor'
import Dashboard from './pages/Dashboard'
import Findings from './pages/Findings'
import Optimizer from './pages/Optimizer'
import Report from './pages/Report'
import { DISCLAIMER } from './api/client'

export default function App() {
  return (
    <div className="flex min-h-full flex-col bg-base">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/findings" element={<Findings />} />
          <Route path="/optimizer" element={<Optimizer />} />
          <Route path="/advisor" element={<Advisor />} />
          <Route path="/report" element={<Report />} />
          <Route
            path="*"
            element={
              <p className="text-muted">
                That page does not exist. Use the navigation above.
              </p>
            }
          />
        </Routes>
      </main>
      <footer className="border-t border-edge bg-rail px-6 py-4 text-center text-xs text-muted">
        {DISCLAIMER} Synthetic Demo Dataset.
      </footer>
    </div>
  )
}
