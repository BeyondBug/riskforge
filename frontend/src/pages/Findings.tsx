import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  ErrorPanel,
  SeverityBadge,
  Spinner,
  StatusBadge,
} from '../components/Severity'
import { api, formatINR, type FindingRow, type RiskResult } from '../api/client'

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
  const [details, setDetails] = useState<Record<string, RiskResult>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [disclaimer, setDisclaimer] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sortKey, setSortKey] = useState<SortKey>('eal_inr')
  const [descending, setDescending] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.findings(), api.assessment()])
      .then(([data, assessment]) => {
        if (cancelled) return
        setRows(data.findings)
        setDetails(Object.fromEntries(assessment.results.map((result) => [result.finding_id, result])))
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
    const needle = query.trim().toLocaleLowerCase()
    const copy = rows.filter((row) => !needle || [row.asset_name, row.title, row.cve_id].some((value) => value?.toLocaleLowerCase().includes(needle)))
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') return av - bv
      return String(av ?? '').localeCompare(String(bv ?? ''))
    })
    return descending ? copy.reverse() : copy
  }, [rows, query, sortKey, descending])

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex-1 text-sm text-muted">
          <span className="sr-only">Search findings</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by asset, title, or CVE…" className="w-full max-w-md rounded-lg border border-edge bg-card px-4 py-2.5 text-paper placeholder:text-muted" />
        </label>
        <span className="text-sm text-muted">{sorted.length} of {rows.length} findings</span>
      </div>

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
                <Fragment key={row.finding_id}>
                <tr className="border-t border-edge bg-card">
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
                    <div className="flex items-center gap-3"><StatusBadge status={row.status} /><button type="button" aria-expanded={expanded === row.finding_id} onClick={() => setExpanded((value) => value === row.finding_id ? null : row.finding_id)} className="text-xs text-accent hover:underline">{expanded === row.finding_id ? 'Hide calculation' : 'Show calculation'}</button></div>
                  </td>
                </tr>
                {expanded === row.finding_id && details[row.finding_id] ? <tr key={`${row.finding_id}-detail`} className="border-t border-edge bg-base"><td colSpan={8} className="p-5"><CalculationBreakdown result={details[row.finding_id]} /></td></tr> : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {disclaimer ? <p className="text-xs text-muted">{disclaimer}</p> : null}
    </div>
  )
}

const LIKELIHOOD_LABELS: Record<string, string> = {
  norm_cvss: 'CVSS severity', exploitability: 'Exploit maturity', patch_age_score: 'Patch age', exposure_score: 'Network exposure', control_gap: 'Control gap', threat_intel_score: 'Threat intelligence',
}

function CalculationBreakdown({ result }: { result: RiskResult }) {
  const losses = [
    ['Downtime', result.loss.downtime_inr], ['Incident response', result.loss.incident_response_inr], ['Recovery', result.loss.recovery_inr], ['Data breach', result.loss.data_breach_inr], ['Regulatory', result.loss.regulatory_inr], ['Reputation', result.loss.reputation_inr],
  ] as const
  return <div className="grid gap-6 lg:grid-cols-2">
    <section><h3 className="font-medium text-paper">Likelihood drivers</h3><p className="mt-1 text-xs text-muted">Weighted normalized inputs; this is a model score, not a guaranteed annual probability.</p><dl className="mt-4 space-y-2">{Object.entries(result.likelihood.weighted_terms).map(([key, contribution]) => <div key={key} className="grid grid-cols-[1fr_auto_auto] gap-4 text-sm"><dt className="text-muted">{LIKELIHOOD_LABELS[key] ?? key}</dt><dd className="tnum text-muted">input {result.likelihood[key as keyof typeof result.likelihood] as number}</dd><dd className="tnum text-paper">+{contribution.toFixed(3)}</dd></div>)}</dl><p className="tnum mt-4 border-t border-edge pt-3 text-sm text-paper">Likelihood score <strong>{result.likelihood.likelihood.toFixed(3)}</strong></p></section>
    <section><h3 className="font-medium text-paper">Loss magnitude</h3><p className="mt-1 text-xs text-muted">Six modeled components derived from supplied asset inputs.</p><dl className="mt-4 space-y-2">{losses.map(([label, value]) => <div key={label} className="flex justify-between gap-4 text-sm"><dt className="text-muted">{label}</dt><dd className="tnum text-paper">{formatINR(value)}</dd></div>)}</dl><p className="tnum mt-4 border-t border-edge pt-3 text-sm text-paper">{result.likelihood.likelihood.toFixed(3)} × {formatINR(result.loss.loss_magnitude_inr)} = <strong className="text-bad">{formatINR(result.eal_inr)} EAL</strong></p></section>
  </div>
}
