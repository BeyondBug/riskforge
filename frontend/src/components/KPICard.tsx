export type Tone = 'neutral' | 'danger' | 'success' | 'accent'

interface Props {
  label: string
  value: string
  note?: string
  tone?: Tone
  loading?: boolean
}

const VALUE_TONE: Record<Tone, string> = {
  neutral: 'text-paper',
  danger: 'text-bad',
  success: 'text-good',
  accent: 'text-accent',
}

const FRAME_TONE: Record<Tone, string> = {
  neutral: 'border-edge',
  danger: 'border-bad/40 shadow-glow-bad',
  success: 'border-good/40 shadow-glow-good',
  accent: 'border-accent/40 shadow-glow-accent',
}

export default function KPICard({
  label,
  value,
  note,
  tone = 'neutral',
  loading = false,
}: Props) {
  return (
    <div className={`rounded-xl border bg-card p-5 ${FRAME_TONE[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      {loading ? (
        <div className="mt-3 h-9 w-32 animate-pulse rounded bg-edge/50" />
      ) : (
        <p
          className={`tnum mt-2 text-3xl font-semibold leading-tight lg:text-4xl ${VALUE_TONE[tone]}`}
        >
          {value}
        </p>
      )}
      {note && !loading ? (
        <p className="tnum mt-2 text-xs text-muted">{note}</p>
      ) : null}
    </div>
  )
}