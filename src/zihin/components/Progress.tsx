// Oyun ici ince ilerleme cubugu ("3 / 10")
export default function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[14px] text-slate-500 dark:text-[#8b849e] mb-1.5">
        <span>{label ?? 'İlerleme'}</span>
        <span className="tabular-nums">
          {value} / {max}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-200/70 dark:bg-[#2a2440] overflow-hidden">
        <div className="h-full rounded-full bg-zn-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
