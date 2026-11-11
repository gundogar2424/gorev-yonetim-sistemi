import { useEffect, useState, type ReactNode } from 'react'
import { cikisYap, OTURUM_BITTI, oturumGetir, saglikGetir, type Kullanici, type Rol, type Saglik } from './api'
import { Depo } from './Depo'
import { Giris } from './Giris'
import { Katalog } from './Katalog'
import { KritikStok } from './KritikStok'
import { Hesap, Kullanicilar } from './Kullanicilar'
import { Ayarlar } from './Ayarlar'
import { Tedarik } from './Tedarik'
import { Teklifler } from './Teklif'

// Adres: #/sayfa/alt — örn. #/teklif/12. `alt` kısmı sayfaya verilir.
// `roller` yoksa sayfa herkese açıktır; sunucu aynı kuralları ayrıca uygular.
const SATIS: Rol[] = ['yonetici', 'satis']
const SAYFALAR: { yol: string; ad: string; roller?: Rol[]; menude?: false; bilesen: (p: { alt: string; ben: Kullanici }) => ReactNode }[] = [
  { yol: '', ad: 'Katalog', bilesen: Katalog },
  { yol: 'teklif', ad: 'Teklif', roller: SATIS, bilesen: Teklifler },
  { yol: 'kritik', ad: 'Kritik Stok', bilesen: KritikStok },
  { yol: 'tedarik', ad: 'Tedarik', bilesen: Tedarik },
  { yol: 'depo', ad: 'Depo', bilesen: Depo },
  { yol: 'ayarlar', ad: 'Ayarlar', roller: ['yonetici'], bilesen: Ayarlar },
  { yol: 'kullanicilar', ad: 'Kullanıcılar', roller: ['yonetici'], bilesen: Kullanicilar },
  { yol: 'hesap', ad: 'Hesabım', menude: false, bilesen: Hesap },
]

const yolOku = () => location.hash.replace(/^#\/?/, '')

/** Vega eşitlemesinin durumu: 30 saniyede bir yoklanır, sayfa açık kaldıkça güncellenir. */
function EsitlemeDurumu() {
  const [saglik, setSaglik] = useState<Saglik | null>(null)
  const [ulasilamadi, setUlasilamadi] = useState(false)
  const [, setAn] = useState(0)

  useEffect(() => {
    const yokla = () => saglikGetir().then((s) => (setSaglik(s), setUlasilamadi(false))).catch(() => setUlasilamadi(true))
    void yokla()
    const z = setInterval(() => (void yokla(), setAn((a) => a + 1)), 30_000)
    return () => clearInterval(z)
  }, [])

  let renk = 'bg-emerald-500'
  let metin = 'Vega bekleniyor…'
  if (ulasilamadi) [renk, metin] = ['bg-red-500', 'Sunucuya ulaşılamıyor']
  else if (saglik?.demo) [renk, metin] = ['bg-amber-500', 'Demo verisi · Vega bağlı değil']
  else if (saglik) {
    const son = [saglik.esitleme.sonHizliTur, saglik.esitleme.sonTamTur].filter(Boolean).sort().pop()
    const dk = son ? Math.floor((Date.now() - Date.parse(son)) / 60_000) : null
    const once = dk === null ? 'henüz eşitlenmedi' : dk < 1 ? 'az önce' : dk < 60 ? `${dk} dk önce` : `${Math.floor(dk / 60)} sa önce`
    if (saglik.esitleme.sonHata) [renk, metin] = ['bg-red-500', `Vega eşitlemesi durdu · son: ${once}`]
    else if (dk === null) [renk, metin] = ['bg-amber-500', 'Vega: ilk eşitleme sürüyor']
    else if (dk >= 5) [renk, metin] = ['bg-red-500', `Vega verisi eski · ${once}`]
    else metin = `Vega: ${once}`
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600" title={saglik?.esitleme.sonHata ?? undefined}>
      <span className={`size-2 rounded-full ${renk}`} />
      {metin}
    </span>
  )
}

export function App() {
  // undefined: giriş durumu henüz soruluyor · null: giriş yapılmamış
  const [ben, setBen] = useState<Kullanici | null | undefined>(undefined)
  const [kurulum, setKurulum] = useState(false)
  const [demo, setDemo] = useState(false)
  const [yol, setYol] = useState(yolOku)

  useEffect(() => {
    oturumGetir().then((o) => (setBen(o.kullanici), setKurulum(o.kurulumGerekli))).catch(() => setBen(null))
    saglikGetir().then((s) => setDemo(s.demo)).catch(() => {})
    const degisti = () => setYol(yolOku())
    const bitti = () => setBen(null) // herhangi bir istek 401 dönerse giriş ekranına
    window.addEventListener('hashchange', degisti)
    window.addEventListener(OTURUM_BITTI, bitti)
    return () => {
      window.removeEventListener('hashchange', degisti)
      window.removeEventListener(OTURUM_BITTI, bitti)
    }
  }, [])

  if (ben === undefined) return null
  if (ben === null) return <Giris kurulum={kurulum} demo={demo} girildi={(k) => (setKurulum(false), setBen(k))} />

  const acik = SAYFALAR.filter((s) => !s.roller || s.roller.includes(ben.rol))
  const [ilk = '', alt = ''] = yol.split('/')
  const sayfa = acik.find((s) => s.yol === ilk) ?? acik[0]!
  const Sayfa = sayfa.bilesen

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <nav className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3">
        <div className="flex gap-1 overflow-x-auto">
          {acik.filter((s) => s.menude !== false).map((s) => (
            <a
              key={s.yol}
              href={`#/${s.yol}`}
              aria-current={s === sayfa ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${s === sayfa ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
            >
              {s.ad}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <EsitlemeDurumu />
          <span className="flex items-center gap-2 text-sm">
            <a href="#/hesap" className="font-medium text-slate-700 hover:underline">{ben.ad}</a>
            <button onClick={() => void cikisYap().finally(() => setBen(null))} className="text-slate-500 hover:text-red-600">Çıkış</button>
          </span>
        </div>
      </nav>
      <Sayfa alt={alt} ben={ben} />
    </div>
  )
}
