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
    <header className="sticky top-0 z-10 bg-[#f6f8fa]/95 dark:bg-[#151724]/95 backdrop-blur">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        {back && (
          <button
            onClick={() => navigate(-1)}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-100 dark:bg-[#252733] flex items-center justify-center text-slate-600"
            aria-label="Geri"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900 dark:text-[#e0e1e6] truncate">
            {title}
          </h1>
          {subtitle && <p className="text-[13px] text-slate-500 mt-1 truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </header>
  )
}
