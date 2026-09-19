import { useState } from 'react'
import { api, DISCLAIMER, type ReportReference } from '../api/client'

export default function Report() {
  const [report, setReport] = useState<ReportReference | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)
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
      <div>
        <h1 className="text-2xl font-semibold text-paper">Executive report</h1>
        <p className="mt-1 text-sm text-muted">
          A PDF covering the scored findings and, if the optimizer has run, the
          funding decision. Every figure in it comes from the same computation the
          dashboard shows.
        </p>
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-50"
      >
        {busy ? 'Generating…' : 'Generate report'}
      </button>

      {error ? (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
          {error}
        </p>
      ) : null}

      {report ? (
        <section className="space-y-4 rounded-lg border border-edge bg-surface p-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Assessment" value={report.assessment_id} />
            <Row label="Size" value={`${(report.size_bytes / 1024).toFixed(1)} KB`} />
            <Row
              label="Stored in"
              value={report.storage === 's3' ? 'Amazon S3 (private)' : 'Local disk'}
            />
            <Row
              label="Budget allocation included"
              value={report.includes_optimization ? 'Yes' : 'No — run the optimizer first'}
            />
          </dl>
          <a
            href={report.download_url}
            className="inline-block rounded-md border border-accent px-5 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            Download PDF
          </a>
          {report.expires_in_seconds ? (
            <p className="text-xs text-muted">
              Pre-signed link expires in {report.expires_in_seconds / 60} minutes.
            </p>
          ) : null}
        </section>
      ) : null}

      <p className="text-xs text-muted">{DISCLAIMER}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-paper">{value}</dd>
    </div>
  )
}
