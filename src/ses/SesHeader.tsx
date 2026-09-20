import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './components/Icon'

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
    <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#faf7f4]/90 dark:bg-[#15120f]/90">
      <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
        {back && (
          <button
            onClick={() => (typeof back === 'function' ? back() : navigate(-1))}
            className="flex-shrink-0 -ml-1.5 w-10 h-10 rounded-lg flex items-center justify-center text-sesui-body dark:text-sesui-dbody active:bg-sesui-soft dark:active:bg-sesui-dsoft transition"
            aria-label="Geri"
          >
            <Icon name="back" size={20} strokeWidth={1.9} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={`font-semibold leading-tight tracking-[-0.015em] text-sesui-text dark:text-sesui-dtext ${compact ? 'text-[17px]' : 'text-[21px] truncate'}`}>{title}</h1>
          {subtitle && <p className="text-[13px] text-sesui-muted dark:text-sesui-dmuted mt-0.5 truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </header>
  )
}
