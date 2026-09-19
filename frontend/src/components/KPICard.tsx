interface Props {
  label: string
  value: string
  note?: string
  tone?: 'neutral' | 'good' | 'bad'
}

const toneClass: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'text-paper',
  good: 'text-good',
  bad: 'text-bad',
}

export default function KPICard({ label, value, note, tone = 'neutral' }: Props) {
  return (
    <div className="rounded-lg border border-edge bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`tnum mt-2 text-3xl font-semibold ${toneClass[tone]}`}>{value}</p>
      {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
    </div>
  )
}
