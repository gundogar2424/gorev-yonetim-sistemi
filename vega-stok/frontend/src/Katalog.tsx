import { useEffect, useRef, useState } from 'react'
import { filtreleriGetir, gorselAdresi, gorselYukle, saglikGetir, urunleriAra, type Arama, type Filtreler, type Urun } from './api'

const para = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
const adet = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })

function stokDurumu(u: Urun): { etiket: string; sinif: string } {
  if (u.stok <= 0) return { etiket: 'Tükendi', sinif: 'bg-red-100 text-red-700' }
  if (u.kritikEsik != null && u.stok < u.kritikEsik) return { etiket: `${adet.format(u.stok)} · kritik`, sinif: 'bg-amber-100 text-amber-800' }
  return { etiket: `${adet.format(u.stok)} adet`, sinif: 'bg-emerald-100 text-emerald-700' }
}

function Gorsel({ urun, boyut, className }: { urun: Urun; boyut: 'kart' | 'buyuk'; className: string }) {
  const adres = gorselAdresi(urun, boyut)
  return adres ? (
    <img src={adres} alt={urun.ad} loading="lazy" className={`${className} object-cover`} />
  ) : (
    <div className={`${className} flex items-center justify-center bg-slate-200 text-sm text-slate-400`}>Görsel yok</div>
  )
}

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

function Detay({ urun, kapat, guncellendi }: { urun: Urun; kapat: () => void; guncellendi: (u: Urun) => void }) {
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const durum = stokDurumu(urun)

  useEffect(() => {
    const tus = (e: KeyboardEvent) => e.key === 'Escape' && kapat()
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [kapat])

  async function dosyaSecildi(dosya: File | undefined) {
    if (!dosya) return
    setYukleniyor(true)
    setHata(null)
    try {
      const { gorselSurum } = await gorselYukle(urun.id, dosya)
      guncellendi({ ...urun, gorselSurum })
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Görsel yüklenemedi')
    } finally {
      setYukleniyor(false)
    }
  }

  const satirlar: [string, string | null][] = [
    ['Stok kodu', urun.kod],
    ['Barkod', urun.barkod],
    ['Marka', urun.marka],
    ['Kategori', urun.kategori],
    ['Ölçü', urun.olcu],
    ['Raf', urun.raf],
    ['KDV', urun.kdv != null ? `%${urun.kdv}` : null],
  ]

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-6" onClick={kapat}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={urun.ad}
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-y-auto rounded-t-2xl bg-white sm:flex-row sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Gorsel urun={urun} boyut="buyuk" className="aspect-square w-full shrink-0 sm:w-1/2" />
        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold leading-snug">{urun.ad}</h2>
            <button onClick={kapat} aria-label="Kapat" className="-mr-2 -mt-2 rounded-lg p-2 text-2xl leading-none text-slate-400 hover:bg-slate-100">
              ×
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{urun.satisFiyati != null ? para.format(urun.satisFiyati) : '—'}</span>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${durum.sinif}`}>{durum.etiket}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {satirlar.map(([ad, deger]) => (
              <div key={ad} className="contents">
                <dt className="text-slate-500">{ad}</dt>
                <dd className="font-medium">{deger ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-auto">
            <label
              className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 ${yukleniyor ? 'pointer-events-none opacity-60' : ''}`}
            >
              {yukleniyor ? 'Yükleniyor…' : urun.gorselSurum ? 'Görseli değiştir' : 'Görsel ekle'}
              <input type="file" accept="image/*" className="hidden" disabled={yukleniyor} onChange={(e) => dosyaSecildi(e.target.files?.[0])} />
            </label>
            {hata && <p className="mt-2 text-sm text-red-600">{hata}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

const BOS: Arama = { q: '', marka: '', kategori: '', olcu: '' }

export function Katalog() {
  const [arama, setArama] = useState<Arama>(BOS)
  const [urunler, setUrunler] = useState<Urun[] | null>(null)
  const [filtreler, setFiltreler] = useState<Filtreler>({ markalar: [], kategoriler: [], olculer: [] })
  const [sure, setSure] = useState<number | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [uyari, setUyari] = useState<string | null>(null)
  const [seciliId, setSeciliId] = useState<number | null>(null)
  const kutu = useRef<HTMLInputElement>(null)

  useEffect(() => {
    filtreleriGetir().then(setFiltreler).catch(() => {})
    saglikGetir()
      .then((s) => setUyari(s.demo ? 'Demo modu: örnek ürünler gösteriliyor, Vega bağlı değil.' : s.esitleme.sonHata ? `Vega eşitlemesi çalışmıyor: ${s.esitleme.sonHata}` : null))
      .catch(() => {})
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
  }, [arama])

  const degistir = (alan: keyof Arama) => (deger: string) => setArama((a) => ({ ...a, [alan]: deger }))
  const filtreVar = arama.q || arama.marka || arama.kategori || arama.olcu
  const secili = urunler?.find((u) => u.id === seciliId) ?? null

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <header className="sticky top-0 z-10 -mx-4 bg-slate-100/95 px-4 pb-3 pt-4 backdrop-blur">
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

      {uyari && <p className="mb-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">{uyari}</p>}
      {hata && <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 ring-1 ring-red-200">{hata}</p>}

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
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {secili && (
        <Detay
          urun={secili}
          kapat={() => setSeciliId(null)}
          guncellendi={(yeni) => setUrunler((liste) => liste?.map((u) => (u.id === yeni.id ? yeni : u)) ?? null)}
        />
      )}
    </div>
  )
}
