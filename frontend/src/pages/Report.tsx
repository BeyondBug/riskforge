import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorPanel, Spinner } from '../components/Severity'
import {
  api,
  DISCLAIMER,
  formatINR,
  formatINRShort,
  type Assessment,
  type ReportReference,
  type OptimizationResult,
  ApiError,
} from '../api/client'

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5" />
      <path d="M3.5 13.5V15a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1.5" />
    </svg>
  )
}

export default function Report() {
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [report, setReport] = useState<ReportReference | null>(null)
  const [plan, setPlan] = useState<OptimizationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([api.assessment(), api.currentOptimization()])
      .then(([assessmentResult, planResult]) => {
        if (cancelled) return
        if (assessmentResult.status === 'fulfilled') setAssessment(assessmentResult.value)
        else throw assessmentResult.reason
        if (planResult.status === 'fulfilled') setPlan(planResult.value)
        else if (!(planResult.reason instanceof ApiError && planResult.reason.status === 404)) throw planResult.reason
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

  async function generate() {
    setBusy(true)
    setError(null)
    setReport(null)
    try {
      setReport(await api.generateReport())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-paper">
          Executive report
        </h1>
        <p className="mt-1 text-sm text-muted">
          A PDF covering the scored findings and, once the optimizer has run, the
          funding decision. Every figure in it comes from the same computation the
          dashboard shows.
        </p>
      </header>

      <section className="rf-card p-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
          What this report will contain
        </h2>
        {loading ? (
          <div className="mt-4">
            <Spinner label="Loading assessment…" />
          </div>
        ) : assessment ? (
          <dl className="tnum mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Modeled exposure"
              value={formatINRShort(assessment.total_eal_inr)}
              note={formatINR(assessment.total_eal_inr)}
            />
            <Stat label="Findings scored" value={String(assessment.findings_count)} />
            <Stat label="Assets at risk" value={String(assessment.assets_at_risk)} />
            <Stat label="Assessment" value={assessment.assessment_id} />
          </dl>
        ) : null}
      </section>

      {plan ? <section className="rounded-xl border border-accent/40 bg-accent/10 p-5"><p className="font-medium text-paper">Funding plan ready</p><p className="mt-1 text-sm text-muted">This report will include the {formatINR(plan.budget_inr)} scenario with {plan.selected.length} funded controls.</p></section> : <section className="rounded-xl border border-warn/40 bg-warn/10 p-5"><p className="font-medium text-warn">No funding plan yet</p><p className="mt-1 text-sm text-muted">The report can be generated now, but it will contain the assessment only.</p><Link to="/optimizer" className="mt-3 inline-block text-sm font-semibold text-warn hover:underline">Build a funding plan first →</Link></section>}

      <button type="button" onClick={generate} disabled={busy || loading} className="rf-btn">
        {busy ? 'Generating…' : 'Generate Executive Report'}
      </button>

      {busy ? <Spinner label="Rendering the PDF…" /> : null}

      {error ? <ErrorPanel title="Report generation failed" detail={error} /> : null}

      {report ? (
        <section className="rounded-xl border border-good/40 bg-good/5 p-6 shadow-glow-good">
          <p className="font-medium text-good">Report ready</p>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Size" value={`${(report.size_bytes / 1024).toFixed(1)} KB`} />
            <Stat
              label="Stored in"
              value={report.storage === 's3' ? 'Amazon S3 (private)' : 'Local disk'}
            />
            <Stat
              label="Budget plan included"
              value={report.includes_optimization ? 'Yes' : 'No — run the optimizer first'}
            />
            <Stat
              label="Link validity"
              value={
                report.expires_in_seconds
                  ? `${report.expires_in_seconds / 60} minutes`
                  : 'No expiry (local file)'
              }
            />
          </dl>
          <a
            href={report.download_url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-good px-5 py-2.5 text-sm font-semibold text-good transition-colors hover:bg-good hover:text-base"
          >
            <DownloadIcon />
            Download PDF
          </a>
        </section>
      ) : null}

      <p className="text-xs text-muted">{DISCLAIMER}</p>
    </div>
  )
}

function Stat({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-paper">{value}</dd>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
    </div>
  )
}
