import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Session from './pages/Session'
import PointsPage from './pages/PointsPage'
import HistoryPage from './pages/HistoryPage'
import EftSettings from './pages/EftSettings'
import Flow from './pages/Flow'

type IconName = 'home' | 'hand' | 'chart' | 'settings'

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
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10.5V20h13v-9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      )
    case 'hand':
      return (
        <svg {...common}>
          <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11" />
          <path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11" />
          <path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V13" />
          <path d="M8 12l-2.2-2.2a1.5 1.5 0 0 0-2.1 2.1L8 16.5c1.5 2.5 3 4 6 4 3.5 0 5.5-2 5.5-5.5V13" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 20h16" />
          <path d="M7 16v-5" />
          <path d="M12 16V7" />
          <path d="M17 16v-8" />
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

const tabs: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: '/', label: 'Bugün', icon: 'home', end: true },
  { to: '/noktalar', label: 'Noktalar', icon: 'hand', end: false },
  { to: '/gecmis', label: 'Geçmiş', icon: 'chart', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: 'settings', end: false }
]

export default function EftApp() {
  const loc = useLocation()
  // Seans sirasinda alt menu gizlenir: dikkat dagilmasin, yanlislikla cikilmasin.
  const inSession = loc.pathname.startsWith('/seans') || loc.pathname.startsWith('/akis')
  return (
    <div className="eft-app min-h-full min-h-[100dvh] flex flex-col max-w-xl mx-auto">
      <main className="flex-1 flex flex-col" style={{ paddingBottom: inSession ? 0 : 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/seans" element={<Session />} />
          <Route path="/akis" element={<Flow />} />
          <Route path="/noktalar" element={<PointsPage />} />
          <Route path="/gecmis" element={<HistoryPage />} />
          <Route path="/ayarlar" element={<EftSettings />} />
        </Routes>
      </main>

      {!inSession && (
        <nav
          className="fixed bottom-0 inset-x-0 max-w-xl mx-auto grid grid-cols-4 z-20 backdrop-blur-xl bg-white/85 dark:bg-[#0f1a1a]/85 border-t border-slate-200/60 dark:border-[#2b4442]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className="flex flex-col items-center justify-center pt-3 pb-2.5 gap-1.5">
              {({ isActive }) => (
                <>
                  <NavIcon
                    name={t.icon}
                    className={`h-[24px] w-[24px] transition-colors ${
                      isActive ? 'text-eft-600 dark:text-eft-300' : 'text-slate-400 dark:text-[#7f9896]'
                    }`}
                  />
                  <span
                    className={`text-[12px] leading-none transition-colors ${
                      isActive ? 'text-eft-600 dark:text-eft-300 font-semibold' : 'text-slate-400 dark:text-[#7f9896] font-medium'
                    }`}
                  >
                    {t.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
