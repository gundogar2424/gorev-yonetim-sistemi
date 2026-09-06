import { NavLink, Route, Routes } from 'react-router-dom'
import Recipes from './pages/Recipes'
import Convert from './pages/Convert'
import RecipeDetail from './pages/RecipeDetail'
import EditRecipe from './pages/EditRecipe'
import Cook from './pages/Cook'
import TmSettings from './pages/TmSettings'

type IconName = 'book' | 'wand' | 'star' | 'settings'

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
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
          <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
        </svg>
      )
    case 'wand':
      return (
        <svg {...common}>
          <path d="M4 20 16 8" />
          <path d="M14 4.5 15 7l2.5 1-2.5 1-1 2.5-1-2.5L10.5 8 13 7z" />
          <path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8-1.8-.7 1.8-.7z" />
        </svg>
      )
    case 'star':
      return (
        <svg {...common}>
          <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" />
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
  { to: '/', label: 'Tarifler', icon: 'book', end: true },
  { to: '/uyarla', label: 'Uyarla', icon: 'wand', end: false },
  { to: '/favoriler', label: 'Favoriler', icon: 'star', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: 'settings', end: false }
]

export default function TmApp() {
  return (
    <div className="min-h-full flex flex-col max-w-xl mx-auto bg-[#f6f8fa] dark:bg-[#151724]">
      <main className="flex-1" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/" element={<Recipes />} />
          <Route path="/favoriler" element={<Recipes onlyFavorites />} />
          <Route path="/uyarla" element={<Convert />} />
          <Route path="/tarif/:id" element={<RecipeDetail />} />
          <Route path="/duzenle/:id" element={<EditRecipe />} />
          <Route path="/yeni" element={<EditRecipe />} />
          <Route path="/pisir/:id" element={<Cook />} />
          <Route path="/ayarlar" element={<TmSettings />} />
        </Routes>
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 max-w-xl mx-auto bg-white/95 dark:bg-[#151724]/95 backdrop-blur border-t border-slate-200/80 dark:border-[#2f3240] grid grid-cols-4 z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="flex flex-col items-center justify-center pt-2.5 pb-2 gap-1">
            {({ isActive }) => (
              <>
                <NavIcon
                  name={t.icon}
                  className={`h-[22px] w-[22px] ${
                    isActive ? 'text-brand-600 dark:text-[#e0e1e6]' : 'text-slate-400 dark:text-[#9b9ea7]'
                  }`}
                />
                <span
                  className={`text-[11px] leading-none ${
                    isActive
                      ? 'text-brand-600 dark:text-[#e0e1e6] font-semibold'
                      : 'text-slate-500 dark:text-[#9b9ea7] font-medium'
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
