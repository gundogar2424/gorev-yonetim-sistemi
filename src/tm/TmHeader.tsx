import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
  back?: boolean // Solda geri oku goster
  right?: ReactNode
}

// Termomiks Defteri sayfa basligi. Diyet Kocu'nun basligindan ayri bir bilesen
// (o dosyaya dokunulmasin diye) ama ayni sade gorunumu kullanir.
export default function TmHeader({ title, subtitle, back, right }: Props) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#f4f7f5]/85 dark:bg-[#0e1513]/85">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        {back && (
          <button
            onClick={() => navigate(-1)}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-[#1c2622] flex items-center justify-center text-slate-600 dark:text-[#cdd6d1] active:scale-95 transition"
            aria-label="Geri"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[27px] font-bold leading-tight tracking-[-0.02em] text-slate-900 dark:text-[#e7ece9] truncate">
            {title}
          </h1>
          {subtitle && <p className="text-[13px] text-slate-400 dark:text-[#7d8b84] mt-1 truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </header>
  )
}
