import { useEffect } from 'react'
import { otomatikYedek, sitedenGeriYukle } from './lib/backup'
import { ppOtoUret } from './lib/ppOto'
import { buyukFotolariSikistir } from './lib/image'
import { yakinIzle } from './lib/yakinBildirim'
import { puanlariYenile } from './lib/begeni'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
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
import PpDetail from './pages/PpDetail'
import PpCook from './pages/PpCook'
import TmCook from './pages/TmCook'
import Diyetim from './pages/Diyetim'
import Sira from './pages/Sira'
import TarifDegistir from './pages/TarifDegistir'
import MekanDetay from './pages/MekanDetay'
import GeziPlani from './pages/GeziPlani'
import Harita from './pages/Harita'
import Etiketler from './pages/Etiketler'
import MekanOner from './pages/MekanOner'
import CevreHype from './pages/CevreHype'
import HypeTarifler from './pages/HypeTarifler'
import Takip from './pages/Takip'
import Harcamalarim from './pages/Harcamalarim'
import Gittiklerim from './pages/Gittiklerim'
import Sinirsiz from './pages/Sinirsiz'
import Influencer from './pages/Influencer'
import { bekciBaslat, siraBaslat, siraBekci, siraEkle } from './lib/sira'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from './db'
import { tumOgunleriTara } from './lib/diyetTara'
import { yeniMekanOtoKontrol } from './lib/hesaplar'
import { paylasanTamamla } from './lib/mekan'

const tabs: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: '/', label: 'Tarifler', icon: 'book', end: true },
  { to: '/thermomix', label: 'TM7', icon: 'pot', end: false },
  { to: '/hafta', label: 'Bu Hafta', icon: 'calendar', end: false },
  { to: '/alisveris', label: 'Alışveriş', icon: 'cart', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: 'settings', end: false }
]

export default function LzApp() {
  // Pisirme modu tam ekran: alt menu gizlenir (buyuk Geri/Sonraki dugmeleri ortulmesin)
  const yol = useLocation().pathname
  const pisirme = /^\/pisir\/\d+/.test(yol) || /^\/(thermomix|pisirici)\/\d+\/pisir/.test(yol)
  const navigate = useNavigate()

  // Android "Paylaş" menusu: baska uygulamadan (Instagram, TikTok...) paylasilan
  // link/metin yerel katmandan bu isleve verilir; Tarif ekle ekrani acilip islenir.
  useEffect(() => {
    const w = window as unknown as { __lzPaylasim?: (t: string, tur?: string) => void }
    // Paylasimlar siraya girer: art arda gelenler tek tek islenir.
    // Paylas menusunde "Lezzet Rotası: Mekan" secildiyse tur = 'mekan'
    w.__lzPaylasim = (t: string, tur?: string) => {
      void siraEkle(t, tur === 'mekan' ? 'mekan' : tur === 'tarif' ? 'tarif' : undefined)
      navigate('/sira')
    }
    // Bildirime dokununca ilgili sayfa (ör. yakindaki mekan)
    const a = window as unknown as { __lzAc?: (yol: string) => void }
    a.__lzAc = (yol: string) => navigate(yol)
    return () => {
      delete w.__lzPaylasim
      delete a.__lzAc
    }
  }, [navigate])
  // Yakinda sevdigin mekan bildirimi (konum izni varsa, uygulama calisirken)
  useEffect(() => yakinIzle(), [])

  // Acilista yarim kalan sirayi surdur; uygulama one gelince de kontrol et
  // Diyet plani varsa: yeni eklenen tarifler arka planda kendiliginden ogunlerle
  // karsilastirilir (yalnizca yeniler; once bakilanlar icin tekrar harcanmaz)
  const tarifSayisi = useLiveQuery(() => lzDb.recipes.count(), [])
  useEffect(() => {
    if (tarifSayisi === undefined) return
    const t = setTimeout(() => void tumOgunleriTara(), 8000)
    // Yeni kaydedilen tariflerin pilav pisirici uyarlamasi (arka planda)
    const p = setTimeout(() => void ppOtoUret(), 12000)
    return () => {
      clearTimeout(t)
      clearTimeout(p)
    }
  }, [tarifSayisi])

  useEffect(() => {
    void siraBaslat()
    bekciBaslat()
    // Takip edilen hesaplarin yeni mekanlari (3 gunde bir, tek istek)
    const yeniT = setTimeout(() => void yeniMekanOtoKontrol(), 20000)
    // Gunluk otomatik yedek (Belgeler/LezzetRotasi; uygulama silinse de kalir)
    // Telefonda tarif yoksa sitedeki yedekten kendiliginden yukle; yedek ondan sonra alinir
    void sitedenGeriYukle()
    const yedekT = setTimeout(() => void otomatikYedek().catch(() => undefined), 30000)
    // Buyuk eski fotograflar arka planda sikistirilir (liste hizli acilsin)
    const fotoT = setTimeout(() => void buyukFotolariSikistir().catch(() => undefined), 45000)
    // Ayni videodan kaydedilip paylasani bos kalan mekanlar tamamlanir (yapay zekasiz)
    void paylasanTamamla()
    // Begeni puanlari yeni araliklara gore (bir kez, sayilar degismez)
    void puanlariYenile().catch(() => undefined)
    const gorunur = () => document.visibilityState === 'visible' && void siraBekci()
    document.addEventListener('visibilitychange', gorunur)
    return () => {
      clearTimeout(yeniT)
      clearTimeout(yedekT)
      clearTimeout(fotoT)
      document.removeEventListener('visibilitychange', gorunur)
    }
  }, [])
  return (
    <div className="lz-app min-h-full flex flex-col max-w-xl mx-auto">
      {/* Liste sonu: + dugmesinin (menunun 24 px ustune tasar) altinda en az 100 px bosluk */}
      <main className="flex-1" style={{ paddingBottom: pisirme ? 0 : 'calc(4rem + 24px + 100px + env(safe-area-inset-bottom))' }}>
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
          <Route path="/pisirici/:id" element={<PpDetail />} />
          <Route path="/pisirici/:id/pisir" element={<PpCook />} />
          <Route path="/thermomix/:id/pisir" element={<TmCook />} />
          <Route path="/sira" element={<Sira />} />
          <Route path="/mekanlar" element={<MekanlarSekmesi />} />
          <Route path="/mekan/:id" element={<MekanDetay />} />
          <Route path="/gezi" element={<GeziPlani />} />
          <Route path="/harita" element={<Harita />} />
          <Route path="/etiketler" element={<Etiketler />} />
          <Route path="/oner" element={<MekanOner />} />
          <Route path="/cevre-hype" element={<CevreHype />} />
          <Route path="/hype" element={<HypeTarifler />} />
          <Route path="/takip" element={<Takip />} />
          <Route path="/harcamalarim" element={<Harcamalarim />} />
          <Route path="/gittiklerim" element={<Gittiklerim />} />
          <Route path="/sinirsiz" element={<Sinirsiz />} />
          <Route path="/influencer/:h" element={<Influencer />} />
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
        className="fixed bottom-0 inset-x-0 max-w-xl mx-auto grid grid-cols-6 z-20 backdrop-blur-xl bg-white/90 dark:bg-[#16130F]/90 border-t border-[#DDD2BF] dark:border-[#2C261F]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.flatMap((t, i) => [
          ...(i === 2
            ? [
                // Tarif ekle: alt menunun ortasinda buyuk yuvarlak dugme
                <div key="ekle" className="flex items-start justify-center">
                  <Link
                    to="/ekle"
                    aria-label="Tarif ekle"
                    className="-mt-6 w-[60px] h-[60px] rounded-full bg-lz-600 text-white flex items-center justify-center shadow-[0_6px_16px_rgba(0,0,0,0.22)] ring-4 ring-white dark:ring-[#16130F] active:scale-95 transition"
                  >
                    <Icon name="plus" className="w-7 h-7" />
                  </Link>
                </div>
              ]
            : []),
          <NavLink key={t.to} to={t.to} end={t.end} className="flex flex-col items-center justify-center pt-2 pb-2 gap-[2px] min-h-[56px] min-w-0 px-0.5 overflow-hidden">
            {({ isActive }) => (
              <>
                <span className={`px-2.5 py-1 rounded-full transition-colors ${isActive ? 'bg-lz-50 dark:bg-[#3a1d16]' : ''}`}>
                  <Icon
                    name={t.icon}
                    className={`h-[21px] w-[21px] transition-colors ${isActive ? 'text-lz-600 dark:text-lz-400' : 'text-[#5C5245] dark:text-[#BDB3A2]'}`}
                  />
                </span>
                <span
                  data-nav-yazi
                  className={`block text-[11px] leading-[1.15] tracking-[-0.01em] text-center max-w-full [overflow-wrap:anywhere] transition-colors ${
                    isActive ? 'text-lz-700 dark:text-lz-400 font-bold' : 'text-[#5C5245] dark:text-[#BDB3A2] font-medium'
                  }`}
                >
                  {t.label}
                </span>
              </>
            )}
          </NavLink>
        ])}
      </nav>
      )}
    </div>
  )
}

// Mekanlarim ayri ekran degil: Tarifler ekraninin ortadaki sekmesi. Eski /mekanlar linkleri (etiket, yemek dahil) oraya gider.
function MekanlarSekmesi() {
  const { search } = useLocation()
  const p = new URLSearchParams(search)
  p.set('sekme', 'mekanlar')
  return <Navigate to={`/?${p.toString()}`} replace />
}
