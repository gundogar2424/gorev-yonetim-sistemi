import { useEffect, useState, type ReactNode } from 'react'
import { saglikGetir, type Saglik } from './api'
import { Depo } from './Depo'
import { Katalog } from './Katalog'
import { KritikStok } from './KritikStok'
import { Ayarlar } from './Ayarlar'
import { Tedarik } from './Tedarik'
import { Teklifler } from './Teklif'

// Adres: #/sayfa/alt — örn. #/teklif/12. `alt` kısmı sayfaya verilir.
const SAYFALAR: { yol: string; ad: string; bilesen: (p: { alt: string }) => ReactNode }[] = [
  { yol: '', ad: 'Katalog', bilesen: Katalog },
  { yol: 'teklif', ad: 'Teklif', bilesen: Teklifler },
  { yol: 'kritik', ad: 'Kritik Stok', bilesen: KritikStok },
  { yol: 'tedarik', ad: 'Tedarik', bilesen: Tedarik },
  { yol: 'depo', ad: 'Depo', bilesen: Depo },
  { yol: 'ayarlar', ad: 'Ayarlar', bilesen: Ayarlar },
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
  const [yol, setYol] = useState(yolOku)
  useEffect(() => {
    const degisti = () => setYol(yolOku())
    window.addEventListener('hashchange', degisti)
    return () => window.removeEventListener('hashchange', degisti)
  }, [])
  const [ilk = '', alt = ''] = yol.split('/')
  const sayfa = SAYFALAR.find((s) => s.yol === ilk) ?? SAYFALAR[0]!
  const Sayfa = sayfa.bilesen

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <nav className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3">
        <div className="flex gap-1 overflow-x-auto">
          {SAYFALAR.map((s) => (
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
        <EsitlemeDurumu />
      </nav>
      <Sayfa alt={alt} />
    </div>
  )
}
