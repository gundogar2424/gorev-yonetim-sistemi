import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LzPlatform, LzRecipe } from '../types'
import { PLATFORM_AD } from '../lib/importer'

// Sik kullanilan metin renkleri (acik / koyu tema)
export const T_BASLIK = 'text-[#2b211b] dark:text-[#f2ebe5]'
export const T_GOVDE = 'text-[#4f433b] dark:text-[#d6cbc2]'
export const T_SOLUK = 'text-[#9a8b80] dark:text-[#8c8077]'

export type IconName =
  | 'book'
  | 'calendar'
  | 'cart'
  | 'settings'
  | 'plus'
  | 'search'
  | 'clock'
  | 'list'
  | 'star'
  | 'back'
  | 'trash'
  | 'edit'
  | 'link'
  | 'share'
  | 'play'
  | 'check'
  | 'x'
  | 'users'

export function Icon({ name, className = 'w-5 h-5' }: { name: IconName; className?: string }) {
  const c = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }
  switch (name) {
    case 'book':
      return (
        <svg {...c}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
          <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...c}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      )
    case 'cart':
      return (
        <svg {...c}>
          <path d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 2-1.5L20.5 8H6.2" />
          <circle cx="10" cy="20" r="1.3" />
          <circle cx="17" cy="20" r="1.3" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V13z" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...c}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'search':
      return (
        <svg {...c}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      )
    case 'list':
      return (
        <svg {...c}>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <circle cx="4.5" cy="6" r=".8" fill="currentColor" />
          <circle cx="4.5" cy="12" r=".8" fill="currentColor" />
          <circle cx="4.5" cy="18" r=".8" fill="currentColor" />
        </svg>
      )
    case 'star':
      return (
        <svg {...c}>
          <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" />
        </svg>
      )
    case 'back':
      return (
        <svg {...c}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...c}>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A2 2 0 0 0 9 21h6a2 2 0 0 0 2-1.5L18 7M9 7V4.5h6V7" />
        </svg>
      )
    case 'edit':
      return (
        <svg {...c}>
          <path d="M4 20h4L19 9l-4-4L4 16z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      )
    case 'link':
      return (
        <svg {...c}>
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
      )
    case 'share':
      return (
        <svg {...c}>
          <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
          <path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" />
        </svg>
      )
    case 'play':
      return (
        <svg {...c} fill="currentColor" stroke="none">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      )
    case 'check':
      return (
        <svg {...c}>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      )
    case 'x':
      return (
        <svg {...c}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    case 'users':
      return (
        <svg {...c}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6" />
        </svg>
      )
  }
}

export function Header({ title, subtitle, back, right }: { title: ReactNode; subtitle?: string; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#fbf7f2]/85 dark:bg-[#171412]/85">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        {back && (
          <button
            onClick={() => navigate(-1)}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-[#221d1a] flex items-center justify-center text-[#5a4a3f] dark:text-[#d9cec5] active:scale-95 transition"
            aria-label="Geri"
          >
            <Icon name="back" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={`text-[26px] font-bold leading-tight tracking-[-0.02em] truncate ${T_BASLIK}`}>{title}</h1>
          {subtitle && <p className={`text-[13px] mt-0.5 truncate ${T_SOLUK}`}>{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0 flex items-center gap-2">{right}</div>}
      </div>
    </header>
  )
}

// Uygulama amblemi: gulumseyen tencere (buharli). Simgeyle ayni cizim.
export function Logo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M22 14c-2-3 2-5 0-8M32 14c-2-3 2-5 0-8M42 14c-2-3 2-5 0-8" stroke="#f0a58f" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="8" y="22" width="48" height="6" rx="3" fill="#b52f17" />
      <path d="M11 28h42v14a14 14 0 0 1-14 14H25a14 14 0 0 1-14-14z" fill="#ee4c2e" />
      <path d="M11 32H5M53 32h6" stroke="#b52f17" strokeWidth="4" strokeLinecap="round" />
      <circle cx="25" cy="38" r="2.6" fill="#2b211b" />
      <circle cx="39" cy="38" r="2.6" fill="#2b211b" />
      <path d="M26 44c3 3.5 9 3.5 12 0" stroke="#2b211b" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="43" r="2.4" fill="#ff9f88" opacity=".8" />
      <circle cx="44" cy="43" r="2.4" fill="#ff9f88" opacity=".8" />
    </svg>
  )
}

// Tarif fotografi; yoksa ya da yuklenemezse sicak renkli yer tutucu.
export function Thumb({ src, className = 'w-20 h-20 rounded-2xl', emoji = '🍲' }: { src: string; className?: string; emoji?: string }) {
  const [hata, setHata] = useState(false)
  if (!src || hata) {
    return (
      <div className={`${className} bg-[#f6ece2] dark:bg-[#2a2420] flex items-center justify-center text-3xl flex-shrink-0`}>
        {emoji}
      </div>
    )
  }
  return <img src={src} alt="" onError={() => setHata(true)} className={`${className} object-cover flex-shrink-0`} />
}

const PLATFORM_RENK: Record<LzPlatform, string> = {
  instagram: '#d62976',
  tiktok: '#111111',
  youtube: '#ff0000',
  pinterest: '#e60023',
  facebook: '#1877f2',
  web: '#6b7280',
  manual: '#d93d20'
}

export function PlatformDot({ platform }: { platform: LzPlatform }) {
  return <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: PLATFORM_RENK[platform] }} />
}

export function PlatformLabel({ r }: { r: Pick<LzRecipe, 'platform' | 'author'> }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] ${T_SOLUK} min-w-0`}>
      <PlatformDot platform={r.platform} />
      <span className="truncate">
        {PLATFORM_AD[r.platform]}
        {r.author ? ` · ${r.author}` : ''}
      </span>
    </span>
  )
}

export function sureYaz(dk: number): string {
  if (!dk) return ''
  if (dk < 60) return `~${dk} dk`
  const s = Math.floor(dk / 60)
  const k = dk % 60
  return k ? `~${s} sa ${k} dk` : `~${s} sa`
}

// Alttan acilan panel
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-xl bg-[#fbf7f2] dark:bg-[#1c1815] rounded-t-[28px] max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className={`text-lg font-bold ${T_BASLIK}`}>{title}</h2>
          <button onClick={onClose} className={`w-9 h-9 rounded-full flex items-center justify-center ${T_SOLUK}`} aria-label="Kapat">
            <Icon name="x" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}

export function Toast({ text }: { text: string }) {
  if (!text) return null
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 bg-[#2b211b] text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg max-w-[90vw] text-center"
      style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
    >
      {text}
    </div>
  )
}

export function useToast(): [string, (s: string) => void] {
  const [t, setT] = useState('')
  const goster = (s: string) => {
    setT(s)
    window.setTimeout(() => setT((cur) => (cur === s ? '' : cur)), 2200)
  }
  return [t, goster]
}
