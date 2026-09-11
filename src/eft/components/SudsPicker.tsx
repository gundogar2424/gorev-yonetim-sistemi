interface Props {
  value: number | null
  onChange: (v: number) => void
}

// 0-10 yogunluk secici (SUDS: oznel rahatsizlik olcegi). Buyuk dugmeler.
export default function SudsPicker({ value, onChange }: Props) {
  return (
    <div>
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 11 }, (_, i) => i).map((i) => {
          const on = value === i
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={`min-h-[56px] rounded-2xl text-[20px] font-bold transition active:scale-95 ${
                on
                  ? 'text-white shadow-raised'
                  : 'bg-white dark:bg-[#1e3231] text-slate-800 dark:text-[#e8f2f1] shadow-card dark:shadow-none'
              }`}
              style={on ? { backgroundColor: sudsColor(i) } : undefined}
              aria-pressed={on}
            >
              {i}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 text-[13px] text-slate-500 dark:text-[#7f9896]">
        <span>0 · hiç yok</span>
        <span>5 · orta</span>
        <span>10 · en şiddetli</span>
      </div>
      {value !== null && (
        <p className="mt-3 text-center text-[16px] font-semibold" style={{ color: sudsColor(value) }}>
          {sudsLabel(value)}
        </p>
      )}
    </div>
  )
}

// Yesil (0) -> sari (5) -> kirmizi (10)
export function sudsColor(v: number): string {
  const t = Math.max(0, Math.min(10, v)) / 10
  const h = Math.round(140 - 140 * t) // 140 yesil -> 0 kirmizi
  return `hsl(${h} 70% 42%)`
}

export function sudsLabel(v: number): string {
  if (v === 0) return 'Hiç rahatsızlık yok'
  if (v <= 2) return 'Çok hafif'
  if (v <= 4) return 'Hafif'
  if (v <= 6) return 'Orta'
  if (v <= 8) return 'Şiddetli'
  return 'Çok şiddetli'
}
