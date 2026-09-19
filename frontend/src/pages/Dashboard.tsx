import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import KPICard from '../components/KPICard'
import { ErrorPanel, Spinner, StatusBadge } from '../components/Severity'
import {
  api,
  formatINR,
  formatINRShort,
  type Assessment,
  type FindingRow,
  type OptimizationResult,
} from '../api/client'

/** Headline allocation uses the full demo budget so the KPI row is populated. */
const HEADLINE_BUDGET = 500000

/** A bar is critical when it carries at least a fifth of total exposure. */
const CRITICAL_SHARE = 0.2

export default function Dashboard() {
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [findings, setFindings] = useState<FindingRow[]>([])
  const [plan, setPlan] = useState<OptimizationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [a, f, p] = await Promise.all([
          api.assessment(),
          api.findings(),
          api.optimize(HEADLINE_BUDGET),
        ])
        if (cancelled) return
        setAssessment(a)
        setFindings(f.findings)
        setPlan(p)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <ErrorPanel title="Could not load the assessment" detail={error} />
  }

  const total = assessment?.total_eal_inr ?? 0
  const chartData = Object.entries(assessment?.eal_by_asset_inr ?? {})
    .map(([name, value]) => ({ name, eal: Math.round(value) }))
    .sort((a, b) => b.eal - a.eal)

  const assetsProtected = plan
    ? new Set(plan.selected.map((s) => s.asset_id)).size
    : 0

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-paper">
          Where the money is at risk
        </h1>
        <p className="mt-1 text-sm text-muted">
          {assessment
            ? `Assessment ${assessment.assessment_id} · ${assessment.dataset_label}`
            : 'Loading the current assessment…'}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Total modeled exposure"
          value={formatINRShort(total)}
          note={formatINR(total)}
          tone="danger"
          loading={loading}
        />
        <KPICard
          label="Optimal security spend"
          value={plan ? formatINRShort(plan.total_cost_inr) : '—'}
          note={
            plan
              ? `of ${formatINRShort(plan.budget_inr)} budget · ${plan.selected.length} controls`
              : undefined
          }
          tone="accent"
          loading={loading}
        />
        <KPICard
          label="Risk reduction"
          value={plan ? `${plan.reduction_pct_of_portfolio.toFixed(1)}%` : '—'}
          note={plan ? `${formatINRShort(plan.total_eal_reduction_inr)} removed` : undefined}
          tone="success"
          loading={loading}
        />
        <KPICard
          label="Assets protected"
          value={
            plan ? `${assetsProtected} / ${assessment?.assets_at_risk ?? 0}` : '—'
          }
          note={`${assessment?.findings_count ?? 0} open findings scored`}
          loading={loading}
        />
      </section>

      <section className="rf-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium text-paper">
            Expected annual loss by asset
          </h2>
          <p className="text-xs text-muted">
            Red: at least {CRITICAL_SHARE * 100}% of total exposure. Amber: below that.
          </p>
        </div>

        <div className="mt-6 h-80">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner label="Scoring findings…" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
              >
                <CartesianGrid
                  stroke="#1e3a5f"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={60}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: '₹ crore',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#94a3b8',
                    fontSize: 12,
                  }}
                  tickFormatter={(v: number) => (v / 1e7).toFixed(1)}
                />
                <Tooltip
                  cursor={{ fill: '#1e3a5f33' }}
                  contentStyle={{
                    background: '#0d1526',
                    border: '1px solid #1e3a5f',
                    borderRadius: 10,
                    color: '#f1f5f9',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v: number) => [formatINR(v), 'Expected annual loss']}
                />
                <Bar dataKey="eal" radius={[6, 6, 0, 0]} maxBarSize={72}>
                  {chartData.map((row) => (
                    <Cell
                      key={row.name}
                      fill={
                        total > 0 && row.eal / total >= CRITICAL_SHARE
                          ? '#ef4444'
                          : '#f59e0b'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-paper">Top risks</h2>
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full min-w-[680px] border-collapse">
            <thead className="bg-rail text-left">
              <tr>
                <th className="rf-th">Asset</th>
                <th className="rf-th">Finding</th>
                <th className="rf-th text-right">Expected annual loss</th>
                <th className="rf-th text-right">Likelihood</th>
                <th className="rf-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="bg-card">
                  <td className="rf-td" colSpan={5}>
                    <Spinner label="Loading findings…" />
                  </td>
                </tr>
              ) : (
                findings.slice(0, 5).map((row) => (
                  <tr key={row.finding_id} className="border-t border-edge bg-card">
                    <td className="rf-td font-medium">{row.asset_name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-paper">{row.cve_id ?? row.title}</span>
                      {row.cve_id ? (
                        <span className="block text-xs text-muted">{row.title}</span>
                      ) : null}
                    </td>
                    <td className="rf-td tnum text-right">{formatINR(row.eal_inr)}</td>
                    <td className="rf-td tnum text-right text-muted">
                      {row.likelihood.toFixed(3)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-muted">
        {assessment?.disclaimer ??
          'Modeled estimates based on supplied inputs. Not a guarantee of actual losses.'}
      </p>
    </div>
  )
}
