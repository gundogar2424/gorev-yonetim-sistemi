import { useEffect, useRef, useState, type FormEvent } from 'react'
import { barkodlaGetir, type Urun } from './api'
import { adet, Gorsel, stokDurumu, tarih, terminGecti } from './ortak'

/**
 * El terminali (depo modu). Dahili barkod okuyucu klavye gibi yazar ve sonuna
 * Enter ekler (Keyboard Wedge); bu sayfa odağı hep giriş kutusunda tutar ve
 * Enter gelince sayfa yenilenmeden ürünü gösterir.
 */
export function Depo() {
  const [kod, setKod] = useState('')
  const [urun, setUrun] = useState<Urun | null>(null)
  const [bulunamayan, setBulunamayan] = useState<string | null>(null)
  const [klavye, setKlavye] = useState(false) // kapalıyken ekran klavyesi açılmaz
  const kutu = useRef<HTMLInputElement>(null)
  const sira = useRef(0)

  // Odak başka yere kayarsa geri al: okutulan barkod asla boşa gitmesin
  useEffect(() => {
    const odakla = () => kutu.current?.focus()
    odakla()
    document.addEventListener('click', odakla)
    return () => document.removeEventListener('click', odakla)
  }, [])

  async function okut(e: FormEvent) {
    e.preventDefault()
    const okunan = kod.trim()
    setKod('')
    if (!okunan) return
    const benim = ++sira.current
    try {
      const bulunan = await barkodlaGetir(okunan)
      if (benim !== sira.current) return // arkadan yeni okutma geldi
      setUrun(bulunan)
      setBulunamayan(null)
    } catch {
      if (benim !== sira.current) return
      setUrun(null)
      setBulunamayan(okunan)
      navigator.vibrate?.(300)
    }
  }

  return (
    <div className="mx-auto max-w-md py-3">
      <form onSubmit={okut} className="flex gap-2">
        <input
          ref={kutu}
          value={kod}
          onChange={(e) => setKod(e.target.value)}
          inputMode={klavye ? 'text' : 'none'}
          autoComplete="off"
          autoCapitalize="off"
          enterKeyHint="search"
          placeholder="Barkod okutun"
          aria-label="Barkod"
          className="h-14 min-w-0 flex-1 rounded-xl border-2 border-blue-500 bg-white px-4 text-xl outline-none"
        />
        <button type="button" onClick={() => setKlavye((k) => !k)} aria-pressed={klavye} className={`h-14 rounded-xl px-4 text-sm font-medium ring-1 ${klavye ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white ring-slate-300'}`}>
          Klavye
        </button>
      </form>

      {bulunamayan && (
        <div role="alert" className="mt-4 rounded-xl bg-red-600 p-6 text-center text-white">
          <p className="text-xl font-bold">Ürün bulunamadı</p>
          <p className="mt-1 break-all font-mono">{bulunamayan}</p>
        </div>
      )}

      {urun && (
        <div className="mt-4 overflow-hidden rounded-xl bg-white shadow ring-1 ring-slate-200">
          <Gorsel urun={urun} boyut="buyuk" className="aspect-square w-full" />
          <div className="space-y-3 p-4">
            <h1 className="text-xl font-semibold leading-snug">{urun.ad}</h1>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-100 p-3 text-center">
                <p className="text-xs text-slate-500">Raf</p>
                <p className="text-2xl font-bold">{urun.raf ?? '—'}</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${stokDurumu(urun).sinif}`}>
                <p className="text-xs opacity-80">Vega stoğu</p>
                <p className="text-2xl font-bold">{adet.format(urun.stok)}</p>
              </div>
            </div>
            {urun.yoldaki > 0 && (
              <p className={`rounded-lg px-3 py-2 text-sm ${terminGecti(urun.termin) ? 'bg-red-600 font-medium text-white' : 'bg-slate-100 text-slate-700'}`}>
                Yolda {adet.format(urun.yoldaki)} · {urun.tedarikci} · {tarih(urun.termin)}
              </p>
            )}
            <p className="text-sm text-slate-500">{[urun.kod, urun.barkod].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      )}

      {!urun && !bulunamayan && <p className="mt-10 text-center text-slate-400">Okutulan ürün burada görünecek.</p>}
    </div>
  )
}
