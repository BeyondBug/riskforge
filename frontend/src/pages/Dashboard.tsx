import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErrorPanel, Spinner, StatusBadge } from '../components/Severity'
import { api, formatINR, formatINRShort, type Assessment, type DependencyStatus, type FindingRow } from '../api/client'

const PALETTE = ['#0e1397', '#4f1993', '#711c90', '#a7238b', '#ba2589', '#cc2788']

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
  const top = findings[0]
  const assetData = Object.entries(assessment?.eal_by_asset_inr ?? {}).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value)

  return <div className="mx-auto max-w-[1540px] space-y-7">
    <header><h1 className="text-[28px] font-semibold tracking-tight text-paper">Executive cyber risk overview</h1><p className="mt-1 text-sm text-muted">Financial exposure, business impact, and security investment priorities.</p></header>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Risk metrics">
      <Metric label="Expected annual loss" value={formatINRShort(total)} note={formatINR(total)} accent="#cc2788" loading={loading} />
      <Metric label="Highest single risk" value={top ? formatINRShort(top.eal_inr) : '—'} note={top?.asset_name ?? 'No finding'} accent="#a7238b" loading={loading} />
      <Metric label="Open findings" value={String(assessment?.findings_count ?? 0)} note="Unresolved findings scored" accent="#711c90" loading={loading} />
      <Metric label="Assets at risk" value={String(assessment?.assets_at_risk ?? 0)} note="Assets with open findings" accent="#0e1397" loading={loading} />
    </section>

    {deps ? <ServiceStatus status={deps} /> : null}

    <section className="rf-card p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-semibold text-paper">Expected annual loss by asset</h2><p className="mt-1 text-xs text-muted">Current assessment, highest exposure first</p></div><Link to="/findings" className="text-sm font-medium text-brandpurple hover:underline">View findings</Link></div><div className="mt-5" style={{ height: 320 }}>{loading ? <ChartLoader /> : <ResponsiveContainer width="100%" height="100%"><BarChart data={assetData} layout="vertical" margin={{ top: 0, right: 25, bottom: 5, left: 15 }}><CartesianGrid stroke="#e8e4ec" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#706979', fontSize: 11 }} tickFormatter={shortAxis} /><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={120} tick={{ fill: '#706979', fontSize: 11 }} /><Tooltip cursor={{ fill: '#711c9008' }} contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [formatINR(value), 'Expected annual loss']} /><Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>{assetData.map((row, index) => <Cell key={row.name} fill={PALETTE[index % PALETTE.length]} />)}</Bar></BarChart></ResponsiveContainer>}</div></section>

    <section className="rf-card overflow-hidden"><div className="flex items-center justify-between border-b border-edge px-5 py-4"><div><h2 className="text-sm font-semibold text-paper">Priority findings</h2><p className="mt-0.5 text-xs text-muted">Ranked by expected annual loss</p></div><Link to="/findings" className="text-sm font-medium text-brandpurple hover:underline">View all findings</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[720px]"><thead className="bg-base text-left"><tr><th className="rf-th">Asset</th><th className="rf-th">Finding</th><th className="rf-th text-right">Expected annual loss</th><th className="rf-th text-right">Likelihood</th><th className="rf-th">Status</th></tr></thead><tbody>{loading ? <tr><td className="rf-td" colSpan={5}><Spinner label="Loading findings…" /></td></tr> : findings.slice(0, 5).map((row) => <tr key={row.finding_id} className="border-t border-edge hover:bg-base/60"><td className="rf-td font-medium">{row.asset_name}</td><td className="px-4 py-3 text-sm"><span className="text-paper">{row.title}</span><span className="block text-xs text-muted">{row.cve_id ?? 'No CVE assigned'}</span></td><td className="rf-td tnum text-right font-semibold">{formatINR(row.eal_inr)}</td><td className="rf-td tnum text-right text-muted">{row.likelihood.toFixed(3)}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div></section>
    <p className="text-xs text-muted">{assessment?.disclaimer}</p>
  </div>
}

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid #e3dfea', borderRadius: 8, color: '#241d2b', boxShadow: '0 8px 24px rgba(30,20,40,.08)' }
const shortAxis = (value: number) => Math.abs(value) >= 1e7 ? `₹${(value / 1e7).toFixed(1)}Cr` : `₹${(value / 1e5).toFixed(0)}L`

function Metric({ label, value, note, accent, loading }: { label: string; value: string; note: string; accent: string; loading: boolean }) { return <article className="rf-card relative overflow-hidden p-5"><span className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: accent }} /> <p className="text-xs font-medium text-muted">{label}</p>{loading ? <div className="mt-4 h-9 w-28 animate-pulse rounded bg-edge/50" /> : <p className="tnum mt-4 text-3xl font-semibold tracking-tight text-paper">{value}</p>}<p className="mt-2 text-xs text-muted">{note}</p></article> }
function ChartLoader() { return <div className="flex h-full items-center justify-center"><Spinner label="Preparing chart…" /></div> }

function ServiceStatus({ status }: { status: DependencyStatus }) {
  const services = [
    ['Assessment storage', status.dynamodb.mode === 'dynamodb' ? 'DynamoDB connected' : 'In-memory demo mode'],
    ['Report storage', status.s3.mode === 's3' ? 'Amazon S3 connected' : 'Temporary local storage'],
    ['Advisor', status.bedrock.mode === 'bedrock' ? 'Amazon Bedrock ready' : 'Deterministic fallback'],
  ]
  return <section className="rf-card p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-paper">AWS service status</h2><span className="text-xs text-muted">{status.region} · {status.environment}</span></div><div className="mt-4 grid gap-3 md:grid-cols-3">{services.map(([label, value]) => <div key={label} className="rounded-lg border border-edge bg-base px-4 py-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-sm font-medium text-paper">{value}</p></div>)}</div></section>
}
