import { useEffect } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { initNotificationNavigation } from './lib/notify'
import Capture from './pages/Capture'
import History from './pages/History'
import Track from './pages/Track'
import More from './pages/More'
import Labs from './pages/Labs'
import Shopping from './pages/Shopping'
import Reminders from './pages/Reminders'
import ExercisePage from './pages/Exercise'
import Suggest from './pages/Suggest'
import Barcode from './pages/Barcode'
import Menu from './pages/Menu'
import Progress from './pages/Progress'
import Weekly from './pages/Weekly'
import DietSettings from './pages/DietSettings'

// Alt gezinme ikonlari (cizgi/SVG — emoji yerine daha profesyonel gorunum)
type IconName = 'camera' | 'chart' | 'calendar' | 'plus' | 'settings'
function NavIcon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }
  switch (name) {
    case 'camera':
      return (
        <svg {...common}>
          <path d="M3 9a2 2 0 0 1 2-2h2l1.4-2h7.2L17 7h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...common}>
          <line x1="6" y1="20" x2="6" y2="12" />
          <line x1="12" y1="20" x2="12" y2="5" />
          <line x1="18" y1="20" x2="18" y2="14" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
          <line x1="3" y1="9.5" x2="21" y2="9.5" />
          <line x1="8" y1="2.5" x2="8" y2="6" />
          <line x1="16" y1="2.5" x2="16" y2="6" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V13z" />
        </svg>
      )
  }
}

// Diyet Kocu'nun kendi alt gezinme cubugu (CRM'den bagimsiz)
const tabs: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: '/', label: 'Çek', icon: 'camera', end: true },
  { to: '/takip', label: 'Takip', icon: 'chart', end: false },
  { to: '/gecmis', label: 'Geçmiş', icon: 'calendar', end: false },
  { to: '/daha', label: 'Daha', icon: 'plus', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: 'settings', end: false }
]

export default function DietApp() {
  const navigate = useNavigate()

  // Bildirime tiklaninca ilgili sayfaya git (tokluk -> ana ekran, rapor -> gecmis vb.)
  useEffect(() => {
    void initNotificationNavigation((route) => navigate(route))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-full flex flex-col max-w-xl mx-auto bg-[#f6f8fa]">
      {/* Alt menu + sistem tuslari icin guvenli alan kadar bosluk birak */}
      <main className="flex-1" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/" element={<Capture />} />
          <Route path="/takip" element={<Track />} />
          <Route path="/gecmis" element={<History />} />
          <Route path="/daha" element={<More />} />
          <Route path="/tahliller" element={<Labs />} />
          <Route path="/alisveris" element={<Shopping />} />
          <Route path="/hatirlaticilar" element={<Reminders />} />
          <Route path="/egzersiz" element={<ExercisePage />} />
          <Route path="/oneri" element={<Suggest />} />
          <Route path="/barkod" element={<Barcode />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/fotograf" element={<Progress />} />
          <Route path="/ozet" element={<Weekly />} />
          <Route path="/ayarlar" element={<DietSettings />} />
        </Routes>
      </main>

      {/* Alt gezinme cubugu (mobil icin sabit). Sistem tuslarinin ustunde kalsin diye
          alttan guvenli alan (safe-area) kadar bosluk eklenir. */}
      <nav
        className="fixed bottom-0 inset-x-0 max-w-xl mx-auto bg-white/95 backdrop-blur border-t border-slate-100 rounded-t-2xl shadow-nav grid grid-cols-5 z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="flex flex-col items-center justify-center pt-2 pb-1.5 gap-1">
            {({ isActive }) => (
              <>
                <span
                  className={`flex items-center justify-center h-8 w-12 rounded-full transition-colors ${
                    isActive ? 'bg-brand-50' : ''
                  }`}
                >
                  <NavIcon name={t.icon} className={`h-6 w-6 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                </span>
                <span className={`text-[11px] leading-none ${isActive ? 'text-brand-700 font-semibold' : 'text-slate-400'}`}>
                  {t.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
