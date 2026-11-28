import { useEffect, useRef, useState } from 'react'
import { Sheet, T_BASLIK, T_SOLUK } from './ui'
import type { PisirmeKaydi } from '../types'

// PISIRME GUNLUGU penceresi: Pisirdim ya da Afiyet olsun! sonrasi. Hicbir alan zorunlu degil;
// pencere kapatilirsa notsuz kaydedilir (sayi yine artar). onKaydet yalnizca bir kez cagrilir.
export type GunlukGirdi = Pick<PisirmeKaydi, 'degisiklik' | 'deneyim' | 'sonuc'> & { uygula: boolean }
export const SONUC_AD: Record<NonNullable<PisirmeKaydi['sonuc']>, string> = { iyi: 'Daha iyi', ayni: 'Aynı', kotu: 'Daha kötü' }

export function PisirmeNotu({ open, onKaydet }: { open: boolean; onKaydet: (g?: GunlukGirdi) => void }) {
  const [degisiklik, setDegisiklik] = useState('')
  const [deneyim, setDeneyim] = useState('')
  const [sonuc, setSonuc] = useState<PisirmeKaydi['sonuc']>()
  const [uygula, setUygula] = useState(false)
  const bitti = useRef(false)
  useEffect(() => {
    if (!open) return
    bitti.current = false
    setDegisiklik('')
    setDeneyim('')
    setSonuc(undefined)
    setUygula(false)
  }, [open])
  const kaydet = (g?: GunlukGirdi) => {
    if (bitti.current) return
    bitti.current = true
    onKaydet(g)
  }
  const dolu = !!(degisiklik.trim() || deneyim.trim() || sonuc)
  return (
    <Sheet open={open} onClose={() => kaydet()} title="Pişirme Günlüğü">
      <div className="space-y-3" data-pisirme-notu>
        <label className="block">
          <span className={`block text-[13.5px] font-semibold mb-1 ${T_BASLIK}`}>Ne değiştirdim?</span>
          <input className="lz-input text-[15px]" placeholder="Örn. Sütü artırdım" value={degisiklik} maxLength={300} onChange={(e) => setDegisiklik(e.target.value)} data-alan="degisiklik" />
        </label>
        <label className="block">
          <span className={`block text-[13.5px] font-semibold mb-1 ${T_BASLIK}`}>Nasıl oldu? / Deneyimim</span>
          <textarea className="lz-input min-h-[72px] text-[15px]" placeholder="Örn. Daha yumuşak oldu" value={deneyim} maxLength={400} onChange={(e) => setDeneyim(e.target.value)} data-alan="deneyim" />
        </label>
        <div>
          <span className={`block text-[13.5px] font-semibold mb-1 ${T_BASLIK}`}>Sonuç</span>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SONUC_AD) as NonNullable<PisirmeKaydi['sonuc']>[]).map((k) => (
              <button key={k} className={`lz-chip justify-center !min-h-[44px] !px-2 ${sonuc === k ? 'lz-chip-on' : ''}`} onClick={() => setSonuc(sonuc === k ? undefined : k)} data-sonuc={k}>
                {SONUC_AD[k]}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
          <input type="checkbox" className="mt-1 w-5 h-5 flex-shrink-0" checked={uygula} onChange={(e) => setUygula(e.target.checked)} data-alan="uygula" />
          <span>
            <span className={`block text-[14px] font-semibold ${T_BASLIK}`}>Bu değişikliği tarife uygula</span>
            <span className={`block text-[12px] ${T_SOLUK}`}>İşaretliyse tarif güncellenir, değişen malzeme ve adımların sonunda ✎ olur. İşaretsizse yalnızca günlük notu kalır.</span>
          </span>
        </label>
        <button className="lz-btn-primary w-full" disabled={!dolu} onClick={() => kaydet({ degisiklik: degisiklik.trim() || undefined, deneyim: deneyim.trim() || undefined, sonuc, uygula: uygula && !!degisiklik.trim() })}>
          Günlüğe kaydet
        </button>
        <button className="lz-btn-soft w-full" onClick={() => kaydet()}>
          Not olmadan kaydet
        </button>
      </div>
    </Sheet>
  )
}
