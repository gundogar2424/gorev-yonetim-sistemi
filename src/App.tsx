import { NavLink, Route, Routes } from 'react-router-dom'
import CustomerList from './pages/CustomerList'
import CustomerForm from './pages/CustomerForm'
import RoutePlanner from './pages/RoutePlanner'
import BulkImport from './pages/BulkImport'
import Settings from './pages/Settings'

const tabs = [
  { to: '/', label: 'Müşteriler', icon: '👥', end: true },
  { to: '/rota', label: 'Rota', icon: '🗺️', end: false },
  { to: '/ice-aktar', label: 'İçe Aktar', icon: '📋', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: '⚙️', end: false }
]

export default function App() {
  return (
    <div className="min-h-full flex flex-col max-w-xl mx-auto bg-slate-100">
      <main className="flex-1 pb-20">
        <Routes>
          <Route path="/" element={<CustomerList />} />
          <Route path="/yeni" element={<CustomerForm />} />
          <Route path="/duzenle/:id" element={<CustomerForm />} />
          <Route path="/rota" element={<RoutePlanner />} />
          <Route path="/ice-aktar" element={<BulkImport />} />
          <Route path="/ayarlar" element={<Settings />} />
        </Routes>
      </main>

      {/* Alt gezinme cubugu (mobil icin sabit) */}
      <nav className="fixed bottom-0 inset-x-0 max-w-xl mx-auto bg-white border-t border-slate-200 grid grid-cols-4 z-20">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-2 text-xs gap-0.5 ${
                isActive ? 'text-brand-700 font-semibold' : 'text-slate-500'
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
