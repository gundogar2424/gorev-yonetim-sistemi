import { NavLink, Route, Routes } from 'react-router-dom'
import Products from './pages/Products'
import ProductForm from './pages/ProductForm'
import Settings from './pages/Settings'

type IconName = 'box' | 'plus' | 'settings'
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
    case 'box':
      return (
        <svg {...common}>
          <path d="M21 8l-9-5-9 5 9 5 9-5z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <line x1="12" y1="13" x2="12" y2="21" />
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

const tabs: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: '/', label: 'Ürünler', icon: 'box', end: true },
  { to: '/ekle', label: 'Ekle', icon: 'plus', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: 'settings', end: false }
]

export default function StokApp() {
  return (
    <div className="min-h-full flex flex-col max-w-xl mx-auto bg-[#f6f8fa] dark:bg-[#0b1220]">
      <main className="flex-1" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/" element={<Products />} />
          <Route path="/ekle" element={<ProductForm />} />
          <Route path="/duzenle/:id" element={<ProductForm />} />
          <Route path="/ayarlar" element={<Settings />} />
        </Routes>
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 max-w-xl mx-auto bg-white/95 dark:bg-[#0f1626]/95 backdrop-blur border-t border-slate-100 dark:border-slate-800 rounded-t-2xl shadow-nav grid grid-cols-3 z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="flex flex-col items-center justify-center pt-2 pb-1.5 gap-1">
            {({ isActive }) => (
              <>
                <span
                  className={`flex items-center justify-center h-8 w-12 rounded-full transition-colors ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''
                  }`}
                >
                  <NavIcon name={t.icon} className={`h-6 w-6 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                </span>
                <span
                  className={`text-[11px] leading-none ${
                    isActive ? 'text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-slate-400'
                  }`}
                >
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
