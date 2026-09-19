import { useState } from 'react'
import { ErrorPanel, Spinner } from '../components/Severity'
import {
  api,
  formatINR,
  formatINRShort,
  type OptimizationResult,
} from '../api/client'

const MIN_BUDGET = 0
const MAX_BUDGET = 1000000
const STEP = 5000
const DEFAULT_BUDGET = 500000

export default function Optimizer() {
  const [budget, setBudget] = useState(DEFAULT_BUDGET)
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function clamp(value: number) {
    if (Number.isNaN(value)) return MIN_BUDGET
    return Math.min(Math.max(value, MIN_BUDGET), MAX_BUDGET)
  }

  async function runOptimize() {
    setBusy(true)
    setError(null)
    try {
      setResult(await api.optimize(budget))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-paper">
          Spend the budget where it removes the most risk
        </h1>
        <p className="mt-1 text-sm text-muted">
          A 0/1 knapsack maximises modeled exposure removed, subject to total
          cost staying within the budget.
        </p>
      </header>

      <section className="rf-card p-6">
        <label htmlFor="budget" className="text-xs font-medium uppercase tracking-wide text-muted">
          Security budget
        </label>
        <p className="tnum mt-2 text-3xl font-semibold text-paper">
          {formatINR(budget)}
        </p>

        <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end">
          <div className="flex-1">
            <input
              id="budget"
              type="range"
              min={MIN_BUDGET}
              max={MAX_BUDGET}
              step={STEP}
              value={budget}
              onChange={(e) => setBudget(clamp(Number(e.target.value)))}
              className="w-full cursor-pointer"
            />
            <div className="tnum mt-2 flex justify-between text-xs text-muted">
              <span>₹0</span>
              <span>₹10,00,000</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="number"
              min={MIN_BUDGET}
              max={MAX_BUDGET}
              step={STEP}
              value={budget}
              onChange={(e) => setBudget(clamp(Number(e.target.value)))}
              className="tnum w-44 rounded-lg border border-edge bg-base px-4 py-3 text-right text-paper"
              aria-label="Security budget in rupees"
            />
            <button
              type="button"
              onClick={runOptimize}
              disabled={busy || budget <= 0}
              className="rf-btn tracking-wide"
            >
              {busy ? 'OPTIMIZING…' : 'OPTIMIZE'}
            </button>
          </div>
        </div>

        {budget <= 0 ? (
          <p className="mt-4 text-sm text-warn">
            Set a budget above ₹0 to run the allocation.
          </p>
        ) : null}

        {busy ? (
          <div className="mt-4">
            <Spinner label="Solving the knapsack…" />
          </div>
        ) : null}
      </section>

      {error ? <ErrorPanel title="Optimization failed" detail={error} /> : null}

      {result ? (
        <>
          <section className="rf-card p-6">
            <h2 className="text-lg font-medium text-paper">
              What the spend changes
            </h2>
            <div className="mt-6 grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <Figure
                label="Exposure before"
                value={formatINRShort(result.eal_before_inr)}
                tone="text-bad"
              />
              <Arrow />
              <Figure
                label="Residual exposure"
                value={formatINRShort(result.eal_after_inr)}
                tone="text-good"
              />
              <Arrow />
              <Figure
                label="Reduction"
                value={formatINRShort(result.total_eal_reduction_inr)}
                tone="text-good"
                note={`${result.reduction_pct_of_portfolio.toFixed(1)}% of total exposure`}
              />
            </div>

            <dl className="tnum mt-6 grid gap-4 border-t border-edge pt-5 text-sm sm:grid-cols-3">
              <Stat label="Committed" value={formatINR(result.total_cost_inr)} />
              <Stat label="Unspent" value={formatINR(result.budget_remaining_inr)} />
              <Stat label="Solver" value={result.solver} />
            </dl>
          </section>

          <ControlTable
            title={`Funded controls (${result.selected.length})`}
            rows={result.selected}
            empty="No control fits this budget. Raise it to fund the cheapest one."
          />
          <ControlTable
            title={`Not funded (${result.rejected.length})`}
            rows={result.rejected}
            empty="Everything on the list is funded at this budget."
            dim
          />

          <p className="text-xs text-muted">{result.disclaimer}</p>
        </>
      ) : null}
    </div>
  )
}

function Figure({
  label,
  value,
  tone,
  note,
}: {
  label: string
  value: string
  tone: string
  note?: string
}) {
  return (
    <div className="rounded-lg border border-edge bg-base p-5 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`tnum mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  )
}

function Arrow() {
  return (
    <div className="hidden text-2xl text-muted lg:block" aria-hidden="true">
      →
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-paper">{value}</dd>
    </div>
  )
}

function ControlTable({
  title,
  rows,
  empty,
  dim = false,
}: {
  title: string
  rows: OptimizationResult['selected']
  empty: string
  dim?: boolean
}) {
  return (
    <section className="space-y-3">
      <h2 className={`text-lg font-medium ${dim ? 'text-muted' : 'text-paper'}`}>
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="rf-card p-5 text-sm text-muted">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="bg-rail text-left">
              <tr>
                <th className="rf-th">Control</th>
                <th className="rf-th text-right">Cost</th>
                <th className="rf-th text-right">Risk reduced</th>
                <th className="rf-th">Asset</th>
                <th className="rf-th text-right">Return</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.control_id} className="border-t border-edge bg-card">
                  <td className="rf-td font-medium">{row.name}</td>
                  <td className="rf-td tnum text-right">{formatINR(row.cost_inr)}</td>
                  <td className="rf-td tnum text-right text-good">
                    {formatINRShort(row.eal_reduction_inr)}
                    <span className="ml-2 text-xs text-muted">
                      {(row.eal_reduction_pct * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="rf-td text-muted">{row.asset_id}</td>
                  <td className="rf-td tnum text-right text-muted">
                    {row.roi.toFixed(1)}×
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
