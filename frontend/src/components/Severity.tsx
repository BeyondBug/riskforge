/**
 * Severity and status chips.
 *
 * Bands follow the CVSS v3.1 qualitative rating scale so a badge means the
 * same thing here as it does in an advisory.
 */

export type Band = 'critical' | 'high' | 'medium' | 'low' | 'none'

export function severityBand(score: number): Band {
  if (score >= 9.0) return 'critical'
  if (score >= 7.0) return 'high'
  if (score >= 4.0) return 'medium'
  if (score > 0) return 'low'
  return 'none'
}

const BAND_CLASS: Record<Band, string> = {
  critical: 'border-bad/40 bg-bad/15 text-bad',
  high: 'border-warn/40 bg-warn/15 text-warn',
  medium: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-300',
  low: 'border-edge bg-edge/30 text-muted',
  none: 'border-edge bg-edge/30 text-muted',
}

export function SeverityBadge({ score }: { score: number }) {
  const band = severityBand(score)
  return (
    <span
      className={`tnum inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold ${BAND_CLASS[band]}`}
    >
      <span>{score.toFixed(1)}</span>
      <span className="font-normal capitalize opacity-80">{band}</span>
    </span>
  )
}

export function StatusBadge({ status }: { status: string | null }) {
  const value = status ?? 'unknown'
  const tone =
    value === 'open'
      ? 'border-bad/40 bg-bad/15 text-bad'
      : value === 'mitigated'
        ? 'border-good/40 bg-good/15 text-good'
        : 'border-edge bg-edge/30 text-muted'
  return (
    <span className={`rounded-md border px-2.5 py-1 text-xs capitalize ${tone}`}>
      {value}
    </span>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-accent" />
      {label}
    </div>
  )
}

export function ErrorPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-bad/40 bg-bad/10 p-5">
      <p className="font-medium text-bad">{title}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
      <p className="mt-3 text-xs text-muted">
        Check that the API is reachable at <code>/api/health</code>.
      </p>
    </div>
  )
}
