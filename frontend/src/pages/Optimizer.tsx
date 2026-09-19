import { useState } from 'react'
import {
  api,
  formatINR,
  formatINRShort,
  type OptimizationResult,
} from '../api/client'

const DEFAULT_BUDGET = 150000
const MAX_BUDGET = 1000000

export default function Optimizer() {
  const [budget, setBudget] = useState(DEFAULT_BUDGET)
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      <div>
        <h1 className="text-2xl font-semibold text-paper">
          Spend the budget where it removes the most risk
        </h1>
        <p className="mt-1 text-sm text-muted">
          A 0/1 knapsack maximises modeled exposure removed, subject to total
          cost staying within the budget.
        </p>
      </div>

      <section className="rounded-lg border border-edge bg-surface p-5">
        <label htmlFor="budget" className="block text-sm text-muted">
          Security budget
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <input
            id="budget"
            type="range"
            min={10000}
            max={MAX_BUDGET}
            step={5000}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="h-2 w-full max-w-md cursor-pointer accent-accent"
          />
          <input
            type="number"
            min={1}
            max={MAX_BUDGET}
            step={5000}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="tnum w-40 rounded-md border border-edge bg-ink px-3 py-2 text-right text-paper"
            aria-label="Security budget in rupees"
          />
          <button
            type="button"
            onClick={runOptimize}
            disabled={busy || budget <= 0}
            className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Optimizing…' : 'Optimize'}
          </button>
        </div>
        <p className="tnum mt-3 text-sm text-muted">{formatINR(budget)}</p>
      </section>

      {error ? (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
          Optimization failed: {error}
        </p>
      ) : null}

      {result ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-edge bg-surface p-5">
              <p className="text-sm text-muted">Exposure before</p>
              <p className="tnum mt-2 text-2xl font-semibold text-bad">
                {formatINRShort(result.eal_before_inr)}
              </p>
            </div>
            <div className="rounded-lg border border-edge bg-surface p-5">
              <p className="text-sm text-muted">Exposure after</p>
              <p className="tnum mt-2 text-2xl font-semibold text-good">
                {formatINRShort(result.eal_after_inr)}
              </p>
            </div>
            <div className="rounded-lg border border-edge bg-surface p-5">
              <p className="text-sm text-muted">Committed</p>
              <p className="tnum mt-2 text-2xl font-semibold text-paper">
                {formatINR(result.total_cost_inr)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {formatINR(result.budget_remaining_inr)} unspent · solver{' '}
                {result.solver}
              </p>
            </div>
          </div>

          <ControlTable
            title={`Funded (${result.selected.length})`}
            rows={result.selected}
            empty="No control fits this budget. Raise the budget to fund the cheapest one."
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
        <p className="rounded-lg border border-edge bg-surface p-5 text-sm text-muted">
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-edge">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-ink text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Control</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">Reduction</th>
                <th className="px-4 py-3 text-right font-medium">
                  Exposure removed
                </th>
                <th className="px-4 py-3 text-right font-medium">Return</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.control_id} className="border-t border-edge bg-surface">
                  <td className="px-4 py-3 text-paper">{row.name}</td>
                  <td className="tnum px-4 py-3 text-right text-paper">
                    {formatINR(row.cost_inr)}
                  </td>
                  <td className="tnum px-4 py-3 text-right text-muted">
                    {(row.eal_reduction_pct * 100).toFixed(0)}%
                  </td>
                  <td className="tnum px-4 py-3 text-right text-good">
                    {formatINRShort(row.eal_reduction_inr)}
                  </td>
                  <td className="tnum px-4 py-3 text-right text-muted">
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
