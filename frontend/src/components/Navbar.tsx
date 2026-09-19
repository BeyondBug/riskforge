import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/findings', label: 'Findings' },
  { to: '/optimizer', label: 'Optimizer' },
  { to: '/advisor', label: 'Advisor' },
  { to: '/report', label: 'Report' },
]

function Mark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-8 w-8"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 2.5 28 8v9.2c0 6.6-4.9 10.9-12 12.3C8.9 28.1 4 23.8 4 17.2V8l12-5.5Z"
        className="fill-accent/15 stroke-accent"
        strokeWidth="1.8"
      />
      <path
        d="M16 10.5v11M11 15.5h10"
        className="stroke-accent"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-rail/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <Mark />
          <div className="leading-tight">
            <p className="text-lg font-semibold tracking-tight text-paper">
              RiskForge
            </p>
            <p className="text-[11px] text-muted">Synthetic Demo Dataset</p>
          </div>
        </div>

        <ul className="flex flex-wrap items-center gap-1">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  [
                    'block rounded-lg px-4 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-accent text-white'
                      : 'text-muted hover:bg-card hover:text-paper',
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
