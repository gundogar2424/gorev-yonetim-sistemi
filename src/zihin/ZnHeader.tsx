import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
  back?: boolean | (() => void) // true: tarihce geri; fonksiyon: ozel geri
  right?: ReactNode
  compact?: boolean // oyun icinde: daha kucuk baslik, kirpilmadan iki satira sarabilir
}

export default function ZnHeader({ title, subtitle, back, right, compact }: Props) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#f6f4fb]/85 dark:bg-[#12101c]/85">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        {back && (
          <button
            onClick={() => (typeof back === 'function' ? back() : navigate(-1))}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-white dark:bg-[#241f38] shadow-card dark:shadow-none flex items-center justify-center text-slate-700 dark:text-[#d7d2e6] active:scale-95 transition"
            aria-label="Geri"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1
            className={`font-bold leading-tight tracking-[-0.02em] text-slate-900 dark:text-[#ece8f7] ${
              compact ? 'text-[20px]' : 'text-[26px] truncate'
            }`}
          >
            {title}
          </h1>
          {subtitle && <p className="text-[14px] text-slate-500 dark:text-[#8b849e] mt-0.5 truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </header>
  )
}
