import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LzPlatform, LzRecipe } from '../types'
import { PLATFORM_AD } from '../lib/importer'

// Sik kullanilan metin renkleri (acik / koyu tema)
export const T_BASLIK = 'text-[#18181b] dark:text-[#f4f4f5]'
export const T_GOVDE = 'text-[#3f3f46] dark:text-[#d4d4d8]'
export const T_SOLUK = 'text-[#86868f] dark:text-[#8a8a93]'

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
  | 'pot'
  | 'inbox'
  | 'pin'
  | 'leaf'
  | 'sparkle'
  | 'heart'
  | 'bookmark'
  | 'file'

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
    case 'pot':
      return (
        <svg {...c}>
          <path d="M5 10h14l-1.2 8.2A2.5 2.5 0 0 1 15.3 20.5H8.7a2.5 2.5 0 0 1-2.5-2.3z" />
          <path d="M4 10h16M9 10V7.5a3 3 0 0 1 6 0V10M19 12.5h2" />
        </svg>
      )
    case 'inbox':
      return (
        <svg {...c}>
          <path d="M3.5 13.5 6 5.5A2 2 0 0 1 7.9 4h8.2a2 2 0 0 1 1.9 1.5l2.5 8" />
          <path d="M3.5 13.5V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4.5h-5l-1.5 2.5h-4L8.5 13.5z" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...c}>
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      )
    case 'leaf':
      return (
        <svg {...c}>
          <path d="M5 19c0-8 5-13.5 15-14-.4 10-6 15-14 15" />
          <path d="M5 19c3-4 6-6.5 9.5-8.5" />
        </svg>
      )
    case 'sparkle':
      return (
        <svg {...c}>
          <path d="M12 3.5 13.8 9 19.5 10.8 13.8 12.6 12 18.5 10.2 12.6 4.5 10.8 10.2 9z" />
          <path d="M19 3.5v3M17.5 5h3" />
        </svg>
      )
    case 'heart':
      return (
        <svg {...c}>
          <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
        </svg>
      )
    case 'bookmark':
      return (
        <svg {...c}>
          <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.2L5.5 21V4.5a1 1 0 0 1 1-1z" />
        </svg>
      )
    case 'file':
      return (
        <svg {...c}>
          <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
          <path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" />
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
    <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#f7f7f5]/85 dark:bg-[#111113]/85">
      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
        {back && (
          <button
            onClick={() => navigate(-1)}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-white dark:bg-[#1c1c1f] border border-[#e4e3e0] dark:border-[#2e2e33] flex items-center justify-center text-[#3f3f46] dark:text-[#d4d4d8] active:scale-95 transition"
            aria-label="Geri"
          >
            <Icon name="back" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={`text-[24px] font-[750] leading-tight tracking-[-0.025em] truncate ${T_BASLIK}`}>{title}</h1>
          {subtitle && <p className={`text-[13px] mt-0.5 truncate ${T_SOLUK}`}>{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0 flex items-center gap-2">{right}</div>}
      </div>
    </header>
  )
}

// Sofra (kisi) rozeti: emoji yerine adin bas harfleri, ada gore sabit renkli yuvarlak
const ROZET_RENK = ['#d93d20', '#2563eb', '#059669', '#7c3aed', '#db2777', '#d97706', '#0891b2', '#4f46e5']
export function basHarfler(ad: string): string {
  const k = ad.trim().split(/\s+/).filter(Boolean)
  return ((k[0]?.[0] ?? '') + (k.length > 1 ? k[1][0] : '')).toLocaleUpperCase('tr') || '?'
}
export function SofraRozet({ ad, className = 'w-6 h-6 text-[10px]', secili = false }: { ad: string; className?: string; secili?: boolean }) {
  let h = 0
  for (const ch of ad) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const renk = ROZET_RENK[h % ROZET_RENK.length]
  return (
    <span
      className={`${className} rounded-full inline-flex items-center justify-center font-bold tracking-[-0.02em] flex-shrink-0 ${secili ? 'ring-[3px] ring-offset-2 ring-offset-[#f7f7f5] dark:ring-offset-[#111113]' : ''}`}
      style={{ background: `${renk}1f`, color: renk, ...(secili ? { ['--tw-ring-color' as string]: renk } : {}) }}
    >
      {basHarfler(ad)}
    </span>
  )
}

// Influencer avatari: profil fotografi varsa o, yoksa bas harfli yuvarlak
export function KisiAvatar({ ad, foto, className = 'w-12 h-12 text-[16px]' }: { ad: string; foto?: string; className?: string }) {
  const [hata, setHata] = useState(false)
  if (foto && !hata) return <img src={foto} alt="" onError={() => setHata(true)} className={`${className} rounded-full object-cover flex-shrink-0`} />
  return <SofraRozet ad={ad} className={className} />
}

// Uygulama amblemi: gulumseyen tencere (buharli). Simgeyle ayni cizim.
export function Logo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M22 14c-2-3 2-5 0-8M32 14c-2-3 2-5 0-8M42 14c-2-3 2-5 0-8" stroke="#f0a58f" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="8" y="22" width="48" height="6" rx="3" fill="#b52f17" />
      <path d="M11 28h42v14a14 14 0 0 1-14 14H25a14 14 0 0 1-14-14z" fill="#ee4c2e" />
      <path d="M11 32H5M53 32h6" stroke="#b52f17" strokeWidth="4" strokeLinecap="round" />
      <circle cx="25" cy="38" r="2.6" fill="#18181b" />
      <circle cx="39" cy="38" r="2.6" fill="#18181b" />
      <path d="M26 44c3 3.5 9 3.5 12 0" stroke="#18181b" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="43" r="2.4" fill="#ff9f88" opacity=".8" />
      <circle cx="44" cy="43" r="2.4" fill="#ff9f88" opacity=".8" />
    </svg>
  )
}

// Tarif fotografi; yoksa ya da yuklenemezse sicak renkli yer tutucu.
export function Thumb({ src, className = 'w-20 h-20 rounded-2xl', emoji = '' }: { src: string; className?: string; emoji?: string }) {
  const [hata, setHata] = useState(false)
  if (!src || hata) {
    return (
      <div className={`${className} bg-[#f1f1ef] dark:bg-[#26262a] flex items-center justify-center flex-shrink-0 text-[#a1a1aa] dark:text-[#71717a]`} data-emoji={emoji}>
        <Icon name="pot" className="w-1/3 h-1/3 max-w-[48px] max-h-[48px]" />
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
        className="relative w-full max-w-xl bg-[#f7f7f5] dark:bg-[#18181b] rounded-t-[28px] max-h-[85vh] flex flex-col"
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
      className="fixed left-1/2 -translate-x-1/2 z-50 bg-[#18181b] text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg max-w-[90vw] text-center"
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
