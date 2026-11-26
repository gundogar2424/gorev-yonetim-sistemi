import { useState } from 'react'
import { mutfakModu, mutfakModuKaydet, sesiDurdur, sesliOku } from '../lib/ses'

// Pisirme ekranlarinin ortak parcalari: Mutfak Modu, sesli okuma, buyuk Sonraki dugmesi.
// renk: normal tarif = gri, Thermomix = koyu yesil, pilav pisirici = turuncu kahve
export type CihazRengi = 'normal' | 'tm' | 'pp'
export const CIHAZ_RENK: Record<CihazRengi, { dolgu: string; yazi: string; ad: string }> = {
  normal: { dolgu: '#52525b', yazi: '#ffffff', ad: 'Normal' },
  tm: { dolgu: '#2E7D5B', yazi: '#ffffff', ad: 'Thermomix TM7' },
  pp: { dolgu: '#B06A4F', yazi: '#ffffff', ad: 'Pilav Pişirici' }
}

export function useMutfakModu(): [boolean, () => void] {
  const [acik, setAcik] = useState(mutfakModu())
  return [
    acik,
    () => {
      mutfakModuKaydet(!acik)
      setAcik(!acik)
    }
  ]
}

export function MutfakDugmesi({ acik, degistir }: { acik: boolean; degistir: () => void }) {
  return (
    <button
      onClick={degistir}
      aria-pressed={acik}
      className={`min-h-[48px] px-3 rounded-xl text-[13px] font-semibold border ${
        acik ? 'bg-white text-black border-white' : 'bg-white/15 text-white border-white/30'
      }`}
    >
      {acik ? 'Mutfak modu açık' : 'Mutfak modu'}
    </button>
  )
}

// Ust cubuk: secili cihazin renginde
export function PisirmeUstCubuk({
  renk,
  baslik,
  alt,
  ilerleme,
  kapat,
  mutfak,
  mutfakDegistir
}: {
  renk: CihazRengi
  baslik: string
  alt: string
  ilerleme: number
  kapat: () => void
  mutfak: boolean
  mutfakDegistir: () => void
}) {
  const c = CIHAZ_RENK[renk]
  return (
    <div style={{ background: c.dolgu, color: c.yazi, paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }} className="px-4 pb-3">
      <div className="flex items-center gap-3">
        <button onClick={kapat} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center text-xl" aria-label="Kapat">
          ✕
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{baslik}</div>
          <div className="text-[12.5px] opacity-85">{alt}</div>
        </div>
        <MutfakDugmesi acik={mutfak} degistir={mutfakDegistir} />
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-white/25 overflow-hidden">
        <div className="h-full bg-white transition-all" style={{ width: `${Math.max(0, Math.min(1, ilerleme)) * 100}%` }} />
      </div>
    </div>
  )
}

// Alt dugmeler: Sonraki tam genislik ve 64 px; altinda Geri ve sesli okuma
export function PisirmeAlti({
  renk,
  ileriEtiket,
  ileri,
  ileriKapali,
  geri,
  geriKapali,
  buAdim,
  sonrakiAdim
}: {
  renk: CihazRengi
  ileriEtiket: string
  ileri: () => void
  ileriKapali?: boolean
  geri: () => void
  geriKapali?: boolean
  buAdim: string
  sonrakiAdim: string
}) {
  const [okuyor, setOkuyor] = useState('')
  const oku = async (metin: string, ad: string) => {
    setOkuyor(ad)
    try {
      await sesliOku(metin)
    } catch (e) {
      setOkuyor(e instanceof Error ? e.message : 'Sesli okuma çalışmadı')
      return
    }
    setOkuyor('')
  }
  return (
    <div className="px-4 pt-2 space-y-2.5" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <button
        className="mutfak-sonraki w-full min-h-[64px] rounded-2xl text-[19px] font-bold text-white active:scale-[0.98] transition disabled:opacity-45"
        style={{ background: renk === 'normal' ? '#d93d20' : CIHAZ_RENK[renk].dolgu }}
        disabled={ileriKapali}
        onClick={() => {
          void sesiDurdur()
          ileri()
        }}
      >
        {ileriEtiket}
      </button>
      <div className="grid grid-cols-3 gap-2">
        <button
          className="lz-btn-soft text-[14px] px-2"
          disabled={geriKapali}
          onClick={() => {
            void sesiDurdur()
            geri()
          }}
        >
          ‹ Geri
        </button>
        <button className="lz-btn-soft text-[13.5px] px-2" disabled={!buAdim} onClick={() => void oku(buAdim, 'bu')}>
          🔊 Bu adımı oku
        </button>
        <button className="lz-btn-soft text-[13.5px] px-2" disabled={!sonrakiAdim} onClick={() => void oku(sonrakiAdim, 'sonraki')}>
          🔊 Sıradaki adımı oku
        </button>
      </div>
      {okuyor && okuyor !== 'bu' && okuyor !== 'sonraki' && <p className="text-[12.5px] text-center text-rose-600">{okuyor}</p>}
    </div>
  )
}
