import { useMemo, useState } from 'react'
import { formatINR, type FindingRow } from '../api/client'

type SortKey = 'asset_name' | 'cve_id' | 'severity_score' | 'eal_inr' | 'status'

const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'asset_name', label: 'Asset' },
  { key: 'cve_id', label: 'CVE' },
  { key: 'severity_score', label: 'CVSS', numeric: true },
  { key: 'eal_inr', label: 'Expected annual loss', numeric: true },
  { key: 'status', label: 'Status' },
]

export default function FindingsTable({ rows }: { rows: FindingRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('eal_inr')
  const [descending, setDescending] = useState(true)

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

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-edge bg-surface p-6 text-sm text-muted">
        No findings scored yet. Recompute the assessment to populate this table.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-edge">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-ink text-left text-muted">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={col.numeric ? 'text-right' : 'text-left'}
              >
                <button
                  type="button"
                  onClick={() => toggle(col.key)}
                  className={`w-full px-4 py-3 font-medium hover:text-paper ${
                    col.numeric ? 'text-right' : 'text-left'
                  }`}
                  aria-sort={
                    sortKey === col.key
                      ? descending
                        ? 'descending'
                        : 'ascending'
                      : 'none'
                  }
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
            <tr key={row.finding_id} className="border-t border-edge bg-surface">
              <td className="px-4 py-3">
                <div className="text-paper">{row.asset_name}</div>
                <div className="text-xs text-muted">{row.title}</div>
              </td>
              <td className="px-4 py-3 text-muted">
                {row.cve_id ?? <span className="text-xs">no CVE assigned</span>}
              </td>
              <td className="tnum px-4 py-3 text-right text-paper">
                {row.severity_score.toFixed(1)}
              </td>
              <td className="tnum px-4 py-3 text-right text-paper">
                {formatINR(row.eal_inr)}
                <div className="text-xs text-muted">
                  likelihood {row.likelihood.toFixed(3)}
                </div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    row.status === 'open'
                      ? 'bg-bad/15 text-bad'
                      : 'bg-good/15 text-good'
                  }`}
                >
                  {row.status ?? 'unknown'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
