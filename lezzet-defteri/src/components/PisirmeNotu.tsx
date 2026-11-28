import { useEffect, useRef, useState } from 'react'
import { Sheet, T_BASLIK, T_SOLUK } from './ui'
import type { PisirmeKaydi } from '../types'

// PISIRME GUNLUGU penceresi: Pisirdim ya da Afiyet olsun! sonrasi (ve gunluk satirini duzenlerken).
// Iki dugme: Kaydet (alanlar bos olsa da kaydeder, sayi +1) ve Vazgec. Vazgec ya da X ile kapatmak HICBIR SEY kaydetmez.
export type GunlukGirdi = Pick<PisirmeKaydi, 'degisiklik' | 'deneyim' | 'sonuc'> & { uygula: boolean }
export const SONUC_AD: Record<NonNullable<PisirmeKaydi['sonuc']>, string> = { iyi: 'Daha iyi', ayni: 'Aynı', kotu: 'Daha kötü' }
export const CIHAZ_AD: Record<NonNullable<PisirmeKaydi['cihaz']>, string> = { normal: 'Normal', tm: 'TM7', pp: 'Pilav Pişirici' }

export function PisirmeNotu({
  open,
  onKaydet,
  onVazgec,
  duzenle
}: {
  open: boolean
  onKaydet: (g: GunlukGirdi) => void
  onVazgec: () => void
  duzenle?: PisirmeKaydi // varsa: mevcut satiri duzenleme (tarife uygula secenegi yok)
}) {
  const [degisiklik, setDegisiklik] = useState('')
  const [deneyim, setDeneyim] = useState('')
  const [sonuc, setSonuc] = useState<PisirmeKaydi['sonuc']>()
  const [uygula, setUygula] = useState(false)
  const [uyari, setUyari] = useState('')
  const bitti = useRef(false)
  useEffect(() => {
    if (!open) return
    bitti.current = false
    setDegisiklik(duzenle?.degisiklik ?? '')
    setDeneyim(duzenle?.deneyim ?? duzenle?.not ?? '')
    setSonuc(duzenle?.sonuc)
    setUygula(false)
    setUyari('')
  }, [open, duzenle])
  const vazgec = () => {
    if (bitti.current) return
    bitti.current = true
    onVazgec()
  }
  const kaydet = () => {
    if (bitti.current) return
    if (uygula && !degisiklik.trim()) return setUyari('Tarife uygulamak için ne değiştirdiğini yaz')
    bitti.current = true
    onKaydet({ degisiklik: degisiklik.trim() || undefined, deneyim: deneyim.trim() || undefined, sonuc, uygula: uygula && !!degisiklik.trim() })
  }
  return (
    <Sheet open={open} onClose={vazgec} title={duzenle ? 'Günlük kaydını düzenle' : 'Pişirme Günlüğü'}>
      <div className="space-y-3" data-pisirme-notu>
        <label className="block">
          <span className={`block text-[13.5px] font-semibold mb-1 ${T_BASLIK}`}>Ne değiştirdim?</span>
          <input
            className="lz-input text-[15px]"
            placeholder="Örn. Sütü artırdım"
            value={degisiklik}
            maxLength={300}
            onChange={(e) => {
              setDegisiklik(e.target.value)
              setUyari('')
            }}
            data-alan="degisiklik"
          />
        </label>
        <label className="block">
          <span className={`block text-[13.5px] font-semibold mb-1 ${T_BASLIK}`}>Nasıl oldu? / Deneyimim</span>
          <textarea className="lz-input min-h-[72px] text-[15px]" placeholder="Örn. Daha yumuşak oldu" value={deneyim} maxLength={400} onChange={(e) => setDeneyim(e.target.value)} data-alan="deneyim" />
        </label>
        <div>
          <span className={`block text-[13.5px] font-semibold mb-1 ${T_BASLIK}`}>Sonuç</span>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SONUC_AD) as NonNullable<PisirmeKaydi['sonuc']>[]).map((k) => (
              <button key={k} className={`lz-chip justify-center !min-h-[48px] !px-2 ${sonuc === k ? 'lz-chip-on' : ''}`} onClick={() => setSonuc(sonuc === k ? undefined : k)} data-sonuc={k}>
                {SONUC_AD[k]}
              </button>
            ))}
          </div>
        </div>
        {!duzenle && (
          <label className="flex items-start gap-3 min-h-[48px] cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 w-5 h-5 flex-shrink-0"
              checked={uygula}
              onChange={(e) => {
                setUygula(e.target.checked)
                setUyari('')
              }}
              data-alan="uygula"
            />
            <span>
              <span className={`block text-[14px] font-semibold ${T_BASLIK}`}>Bu değişikliği tarife uygula</span>
              <span className={`block text-[12px] ${T_SOLUK}`}>İşaretliyse yalnızca Normal tarif güncellenir, değişen malzeme ve adımların sonunda ✎ olur. İşaretsizse yalnızca günlük notu kalır.</span>
            </span>
          </label>
        )}
        {uyari && (
          <p className="rounded-xl bg-amber-50 dark:bg-[#33270f] text-amber-900 dark:text-amber-200 text-[13px] font-semibold px-3 py-2" role="alert" data-uyari>
            {uyari}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button className="lz-btn-soft" onClick={vazgec} data-vazgec>
            Vazgeç
          </button>
          <button className="lz-btn-primary" onClick={kaydet} data-kaydet>
            Kaydet
          </button>
        </div>
      </div>
    </Sheet>
  )
}
