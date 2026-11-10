import { useEffect, useRef, useState } from 'react'
import { filtreleriGetir, urunleriAra, type Arama, type Filtreler, type Urun } from './api'
import { adet, Gorsel, Hata, para, stokDurumu, tarih, terminGecti } from './ortak'
import { UrunDetay } from './UrunDetay'

function Secim({ etiket, deger, secenekler, degisti }: { etiket: string; deger: string; secenekler: string[]; degisti: (v: string) => void }) {
  return (
    <select
      aria-label={etiket}
      value={deger}
      onChange={(e) => degisti(e.target.value)}
      className={`h-11 min-w-0 flex-1 rounded-lg border bg-white px-3 text-sm sm:flex-none ${deger ? 'border-blue-500 text-blue-700' : 'border-slate-300'}`}
    >
      <option value="">{etiket}</option>
      {secenekler.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  )
}

/** Kartın tedarik satırı: yoldaki adet · tedarikçi · termin (termin geçtiyse kırmızı alarm). */
function TedarikSatiri({ urun }: { urun: Urun }) {
  if (urun.yoldaki <= 0) return null
  const gecti = terminGecti(urun.termin)
  return (
    <p className={`-mx-3 -mb-3 mt-1 px-3 py-1.5 text-xs ${gecti ? 'bg-red-600 font-medium text-white' : 'bg-slate-50 text-slate-600'}`}>
      Yolda {adet.format(urun.yoldaki)} · {urun.tedarikci} · {gecti ? `Termin geçti (${tarih(urun.termin)})` : tarih(urun.termin)}
    </p>
  )
}

const BOS: Arama = { q: '', marka: '', kategori: '', olcu: '' }

export function Katalog() {
  const [arama, setArama] = useState<Arama>(BOS)
  const [urunler, setUrunler] = useState<Urun[] | null>(null)
  const [filtreler, setFiltreler] = useState<Filtreler>({ markalar: [], kategoriler: [], olculer: [] })
  const [sure, setSure] = useState<number | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [seciliId, setSeciliId] = useState<number | null>(null)
  const [tazele, setTazele] = useState(0)
  const kutu = useRef<HTMLInputElement>(null)

  useEffect(() => {
    filtreleriGetir().then(setFiltreler).catch(() => {})
  }, [])

  // Her tuş vuruşunda hemen sorgula; yarıda kalan eski istek iptal edilir
  useEffect(() => {
    const iptal = new AbortController()
    const basla = performance.now()
    urunleriAra(arama, iptal.signal)
      .then((sonuc) => {
        setUrunler(sonuc)
        setSure(Math.round(performance.now() - basla))
        setHata(null)
      })
      .catch((e) => {
        if (!iptal.signal.aborted) setHata(e instanceof Error ? e.message : 'Sunucuya ulaşılamadı')
      })
    return () => iptal.abort()
  }, [arama, tazele])

  const degistir = (alan: keyof Arama) => (deger: string) => setArama((a) => ({ ...a, [alan]: deger }))
  const filtreVar = arama.q || arama.marka || arama.kategori || arama.olcu

  return (
    <>
      <header className="sticky top-0 z-10 -mx-4 bg-slate-100/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <input
            ref={kutu}
            autoFocus
            type="search"
            value={arama.q}
            onChange={(e) => degistir('q')(e.target.value)}
            placeholder="Ürün adı, stok kodu veya barkod…"
            aria-label="Ürün ara"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:w-auto sm:flex-1"
          />
          <Secim etiket="Kategori" deger={arama.kategori} secenekler={filtreler.kategoriler} degisti={degistir('kategori')} />
          <Secim etiket="Marka" deger={arama.marka} secenekler={filtreler.markalar} degisti={degistir('marka')} />
          <Secim etiket="Ölçü" deger={arama.olcu} secenekler={filtreler.olculer} degisti={degistir('olcu')} />
        </div>
        <div className="mt-2 flex min-h-5 items-center gap-3 text-xs text-slate-500">
          {urunler && (
            <span>
              {urunler.length} ürün{urunler.length === 200 ? ' (ilk 200)' : ''}
              {sure != null && ` · ${sure} ms`}
            </span>
          )}
          {filtreVar && (
            <button
              className="font-medium text-blue-600 hover:underline"
              onClick={() => {
                setArama(BOS)
                kutu.current?.focus()
              }}
            >
              Temizle
            </button>
          )}
        </div>
      </header>

      <Hata mesaj={hata} />
      {urunler?.length === 0 && !hata && (
        <p className="py-16 text-center text-slate-500">{filtreVar ? 'Bu aramaya uyan ürün yok.' : 'Henüz ürün yok — Vega eşitlemesinin tamamlanması bekleniyor.'}</p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {urunler?.map((u) => {
          const durum = stokDurumu(u)
          return (
            <li key={u.id}>
              <button
                onClick={() => setSeciliId(u.id)}
                className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-blue-400"
              >
                <Gorsel urun={u} boyut="kart" className="aspect-square w-full" />
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{u.ad}</p>
                  <p className="text-xs text-slate-500">{u.kod}</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-1 pt-1">
                    <span className="font-semibold">{u.satisFiyati != null ? para.format(u.satisFiyati) : '—'}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${durum.sinif}`}>{durum.etiket}</span>
                  </div>
                  <TedarikSatiri urun={u} />
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {seciliId !== null && <UrunDetay id={seciliId} kapat={() => setSeciliId(null)} degisti={() => setTazele((t) => t + 1)} />}
    </>
  )
}
