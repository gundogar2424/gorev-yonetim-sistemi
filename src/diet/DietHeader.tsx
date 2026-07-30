import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  right?: ReactNode // Sag tarafta istege bagli icerik (buton, rozet vb.)
}

// Sayfa basligi — MyFitnessPal'in "Bugün" satirinin birebir karsiligi:
// renkli bant YOK, zeminle ayni yuzey; baslik BUYUK ve kalin; renk yalnizca
// sagdaki eylemde (mavi hap) gorunur. MFP'de de ust bant boyali degildir;
// ekrani dolduran sey baslik boyutu ve mavi eylemdir.
export default function DietHeader({ title, subtitle, right }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-[#f6f8fa]/95 dark:bg-[#0d1117]/95 backdrop-blur">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[30px] font-bold leading-none tracking-tight text-slate-900 dark:text-[#e6edf3] truncate">
            {title}
          </h1>
          {subtitle && <p className="text-[13px] text-slate-500 mt-1.5 truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </header>
  )
}
