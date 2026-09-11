export default function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="w-full flex items-center justify-between gap-3 py-1 text-left">
      <span>
        <span className="block text-[16px] text-slate-800 dark:text-[#e8f2f1]">{label}</span>
        {hint && <span className="block text-[13px] text-slate-500 dark:text-[#7f9896]">{hint}</span>}
      </span>
      <span className={`relative inline-flex h-8 w-14 flex-shrink-0 rounded-full transition ${checked ? 'bg-eft-600' : 'bg-slate-300 dark:bg-[#2b4442]'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-7' : 'left-1'}`} />
      </span>
    </button>
  )
}
