import { useEffect, useRef, useState } from 'react'
import { Sheet, T_SOLUK } from './ui'

// "NASIL OLDU?" penceresi: Pisirdim ya da Afiyet olsun! sonrasi. Not istege bagli;
// pencere kapatilirsa notsuz kaydedilir. onKaydet yalnizca bir kez cagrilir.
export function PisirmeNotu({ open, onKaydet }: { open: boolean; onKaydet: (not?: string) => void }) {
  const [not, setNot] = useState('')
  const bitti = useRef(false)
  useEffect(() => {
    if (open) {
      bitti.current = false
      setNot('')
    }
  }, [open])
  const kaydet = (n?: string) => {
    if (bitti.current) return
    bitti.current = true
    onKaydet(n?.trim() || undefined)
  }
  return (
    <Sheet open={open} onClose={() => kaydet()} title="Nasıl oldu?">
      <div className="space-y-3" data-pisirme-notu>
        <textarea
          className="lz-input min-h-[88px] text-[15px] w-full"
          placeholder="İstersen not yaz: örn. Bir dahakine sütü azalt"
          value={not}
          onChange={(e) => setNot(e.target.value)}
          maxLength={300}
        />
        <p className={`text-[12px] ${T_SOLUK}`}>Not zorunlu değil. Pişirme tarihi her durumda Pişirme Geçmişi’ne yazılır.</p>
        <button className="lz-btn-primary w-full" disabled={!not.trim()} onClick={() => kaydet(not)}>
          Notla kaydet
        </button>
        <button className="lz-btn-soft w-full" onClick={() => kaydet()}>
          Not olmadan kaydet
        </button>
      </div>
    </Sheet>
  )
}
