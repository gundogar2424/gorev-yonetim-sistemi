import { NavLink, Route, Routes } from 'react-router-dom'
import Capture from './pages/Capture'
import History from './pages/History'
import DietSettings from './pages/DietSettings'

// Diyet Kocu'nun kendi alt gezinme cubugu (CRM'den bagimsiz)
const tabs = [
  { to: '/', label: 'Çek', icon: '📸', end: true },
  { to: '/gecmis', label: 'Geçmiş', icon: '📅', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: '⚙️', end: false }
]

export default function DietApp() {
  return (
    <div className="min-h-full flex flex-col max-w-xl mx-auto bg-slate-100">
      <main className="flex-1 pb-20">
        <Routes>
          <Route path="/" element={<Capture />} />
          <Route path="/gecmis" element={<History />} />
          <Route path="/ayarlar" element={<DietSettings />} />
        </Routes>
      </main>

      {/* Alt gezinme cubugu (mobil icin sabit) */}
      <nav className="fixed bottom-0 inset-x-0 max-w-xl mx-auto bg-white border-t border-slate-200 grid grid-cols-3 z-20">
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
