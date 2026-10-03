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
import Thermomix from './pages/Thermomix'
import TmDetail from './pages/TmDetail'
import TmCook from './pages/TmCook'
import Diyetim from './pages/Diyetim'
import Sira from './pages/Sira'
import TarifDegistir from './pages/TarifDegistir'
import Mekanlar from './pages/Mekanlar'
import MekanDetay from './pages/MekanDetay'
import { siraBaslat, siraEkle, siraIsle } from './lib/sira'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from './db'
import { tumOgunleriTara } from './lib/diyetTara'

const tabs: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: '/', label: 'Tariflerim', icon: 'book', end: true },
  { to: '/thermomix', label: 'Thermomix', icon: 'pot', end: false },
  { to: '/hafta', label: 'Bu Hafta', icon: 'calendar', end: false },
  { to: '/alisveris', label: 'Alışveriş', icon: 'cart', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: 'settings', end: false }
]

export default function LzApp() {
  // Pisirme modu tam ekran: alt menu gizlenir (buyuk Geri/Sonraki dugmeleri ortulmesin)
  const yol = useLocation().pathname
  const pisirme = yol.startsWith('/pisir') || /^\/thermomix\/\d+\/pisir/.test(yol)
  const navigate = useNavigate()

  // Android "Paylaş" menusu: baska uygulamadan (Instagram, TikTok...) paylasilan
  // link/metin yerel katmandan bu isleve verilir; Tarif ekle ekrani acilip islenir.
  useEffect(() => {
    const w = window as unknown as { __lzPaylasim?: (t: string, tur?: string) => void }
    // Paylasimlar siraya girer: art arda gelenler tek tek islenir.
    // Paylas menusunde "Lezzet: Mekan" secildiyse tur = 'mekan'
    w.__lzPaylasim = (t: string, tur?: string) => {
      void siraEkle(t, tur === 'mekan' ? 'mekan' : tur === 'tarif' ? 'tarif' : undefined)
      navigate('/sira')
    }
    return () => {
      delete w.__lzPaylasim
    }
  }, [navigate])

  // Acilista yarim kalan sirayi surdur; uygulama one gelince de kontrol et
  // Diyet plani varsa: yeni eklenen tarifler arka planda kendiliginden ogunlerle
  // karsilastirilir (yalnizca yeniler; once bakilanlar icin tekrar harcanmaz)
  const tarifSayisi = useLiveQuery(() => lzDb.recipes.count(), [])
  useEffect(() => {
    if (tarifSayisi === undefined) return
    const t = setTimeout(() => void tumOgunleriTara(), 8000)
    return () => clearTimeout(t)
  }, [tarifSayisi])

  useEffect(() => {
    void siraBaslat()
    const gorunur = () => document.visibilityState === 'visible' && void siraIsle()
    document.addEventListener('visibilitychange', gorunur)
    return () => document.removeEventListener('visibilitychange', gorunur)
  }, [])
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
          <Route path="/thermomix" element={<Thermomix />} />
          <Route path="/thermomix/:id" element={<TmDetail />} />
          <Route path="/thermomix/:id/pisir" element={<TmCook />} />
          <Route path="/sira" element={<Sira />} />
          <Route path="/mekanlar" element={<Mekanlar />} />
          <Route path="/mekan/:id" element={<MekanDetay />} />
          <Route path="/tarif/:id/degistir" element={<TarifDegistir />} />
          <Route path="/diyet" element={<Diyetim />} />
          <Route path="/diyet/:i" element={<Diyetim />} />
          <Route path="/hafta" element={<Week />} />
          <Route path="/alisveris" element={<Shopping />} />
          <Route path="/ayarlar" element={<LzSettings />} />
        </Routes>
      </main>

      {!pisirme && (
      <nav
        className="fixed bottom-0 inset-x-0 max-w-xl mx-auto grid grid-cols-5 z-20 backdrop-blur-xl bg-white/85 dark:bg-[#171412]/90 border-t border-[#efe6dc] dark:border-[#2a2420]"
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
                  className={`text-[10.5px] leading-none transition-colors whitespace-nowrap ${
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
