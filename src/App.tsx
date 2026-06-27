import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import CustomerList from './pages/CustomerList'
import CustomerForm from './pages/CustomerForm'
import RoutePlanner from './pages/RoutePlanner'
import BulkImport from './pages/BulkImport'
import Settings from './pages/Settings'
// Diyet Kocu: CRM'den bagimsiz, ayri modul
import Capture from './diet/pages/Capture'
import History from './diet/pages/History'
import DietSettings from './diet/pages/DietSettings'

// CRM alt gezinme cubugu (Diyet sekmesi de buradan acilir)
const crmTabs = [
  { to: '/', label: 'Müşteriler', icon: '👥', end: true },
  { to: '/rota', label: 'Rota', icon: '🗺️', end: false },
  { to: '/ice-aktar', label: 'İçe Aktar', icon: '📋', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: '⚙️', end: false },
  { to: '/diyet', label: 'Diyet', icon: '🥗', end: false }
]

// Diyet Kocu alt gezinme cubugu
const dietTabs = [
  { to: '/diyet', label: 'Çek', icon: '📸', end: true },
  { to: '/diyet/gecmis', label: 'Geçmiş', icon: '📅', end: false },
  { to: '/diyet/ayarlar', label: 'Ayarlar', icon: '⚙️', end: false }
]

export default function App() {
  const location = useLocation()
  const inDiet = location.pathname.startsWith('/diyet')
  const tabs = inDiet ? dietTabs : crmTabs
  const activeColor = inDiet ? 'text-emerald-600' : 'text-brand-700'

  return (
    <div className="min-h-full flex flex-col max-w-xl mx-auto bg-slate-100">
      <main className="flex-1 pb-20">
        <Routes>
          {/* CRM uygulamasi (degismedi) */}
          <Route path="/" element={<CustomerList />} />
          <Route path="/yeni" element={<CustomerForm />} />
          <Route path="/duzenle/:id" element={<CustomerForm />} />
          <Route path="/rota" element={<RoutePlanner />} />
          <Route path="/ice-aktar" element={<BulkImport />} />
          <Route path="/ayarlar" element={<Settings />} />

          {/* Diyet Kocu uygulamasi (ayri modul) */}
          <Route path="/diyet" element={<Capture />} />
          <Route path="/diyet/gecmis" element={<History />} />
          <Route path="/diyet/ayarlar" element={<DietSettings />} />
        </Routes>
      </main>

      {/* Alt gezinme cubugu (mobil icin sabit) — hangi uygulamadaysak ona gore degisir */}
      <nav
        className={`fixed bottom-0 inset-x-0 max-w-xl mx-auto bg-white border-t border-slate-200 grid z-20 ${
          tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-3'
        }`}
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-2 text-xs gap-0.5 ${
                isActive ? `${activeColor} font-semibold` : 'text-slate-500'
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
