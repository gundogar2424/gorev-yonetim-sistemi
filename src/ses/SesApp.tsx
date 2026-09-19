import { useEffect } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import Session from './pages/Session'
import Measure from './pages/Measure'
import ExercisesPage from './pages/ExercisesPage'
import ExerciseDetail from './pages/ExerciseDetail'
import ProgressPage from './pages/ProgressPage'
import SesSettings from './pages/SesSettings'
import DiksiyonPage from './pages/DiksiyonPage'
import DiksiyonSession from './pages/DiksiyonSession'
import VideosPage from './pages/VideosPage'
import { installNotificationTap } from './lib/notify'

type IconName = 'home' | 'list' | 'mic' | 'chart' | 'settings'

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
    case 'list':
      return (
        <svg {...common}>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </svg>
      )
    case 'mic':
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
          <path d="M9 21h6" />
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
  { to: '/egzersizler', label: 'Egzersiz', icon: 'list', end: false },
  { to: '/diksiyon', label: 'Diksiyon', icon: 'mic', end: false },
  { to: '/ilerleme', label: 'İlerleme', icon: 'chart', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: 'settings', end: false }
]

export default function SesApp() {
  const loc = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    installNotificationTap(navigate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Seans ve olcum sirasinda alt menu gizlenir: dikkat dagilmasin.
  const inSession = loc.pathname.startsWith('/seans') || loc.pathname.startsWith('/olcum') || loc.pathname.startsWith('/diksiyon-seans')
  return (
    <div className="ses-app min-h-full min-h-[100dvh] flex flex-col max-w-xl mx-auto">
      <main className="flex-1 flex flex-col" style={{ paddingBottom: inSession ? 0 : 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/seans" element={<Session key={loc.search} />} />
          <Route path="/olcum" element={<Measure />} />
          <Route path="/egzersizler" element={<ExercisesPage />} />
          <Route path="/egzersiz/:id" element={<ExerciseDetail />} />
          <Route path="/diksiyon" element={<DiksiyonPage />} />
          <Route path="/videolar" element={<VideosPage />} />
          <Route path="/diksiyon-seans" element={<DiksiyonSession key={loc.search} />} />
          <Route path="/ilerleme" element={<ProgressPage />} />
          <Route path="/ayarlar" element={<SesSettings />} />
        </Routes>
      </main>

      {!inSession && (
        <nav
          className="fixed bottom-0 inset-x-0 max-w-xl mx-auto grid grid-cols-5 z-20 backdrop-blur-xl bg-white/85 dark:bg-[#1a1410]/85 border-t border-slate-200/60 dark:border-[#4a3a30]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className="flex flex-col items-center justify-center pt-3 pb-2.5 gap-1.5">
              {({ isActive }) => (
                <>
                  <NavIcon name={t.icon} className={`h-[24px] w-[24px] transition-colors ${isActive ? 'text-ses-600 dark:text-ses-300' : 'text-slate-600 dark:text-[#cdbdb3]'}`} />
                  <span className={`text-[13px] leading-none transition-colors ${isActive ? 'text-ses-600 dark:text-ses-300 font-semibold' : 'text-slate-600 dark:text-[#cdbdb3] font-medium'}`}>
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
