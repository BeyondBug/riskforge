import { useEffect, useMemo, useState } from 'react'
import {
  ErrorPanel,
  SeverityBadge,
  Spinner,
  StatusBadge,
} from '../components/Severity'
import { api, formatINR, type FindingRow } from '../api/client'

type SortKey =
  | 'asset_name'
  | 'cve_id'
  | 'severity_score'
  | 'likelihood'
  | 'loss_magnitude_inr'
  | 'eal_inr'
  | 'days_open'
  | 'status'

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'asset_name', label: 'Asset' },
  { key: 'cve_id', label: 'CVE ID' },
  { key: 'severity_score', label: 'CVSS' },
  { key: 'likelihood', label: 'Likelihood', numeric: true },
  { key: 'loss_magnitude_inr', label: 'Loss magnitude', numeric: true },
  { key: 'eal_inr', label: 'Expected annual loss', numeric: true },
  { key: 'days_open', label: 'Days unpatched', numeric: true },
  { key: 'status', label: 'Status' },
]

export default function Findings() {
  const [rows, setRows] = useState<FindingRow[]>([])
  const [disclaimer, setDisclaimer] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sortKey, setSortKey] = useState<SortKey>('eal_inr')
  const [descending, setDescending] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .findings()
      .then((data) => {
        if (cancelled) return
        setRows(data.findings)
        setDisclaimer(data.disclaimer)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') return av - bv
      return String(av ?? '').localeCompare(String(bv ?? ''))
    })
    return descending ? copy.reverse() : copy
  }, [rows, sortKey, descending])

  function toggle(key: SortKey) {
    if (key === sortKey) {
      setDescending((d) => !d)
    } else {
      setSortKey(key)
      setDescending(true)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-paper">Findings</h1>
        <p className="mt-1 text-sm text-muted">
          Sorted by expected annual loss. Every rupee figure is computed from the
          finding's drivers, not entered by hand.
        </p>
      </header>

      {error ? (
        <ErrorPanel title="Could not load findings" detail={error} />
      ) : loading ? (
        <div className="rf-card p-6">
          <Spinner label="Scoring findings…" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full min-w-[1060px] border-collapse">
            <thead className="bg-rail">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className="p-0"
                    aria-sort={
                      sortKey === col.key
                        ? descending
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggle(col.key)}
                      className={`rf-th w-full hover:text-paper ${
                        col.numeric ? 'text-right' : 'text-left'
                      }`}
                    >
                      {col.label}
                      {sortKey === col.key ? (descending ? ' ▾' : ' ▴') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.finding_id} className="border-t border-edge bg-card">
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-paper">{row.asset_name}</span>
                    <span className="block text-xs text-muted">{row.title}</span>
                  </td>
                  <td className="rf-td text-muted">
                    {row.cve_id ?? (
                      <span className="text-xs">no CVE assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge score={row.severity_score} />
                  </td>
                  <td className="rf-td tnum text-right text-muted">
                    {row.likelihood.toFixed(3)}
                  </td>
                  <td className="rf-td tnum text-right">
                    {formatINR(row.loss_magnitude_inr)}
                  </td>
                  <td className="rf-td tnum text-right font-semibold text-bad">
                    {formatINR(row.eal_inr)}
                  </td>
                  <td className="rf-td tnum text-right text-muted">
                    {row.days_open ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {disclaimer ? <p className="text-xs text-muted">{disclaimer}</p> : null}
    </div>
  )
}
