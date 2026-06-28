import { NavLink, Route, Routes } from 'react-router-dom'
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
import Progress from './pages/Progress'
import Weekly from './pages/Weekly'
import DietSettings from './pages/DietSettings'

// Diyet Kocu'nun kendi alt gezinme cubugu (CRM'den bagimsiz)
const tabs = [
  { to: '/', label: 'Çek', icon: '📸', end: true },
  { to: '/takip', label: 'Takip', icon: '📈', end: false },
  { to: '/gecmis', label: 'Geçmiş', icon: '📅', end: false },
  { to: '/daha', label: 'Daha', icon: '➕', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: '⚙️', end: false }
]

export default function DietApp() {
  return (
    <div className="min-h-full flex flex-col max-w-xl mx-auto bg-slate-100">
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
          <Route path="/fotograf" element={<Progress />} />
          <Route path="/ozet" element={<Weekly />} />
          <Route path="/ayarlar" element={<DietSettings />} />
        </Routes>
      </main>

      {/* Alt gezinme cubugu (mobil icin sabit). Sistem tuslarinin ustunde kalsin diye
          alttan guvenli alan (safe-area) kadar bosluk eklenir. */}
      <nav
        className="fixed bottom-0 inset-x-0 max-w-xl mx-auto bg-white border-t border-slate-200 grid grid-cols-5 z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-2 text-xs gap-0.5 ${
                isActive ? 'text-emerald-600 font-semibold' : 'text-slate-500'
              }`
            }
          >
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
