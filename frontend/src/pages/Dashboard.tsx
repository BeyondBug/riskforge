import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import KPICard from '../components/KPICard'
import { ErrorPanel, Spinner, StatusBadge } from '../components/Severity'
import { api, formatINR, formatINRShort, type Assessment, type DependencyStatus, type FindingRow } from '../api/client'

const CRITICAL_SHARE = 0.2

export default function Dashboard() {
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [findings, setFindings] = useState<FindingRow[]>([])
  const [deps, setDeps] = useState<DependencyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [a, f, d] = await Promise.allSettled([api.assessment(), api.findings(), api.deps()])
    if (a.status === 'fulfilled') setAssessment(a.value)
    else setError(a.reason instanceof Error ? a.reason.message : 'Assessment unavailable')
    if (f.status === 'fulfilled') setFindings(f.value.findings)
    if (d.status === 'fulfilled') setDeps(d.value)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  if (error && !assessment) return <ErrorPanel title="Could not load the assessment" detail={error} onRetry={load} />

  const total = assessment?.total_eal_inr ?? 0
  const chartData = Object.entries(assessment?.eal_by_asset_inr ?? {})
    .map(([name, value]) => ({ name, eal: Math.round(value) }))
    .sort((a, b) => b.eal - a.eal)
  const top = findings[0]

  return <div className="space-y-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-paper">Where the money is at risk</h1>
        <p className="mt-1 text-sm text-muted">{assessment ? `Assessment ${assessment.assessment_id} · ${assessment.dataset_label} · ${new Date(assessment.created_at).toLocaleString('en-IN')}` : 'Loading the current assessment…'}</p>
      </div>
      <Link to="/optimizer" className="rf-btn">Build a funding plan</Link>
    </header>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Assessment summary">
      <KPICard label="Total modeled exposure" value={formatINRShort(total)} note={formatINR(total)} tone="danger" loading={loading} />
      <KPICard label="Open findings scored" value={String(assessment?.findings_count ?? 0)} note="Unresolved findings only" tone="accent" loading={loading} />
      <KPICard label="Assets at risk" value={String(assessment?.assets_at_risk ?? 0)} note="Assets with open findings" loading={loading} />
      <KPICard label="Highest single risk" value={top ? formatINRShort(top.eal_inr) : '—'} note={top?.asset_name} tone="danger" loading={loading} />
    </section>

    {deps ? <ServiceStatus status={deps} /> : null}

    <section className="rf-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-medium text-paper">Expected annual loss by asset</h2><p className="text-xs text-muted">Critical bars carry at least {CRITICAL_SHARE * 100}% of portfolio exposure.</p></div>
      <div className="mt-6 h-80" aria-hidden="true">
        {loading ? <div className="flex h-full items-center justify-center"><Spinner label="Scoring findings…" /></div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 40, left: 8 }}><CartesianGrid stroke="#1e3a5f" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} interval={0} angle={-18} textAnchor="end" height={60} tickLine={false} /><YAxis stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} label={{ value: '₹ crore', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v: number) => (v / 1e7).toFixed(1)} /><Tooltip cursor={{ fill: '#1e3a5f33' }} contentStyle={{ background: '#0d1526', border: '1px solid #1e3a5f', borderRadius: 10, color: '#f1f5f9' }} labelStyle={{ color: '#94a3b8' }} formatter={(v: number) => [formatINR(v), 'Expected annual loss']} /><Bar dataKey="eal" radius={[6, 6, 0, 0]} maxBarSize={72}>{chartData.map((row) => <Cell key={row.name} fill={total > 0 && row.eal / total >= CRITICAL_SHARE ? '#ef4444' : '#f59e0b'} />)}</Bar></BarChart></ResponsiveContainer>}
      </div>
      <table className="sr-only"><caption>Expected annual loss by asset</caption><tbody>{chartData.map((row) => <tr key={row.name}><th scope="row">{row.name}</th><td>{formatINR(row.eal)}</td></tr>)}</tbody></table>
    </section>

    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-lg font-medium text-paper">Top risks</h2><Link to="/findings" className="text-sm text-accent hover:underline">Investigate all findings →</Link></div>
      <div className="overflow-x-auto rounded-xl border border-edge"><table className="w-full min-w-[680px] border-collapse"><thead className="bg-rail text-left"><tr><th className="rf-th">Asset</th><th className="rf-th">Finding</th><th className="rf-th text-right">Expected annual loss</th><th className="rf-th text-right">Likelihood</th><th className="rf-th">Status</th></tr></thead><tbody>{loading ? <tr className="bg-card"><td className="rf-td" colSpan={5}><Spinner label="Loading findings…" /></td></tr> : findings.slice(0, 5).map((row) => <tr key={row.finding_id} className="border-t border-edge bg-card"><td className="rf-td font-medium">{row.asset_name}</td><td className="px-4 py-3 text-sm"><span className="text-paper">{row.cve_id ?? row.title}</span>{row.cve_id ? <span className="block text-xs text-muted">{row.title}</span> : null}</td><td className="rf-td tnum text-right">{formatINR(row.eal_inr)}</td><td className="rf-td tnum text-right text-muted">{row.likelihood.toFixed(3)}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div>
    </section>
    <p className="text-xs text-muted">{assessment?.disclaimer}</p>
  </div>
}

function ServiceStatus({ status }: { status: DependencyStatus }) {
  const services = [
    ['Assessment storage', status.dynamodb.mode === 'dynamodb' ? 'DynamoDB connected' : 'In-memory demo mode'],
    ['Report storage', status.s3.mode === 's3' ? 'Amazon S3 connected' : 'Temporary local storage'],
    ['Advisor', status.bedrock.mode === 'bedrock' ? 'Amazon Bedrock ready' : 'Deterministic fallback'],
  ]
  return <section className="rf-card p-5" aria-labelledby="service-heading"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="service-heading" className="text-sm font-medium text-paper">AWS service status</h2><span className="text-xs text-muted">{status.region} · {status.environment}</span></div><ul className="mt-4 grid gap-3 md:grid-cols-3">{services.map(([name, value]) => <li key={name} className="rounded-lg border border-edge bg-base p-3"><span className="block text-xs text-muted">{name}</span><span className="mt-1 block text-sm text-paper">{value}</span></li>)}</ul></section>
}
