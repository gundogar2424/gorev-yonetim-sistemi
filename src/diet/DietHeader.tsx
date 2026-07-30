import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  right?: ReactNode // Sag tarafta istege bagli icerik (buton, rozet vb.)
}

// Sayfa basligi. MyFitnessPal gibi DUZ bir yuzey: renkli degrade yok,
// koyu metin, ince alt cizgi. Renk yalnizca eylem ogelerinde kullanilir —
// boylece ekranin geri kalani sakin ve profesyonel durur.
export default function DietHeader({ title, subtitle, right }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-white/95 dark:bg-[#12161d]/95 backdrop-blur border-b border-slate-200/80">
      <div className="px-4 pt-3 pb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900 truncate">{title}</h1>
          {subtitle && <p className="text-[13px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0 pb-1">{right}</div>}
      </div>
    </header>
  )
}
