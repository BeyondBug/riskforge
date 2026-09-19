import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import KPICard from '../components/KPICard'
import {
  api,
  formatINR,
  formatINRShort,
  type Assessment,
  type OptimizationResult,
} from '../api/client'

export default function Dashboard() {
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .assessment()
      .then(setAssessment)
      .catch((e: Error) => setError(e.message))
    // The optimizer may not have been run yet; a 404-free empty state is fine.
    api
      .optimize(500000)
      .then(setOptimization)
      .catch(() => setOptimization(null))
  }, [])

  if (error) {
    return (
      <p className="rounded-lg border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
        Could not load the assessment: {error}. Check that the API is reachable
        at /api/health.
      </p>
    )
  }

  if (!assessment) {
    return <p className="text-muted">Loading the assessment…</p>
  }

  const chartData = Object.entries(assessment.eal_by_asset_inr).map(
    ([name, value]) => ({ name, eal: Math.round(value) }),
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-paper">
          Where the money is at risk
        </h1>
        <p className="mt-1 text-sm text-muted">
          Assessment {assessment.assessment_id} · {assessment.dataset_label}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Modeled annual exposure"
          value={formatINRShort(assessment.total_eal_inr)}
          note={formatINR(assessment.total_eal_inr)}
          tone="bad"
        />
        <KPICard
          label="Budget committed"
          value={
            optimization ? formatINRShort(optimization.total_cost_inr) : '—'
          }
          note={
            optimization
              ? `of ${formatINRShort(optimization.budget_inr)} available`
              : 'Run the optimizer to allocate a budget'
          }
        />
        <KPICard
          label="Exposure removed"
          value={
            optimization
              ? formatINRShort(optimization.total_eal_reduction_inr)
              : '—'
          }
          note={
            optimization
              ? `${optimization.reduction_pct_of_portfolio.toFixed(1)}% of total`
              : undefined
          }
          tone="good"
        />
        <KPICard
          label="Assets at risk"
          value={String(assessment.assets_at_risk)}
          note={`${assessment.findings_count} open findings scored`}
        />
      </div>

      <section className="rounded-lg border border-edge bg-surface p-5">
        <h2 className="text-lg font-medium text-paper">
          Expected annual loss by asset
        </h2>
        <p className="mt-1 text-sm text-muted">
          Each bar is likelihood × loss magnitude for that asset's open findings.
        </p>
        <div className="mt-6 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
            >
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `${(v / 1e7).toFixed(1)}Cr`}
              />
              <Tooltip
                cursor={{ fill: '#33415533' }}
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#f1f5f9',
                }}
                formatter={(v: number) => [formatINR(v), 'Expected annual loss']}
              />
              <Bar dataKey="eal" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <p className="text-xs text-muted">{assessment.disclaimer}</p>
    </div>
  )
}
