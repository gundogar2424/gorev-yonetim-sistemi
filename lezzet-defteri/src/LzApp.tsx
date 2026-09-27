import { useEffect } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './components/ui'
import Recipes from './pages/Recipes'
import AddRecipe from './pages/AddRecipe'
import EditRecipe from './pages/EditRecipe'
import RecipeDetail from './pages/RecipeDetail'
import Cook from './pages/Cook'
import Week from './pages/Week'
import Shopping from './pages/Shopping'
import LzSettings from './pages/LzSettings'
import NePisirsem from './pages/NePisirsem'

const tabs: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: '/', label: 'Tariflerim', icon: 'book', end: true },
  { to: '/hafta', label: 'Bu Hafta', icon: 'calendar', end: false },
  { to: '/alisveris', label: 'Alışveriş', icon: 'cart', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: 'settings', end: false }
]

export default function LzApp() {
  // Pisirme modu tam ekran: alt menu gizlenir (buyuk Geri/Sonraki dugmeleri ortulmesin)
  const pisirme = useLocation().pathname.startsWith('/pisir')
  const navigate = useNavigate()

  // Android "Paylaş" menusu: baska uygulamadan (Instagram, TikTok...) paylasilan
  // link/metin yerel katmandan bu isleve verilir; Tarif ekle ekrani acilip islenir.
  useEffect(() => {
    const w = window as unknown as { __lzPaylasim?: (t: string) => void }
    w.__lzPaylasim = (t: string) => navigate('/ekle', { state: { paylasim: t, zaman: Date.now() } })
    return () => {
      delete w.__lzPaylasim
    }
  }, [navigate])
  return (
    <div className="lz-app min-h-full flex flex-col max-w-xl mx-auto">
      <main className="flex-1" style={{ paddingBottom: pisirme ? 0 : 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/" element={<Recipes />} />
          <Route path="/ekle" element={<AddRecipe />} />
          <Route path="/yeni" element={<EditRecipe />} />
          <Route path="/duzenle/:id" element={<EditRecipe />} />
          <Route path="/tarif/:id" element={<RecipeDetail />} />
          <Route path="/pisir/:id" element={<Cook />} />
          <Route path="/ne-pisirsem" element={<NePisirsem />} />
          <Route path="/hafta" element={<Week />} />
          <Route path="/alisveris" element={<Shopping />} />
          <Route path="/ayarlar" element={<LzSettings />} />
        </Routes>
      </main>

      {!pisirme && (
      <nav
        className="fixed bottom-0 inset-x-0 max-w-xl mx-auto grid grid-cols-4 z-20 backdrop-blur-xl bg-white/85 dark:bg-[#171412]/90 border-t border-[#efe6dc] dark:border-[#2a2420]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="flex flex-col items-center justify-center pt-3 pb-2 gap-1.5">
            {({ isActive }) => (
              <>
                <Icon
                  name={t.icon}
                  className={`h-[21px] w-[21px] transition-colors ${isActive ? 'text-lz-600 dark:text-lz-400' : 'text-[#b3a69b] dark:text-[#7d716a]'}`}
                />
                <span
                  className={`text-[11px] leading-none transition-colors ${
                    isActive ? 'text-lz-600 dark:text-lz-400 font-semibold' : 'text-[#b3a69b] dark:text-[#7d716a] font-medium'
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
