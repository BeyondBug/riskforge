import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/findings', label: 'Findings' },
  { to: '/optimizer', label: 'Optimizer' },
  { to: '/advisor', label: 'AI advisor' },
  { to: '/report', label: 'Report' },
]

export default function Navbar() {
  return (
    <header className="border-b border-edge bg-surface">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
        <div className="mr-4 flex items-baseline gap-3">
          <span className="text-lg font-semibold tracking-tight text-paper">
            RiskForge
          </span>
          <span className="text-xs text-muted">Synthetic Demo Dataset</span>
        </div>
        <ul className="flex flex-wrap gap-1">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  [
                    'rounded-md px-3 py-1.5 text-sm',
                    isActive
                      ? 'bg-accent text-white'
                      : 'text-muted hover:bg-ink hover:text-paper',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
