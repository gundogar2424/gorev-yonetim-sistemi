// Oz degerlendirme: 1-5 (buyuk dokunma alanli yildizlar)
export default function Rating({ value, onChange, label = 'Ne kadar net / rahat oldu?' }: { value?: number; onChange: (v: number) => void; label?: string }) {
  return (
    <div>
      <div className="text-[15px] text-sesui-body dark:text-sesui-dbody mb-1">{label}</div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} puan`}
            className={`min-h-[48px] rounded-[10px] text-[22px] transition active:scale-95 ${value && n <= value ? 'bg-ses-600 text-white' : 'bg-sesui-soft dark:bg-sesui-dsoft text-sesui-muted dark:text-sesui-dmuted'}`}
          >
            {value && n <= value ? '★' : '☆'}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[13px] text-sesui-muted dark:text-sesui-dmuted mt-1 px-1">
        <span>Zor / bulanık</span>
        <span>Net / rahat</span>
      </div>
    </div>
  )
}
