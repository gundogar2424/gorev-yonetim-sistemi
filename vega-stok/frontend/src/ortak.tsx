import { useCallback, useEffect, useState } from 'react'

export const para = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
export const adet = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })

/** Bugünün yerel tarihi, YYYY-AA-GG */
export const bugun = () => new Date().toLocaleDateString('sv-SE')
export const terminGecti = (termin: string | null) => termin !== null && termin < bugun()
export const tarih = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : 'Termin yok')

export function gecikmeGun(termin: string): number {
  return Math.round((Date.parse(bugun()) - Date.parse(termin)) / 86_400_000)
}

export function stokDurumu(u: { stok: number; kritikEsik: number | null }): { etiket: string; sinif: string } {
  if (u.stok <= 0) return { etiket: 'Tükendi', sinif: 'bg-red-100 text-red-700' }
  if (u.kritikEsik != null && u.stok < u.kritikEsik) return { etiket: `${adet.format(u.stok)} · kritik`, sinif: 'bg-amber-100 text-amber-800' }
  return { etiket: `${adet.format(u.stok)} adet`, sinif: 'bg-emerald-100 text-emerald-700' }
}

export function Gorsel({ urun, boyut, className }: { urun: { id: number; ad?: string; gorselSurum: number | null }; boyut: 'kart' | 'buyuk'; className: string }) {
  return urun.gorselSurum ? (
    <img src={`/gorseller/${urun.id}/${boyut}.webp?v=${urun.gorselSurum}`} alt={urun.ad ?? ''} loading="lazy" className={`${className} object-cover`} />
  ) : (
    <div className={`${className} flex items-center justify-center bg-slate-200 text-center text-xs text-slate-400`}>Görsel yok</div>
  )
}

/** Veriyi yükler; `yenile()` ile tekrar çeker. */
export function useVeri<T>(getir: () => Promise<T>) {
  const [veri, setVeri] = useState<T | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [sayac, setSayac] = useState(0)
  useEffect(() => {
    let gecerli = true
    getir()
      .then((v) => gecerli && (setVeri(v), setHata(null)))
      .catch((e) => gecerli && setHata(e instanceof Error ? e.message : 'Sunucuya ulaşılamadı'))
    return () => {
      gecerli = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sayac])
  return { veri, hata, yenile: useCallback(() => setSayac((s) => s + 1), []) }
}

export const Hata = ({ mesaj }: { mesaj: string | null }) =>
  mesaj ? <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 ring-1 ring-red-200">{mesaj}</p> : null
