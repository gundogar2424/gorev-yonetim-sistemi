import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  right?: ReactNode // Sag tarafta istege bagli icerik (buton, rozet vb.)
}

// Sayfa basligi. MyFitnessPal'daki gibi DUZ (degrade degil) marka MAVISI bir
// ust bant, beyaz baslik. Renk yalnizca burada ve eylem ogelerinde kullanilir;
// ekranin geri kalani notr kalir. Degrade yok — tek ton, keskin kenar.
export default function DietHeader({ title, subtitle, right }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-brand-600">
      <div className="px-4 pt-3.5 pb-3.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[25px] font-bold leading-tight tracking-tight text-white truncate">{title}</h1>
          {subtitle && <p className="text-[13px] text-white/70 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0 pb-1">{right}</div>}
      </div>
    </header>
  )
}
