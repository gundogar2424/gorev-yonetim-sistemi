// Oz degerlendirme: 1-5 (buyuk dokunma alanli yildizlar)
export default function Rating({ value, onChange, label = 'Ne kadar net / rahat oldu?' }: { value?: number; onChange: (v: number) => void; label?: string }) {
  return (
    <div>
      <div className="text-[14px] text-slate-600 dark:text-[#d8c8bf] mb-1">{label}</div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} puan`}
            className={`min-h-[52px] rounded-2xl text-[24px] transition active:scale-95 ${value && n <= value ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-400 dark:text-[#a3908a]'}`}
          >
            {value && n <= value ? '★' : '☆'}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-slate-400 dark:text-[#a3908a] mt-1 px-1">
        <span>Zor / bulanık</span>
        <span>Net / rahat</span>
      </div>
    </div>
  )
}
