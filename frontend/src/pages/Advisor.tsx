import { useEffect, useRef, useState } from 'react'
import { ErrorPanel, Spinner } from '../components/Severity'
import { api, type AdvisorResponse } from '../api/client'

const EXAMPLE_QUESTION = 'Why should I prioritize these three controls?'

const SUGGESTIONS = [
  EXAMPLE_QUESTION,
  'Which asset carries the most exposure and why?',
  'What did the optimizer leave unfunded?',
]

interface Turn {
  id: number
  question: string
  response: AdvisorResponse | null
}

export default function Advisor() {
  const [draft, setDraft] = useState(EXAMPLE_QUESTION)
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nextId = useRef(1)

  async function submit() {
    const question = draft.trim()
    if (question.length < 3) {
      setError('Ask a question of at least three characters.')
      return
    }

    const id = nextId.current++
    setTurns((prev) => [...prev, { id, question, response: null }])
    setDraft('')
    setBusy(true)
    setError(null)

    try {
      const response = await api.ask(question)
      setTurns((prev) =>
        prev.map((t) => (t.id === id ? { ...t, response } : t)),
      )
    } catch (e) {
      setError((e as Error).message)
      setTurns((prev) => prev.filter((t) => t.id !== id))
      setDraft(question)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-paper">
          AI advisor
        </h1>
      </header>

      <div className="rounded-xl border border-accent/40 bg-accent/10 px-5 py-3">
        <p className="text-sm text-paper">
          AI explains deterministic outputs only. No numbers are invented.
        </p>
        <p className="mt-1 text-xs text-muted">
          The model receives the computed figures as JSON and is instructed that
          every number it cites must come from that payload. Expand the source
          panel under any answer to check it.
        </p>
      </div>

      <section className="rf-card flex min-h-[26rem] flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {turns.length === 0 ? (
            <div className="flex h-full flex-col items-start justify-center gap-3 text-sm text-muted">
              <p>
                Ask why the optimizer chose what it chose, or which asset drives
                the exposure.
              </p>
              <p className="text-xs">
                The box below is pre-filled with an example. Press Ask to run it.
              </p>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className="space-y-3">
                <div className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-white">
                    {turn.question}
                  </p>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-edge bg-base px-4 py-3">
                    {turn.response ? (
                      <Answer response={turn.response} />
                    ) : (
                      <Spinner label="Consulting the advisor…" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-edge p-4">
          <div className="flex flex-wrap gap-2 pb-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraft(s)}
                className="rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-paper"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-3">
            <textarea
              rows={2}
              maxLength={500}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (!busy) submit()
                }
              }}
              placeholder="Ask RiskForge…"
              aria-label="Ask RiskForge"
              className="flex-1 resize-none rounded-lg border border-edge bg-base px-4 py-3 text-sm text-paper placeholder:text-muted"
            />
            <button
              type="button"
              onClick={submit}
              disabled={busy || draft.trim().length < 3}
              className="rf-btn"
            >
              {busy ? 'Asking…' : 'Ask'}
            </button>
          </div>
        </div>
      </section>

      {error ? <ErrorPanel title="The advisor could not answer" detail={error} /> : null}
    </div>
  )
}

/**
 * Reveals the answer a character at a time. Purely presentational: the full
 * text has already arrived, so nothing is being streamed or guessed. Readers
 * who prefer reduced motion get the text immediately.
 */
function useTypewriter(text: string, charsPerTick = 3, tickMs = 16) {
  const [shown, setShown] = useState('')

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      setShown(text)
      return
    }

    setShown('')
    let index = 0
    const timer = window.setInterval(() => {
      index = Math.min(index + charsPerTick, text.length)
      setShown(text.slice(0, index))
      if (index >= text.length) window.clearInterval(timer)
    }, tickMs)

    return () => window.clearInterval(timer)
  }, [text, charsPerTick, tickMs])

  return shown
}

function Answer({ response }: { response: AdvisorResponse }) {
  const typed = useTypewriter(response.answer)
  const live = response.mode === 'bedrock'

  return (
    <div className="space-y-3">
      <span
        className={`inline-block rounded-md border px-2 py-0.5 text-[11px] ${
          live
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-warn/40 bg-warn/10 text-warn'
        }`}
      >
        {live
          ? 'Answered by Bedrock Claude Haiku'
          : 'Bedrock unreachable — templated from the same data'}
      </span>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper">
        {typed}
        {typed.length < response.answer.length ? (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" />
        ) : null}
      </p>

      <details className="text-xs text-muted">
        <summary className="cursor-pointer hover:text-paper">
          Show the exact data the model was given
        </summary>
        <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-edge bg-rail p-4 text-[11px] leading-relaxed">
          {JSON.stringify(response.context_used, null, 2)}
        </pre>
      </details>
    </div>
  )
}
