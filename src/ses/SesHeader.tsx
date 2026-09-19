import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
  back?: boolean | (() => void) // true: tarihce geri; fonksiyon: ozel geri
  right?: ReactNode
  compact?: boolean
}

export default function SesHeader({ title, subtitle, back, right, compact }: Props) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#fdf7f2]/85 dark:bg-[#1a1410]/85">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        {back && (
          <button
            onClick={() => (typeof back === 'function' ? back() : navigate(-1))}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-white dark:bg-[#352820] shadow-card dark:shadow-none flex items-center justify-center text-slate-700 dark:text-[#f5ece4] active:scale-95 transition"
            aria-label="Geri"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={`font-bold leading-tight tracking-[-0.02em] text-slate-900 dark:text-[#f5ece4] ${compact ? 'text-[22px]' : 'text-[28px] truncate'}`}>{title}</h1>
          {subtitle && <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf] mt-0.5 truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </header>
  )
}
