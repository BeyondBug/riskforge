import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

type IconName = 'overview' | 'findings' | 'optimizer' | 'advisor' | 'report'

const sections: { label: string; links: { to: string; label: string; icon: IconName; end?: boolean }[] }[] = [
  { label: 'Overview', links: [{ to: '/', label: 'Executive overview', icon: 'overview', end: true }, { to: '/findings', label: 'Risk findings', icon: 'findings' }] },
  { label: 'Decide', links: [{ to: '/optimizer', label: 'Investment optimizer', icon: 'optimizer' }] },
  { label: 'Explain & report', links: [{ to: '/advisor', label: 'AI risk advisor', icon: 'advisor' }, { to: '/report', label: 'Executive reports', icon: 'report' }] },
]

export default function Navbar() {
  return <aside className="border-b border-edge bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[260px] lg:flex-none lg:flex-col lg:border-b-0 lg:border-r">
    <div className="flex h-16 items-center gap-3 border-b border-edge px-5">
      <Logo />
      <div><p className="text-[15px] font-semibold text-paper">RiskForge</p><p className="text-[11px] text-muted">Cyber risk intelligence</p></div>
    </div>

    <div className="border-b border-edge px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Organization</p>
      <div className="mt-2"><span className="block text-sm font-medium text-paper">RiskForge Demo</span><span className="block text-[11px] text-muted">Synthetic dataset</span></div>
    </div>

    <nav className="overflow-x-auto px-3 py-3 lg:flex-1 lg:overflow-y-auto" aria-label="Primary navigation">
      <div className="flex gap-2 lg:block lg:space-y-5">{sections.map((section) => <section key={section.label} className="flex-none"><p className="hidden px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted lg:block">{section.label}</p><ul className="flex gap-1 lg:block lg:space-y-0.5">{section.links.map((link) => <li key={link.to} className="flex-none"><NavLink to={link.to} end={link.end} className={({ isActive }) => ['flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors', isActive ? 'bg-brandpurple/10 font-medium text-brandpurple' : 'text-muted hover:bg-base hover:text-paper'].join(' ')}><NavIcon name={link.icon} /><span className="whitespace-nowrap">{link.label}</span></NavLink></li>)}</ul></section>)}</div>
    </nav>

    <div className="hidden border-t border-edge p-4 lg:block"><div className="rounded-lg bg-base p-3"><p className="text-xs font-medium text-paper">Synthetic Demo Dataset</p><p className="mt-1 text-[11px] leading-4 text-muted">Model riskforge-eal-v1</p></div></div>
  </aside>
}

function Logo() {
  return <span className="grid h-9 w-9 place-items-center rounded-lg bg-brandblue text-white"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3 20 6.7v6.1c0 4.4-3.3 7.3-8 8.2-4.7-.9-8-3.8-8-8.2V6.7L12 3Z" /><path d="M12 8v8M8 12h8" /></svg></span>
}

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-12h6V4h-6v4Z" /></>,
    findings: <><path d="M12 3 3 20h18L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
    optimizer: <><circle cx="12" cy="12" r="8" /><path d="M8 13.5 10.5 16 16 8" /></>,
    advisor: <><path d="M9 18h6M10 22h4" /><path d="M8.2 15.5A7 7 0 1 1 15.8 15.5c-1.1.8-1.3 1.5-1.3 2.5h-5c0-1-.2-1.7-1.3-2.5Z" /></>,
    report: <><path d="M6 3h9l3 3v15H6V3Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  }
  return <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] flex-none" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
