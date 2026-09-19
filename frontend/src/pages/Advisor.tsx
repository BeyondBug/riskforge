import { useState } from 'react'
import { api, type AdvisorResponse } from '../api/client'

const SUGGESTIONS = [
  'Why were these controls chosen?',
  'Which asset carries the most exposure and why?',
  'What did the optimizer leave unfunded?',
]

export default function Advisor() {
  const [question, setQuestion] = useState(SUGGESTIONS[0])
  const [response, setResponse] = useState<AdvisorResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = question.trim()
    if (trimmed.length < 3) {
      setError('Ask a question of at least three characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setResponse(await api.ask(trimmed))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-paper">AI advisor</h1>
        <p className="mt-1 text-sm text-muted">
          AI explains deterministic outputs only. The model receives the computed
          figures as JSON and is instructed never to produce a number that is not
          in that payload.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-edge bg-surface p-5">
        <label htmlFor="question" className="block text-sm text-muted">
          Your question
        </label>
        <textarea
          id="question"
          rows={3}
          maxLength={500}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full rounded-md border border-edge bg-ink px-3 py-2 text-paper"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Asking…' : 'Ask'}
          </button>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuestion(s)}
              className="rounded-md border border-edge px-3 py-1.5 text-xs text-muted hover:text-paper"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
          {error}
        </p>
      ) : null}

      {response ? (
        <section className="space-y-4 rounded-lg border border-edge bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
              {response.mode === 'bedrock'
                ? 'Answered by Bedrock Claude Haiku'
                : 'Bedrock unreachable — templated from the same data'}
            </span>
            <span className="text-xs text-muted">{response.notice}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper">
            {response.answer}
          </p>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">
              Show the exact data the model was given
            </summary>
            <pre className="mt-3 overflow-x-auto rounded-md bg-ink p-4 text-[11px] leading-relaxed">
              {JSON.stringify(response.context_used, null, 2)}
            </pre>
          </details>
          <p className="text-xs text-muted">{response.disclaimer}</p>
        </section>
      ) : null}
    </div>
  )
}
