import { useEffect, useState } from 'react'
import FindingsTable from '../components/FindingsTable'
import { api, type FindingRow } from '../api/client'

export default function Findings() {
  const [rows, setRows] = useState<FindingRow[]>([])
  const [disclaimer, setDisclaimer] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .findings()
      .then((data) => {
        setRows(data.findings)
        setDisclaimer(data.disclaimer)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-paper">Findings</h1>
        <p className="mt-1 text-sm text-muted">
          Sort by any column. Expected annual loss is computed per finding, not
          entered by hand.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
          Could not load findings: {error}
        </p>
      ) : (
        <FindingsTable rows={rows} />
      )}

      <p className="text-xs text-muted">{disclaimer}</p>
    </div>
  )
}
