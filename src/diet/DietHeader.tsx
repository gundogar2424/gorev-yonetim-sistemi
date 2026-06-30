import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  right?: ReactNode // Sag tarafta istege bagli icerik (buton, rozet vb.)
}

// Diyet Kocu sayfalari icin ortak baslik (modern degrade, yuvarlak alt).
export default function DietHeader({ title, subtitle, right }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-md rounded-b-3xl">
      <div className="px-4 pt-3.5 pb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-white/80 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </header>
  )
}
