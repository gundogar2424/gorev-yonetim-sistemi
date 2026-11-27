import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { dinlemeyiBaslat, sesleIlerleIzinli, type Komut } from '../lib/sesKomut'
import { mutfakModu, mutfakModuKaydet, sesiDurdur, sesliOku } from '../lib/ses'

// Pisirme ekranlarinin ortak parcalari: Mutfak Modu, sesli okuma, buyuk Sonraki dugmesi.
// renk: normal tarif = gri, Thermomix = koyu yesil, pilav pisirici = turuncu kahve
export type CihazRengi = 'normal' | 'tm' | 'pp'

// "Sesle ilerle" acik mi: ust cubuktaki dugme ile alttaki dinleyici ayni durumu paylasir (her pisirme acilisinda kapali)
let sesleAcik = false
const dinleyenler = new Set<() => void>()
function sesleAyarla(v: boolean) {
  sesleAcik = v
  dinleyenler.forEach((f) => f())
}
function useSesle(): boolean {
  return useSyncExternalStore(
    (f) => {
      dinleyenler.add(f)
      return () => dinleyenler.delete(f)
    },
    () => sesleAcik
  )
}
export const CIHAZ_RENK: Record<CihazRengi, { dolgu: string; yazi: string; ad: string }> = {
  normal: { dolgu: '#52525b', yazi: '#ffffff', ad: 'Normal' },
  tm: { dolgu: '#2E7D5B', yazi: '#ffffff', ad: 'Thermomix TM7' },
  pp: { dolgu: '#A0603F', yazi: '#ffffff', ad: 'Pilav Pişirici' }
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
  const sesle = useSesle()
  const sesleIzinli = sesleIlerleIzinli()
  // Her pisirme ekrani "Sesle ilerle" kapali acilir; ekrandan cikinca dinleme durur
  useEffect(() => {
    sesleAyarla(false)
    return () => sesleAyarla(false)
  }, [])
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
        {sesleIzinli && (
          <button
            onClick={() => sesleAyarla(!sesle)}
            aria-pressed={sesle}
            aria-label="Sesle ilerle"
            className={`min-h-[48px] px-2.5 rounded-xl text-[13px] font-semibold border ${sesle ? 'bg-white text-black border-white' : 'bg-white/15 text-white border-white/30'}`}
          >
            🎙 {sesle ? 'Açık' : 'Sesle'}
          </button>
        )}
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
  const sesle = useSesle()
  const [sesDurum, setSesDurum] = useState('')
  // Komutlar en guncel islevlere gitsin
  const son = useRef({ ileri, geri, geriKapali, ileriKapali, buAdim })
  son.current = { ileri, geri, geriKapali, ileriKapali, buAdim }
  const okurken = useRef(0) // telefon okurken duyulan kendi sesi komut sayilmaz
  useEffect(() => {
    if (!sesle) {
      setSesDurum('')
      return
    }
    let durdur: (() => void) | undefined
    let iptal = false
    setSesDurum('Dinliyor: “Sonraki”, “Geri”, “Tekrar”')
    const komut = (k: Komut) => {
      if (Date.now() < okurken.current) return
      const x = son.current
      setSesDurum(`Duydum: ${k === 'sonraki' ? 'Sonraki' : k === 'geri' ? 'Geri' : 'Tekrar'}`)
      if (k === 'sonraki' && !x.ileriKapali) {
        void sesiDurdur()
        x.ileri()
      } else if (k === 'geri' && !x.geriKapali) {
        void sesiDurdur()
        x.geri()
      } else if (k === 'tekrar' && x.buAdim) void oku(x.buAdim, 'bu')
    }
    dinlemeyiBaslat(komut)
      .then((f) => (iptal ? f() : (durdur = f)))
      .catch((e) => {
        setSesDurum(e instanceof Error ? e.message : 'Sesli komut başlatılamadı')
        sesleAyarla(false)
      })
    return () => {
      iptal = true
      durdur?.()
    }
  }, [sesle])
  const uzun = useRef(false)
  const zaman = useRef<number | undefined>(undefined)
  const oku = async (metin: string, ad: string) => {
    setOkuyor(ad)
    okurken.current = Date.now() + 60000
    try {
      await sesliOku(metin)
    } catch (e) {
      setOkuyor(e instanceof Error ? e.message : 'Sesli okuma çalışmadı')
      okurken.current = 0
      return
    }
    okurken.current = Date.now() + 600
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
      {/* Iki dugme: Geri ve Oku. Oku'ya dokununca bu adim, uzun basinca siradaki adim okunur */}
      <div className="grid grid-cols-2 gap-2">
        <button
          className="lz-btn-soft text-[15px] px-2"
          disabled={geriKapali}
          onClick={() => {
            void sesiDurdur()
            geri()
          }}
        >
          ‹ Geri
        </button>
        <button
          className="lz-btn-soft text-[15px] px-2 select-none [-webkit-touch-callout:none]"
          disabled={!buAdim && !sonrakiAdim}
          aria-label="Oku: dokun bu adımı, uzun bas sıradaki adımı okusun"
          onPointerDown={() => {
            uzun.current = false
            zaman.current = window.setTimeout(() => {
              uzun.current = true
              if (sonrakiAdim) void oku(sonrakiAdim, 'sonraki')
            }, 550)
          }}
          onPointerUp={() => window.clearTimeout(zaman.current)}
          onPointerLeave={() => window.clearTimeout(zaman.current)}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (uzun.current) return
            if (buAdim) void oku(buAdim, 'bu')
          }}
        >
          🔊 Oku
        </button>
      </div>
      <p className="text-[11.5px] text-center text-[#5f5f68] dark:text-[#a1a1aa]">🔊 Oku: dokun bu adım, uzun bas sıradaki adım</p>
      {sesDurum && <p className="text-[12.5px] text-center font-semibold text-emerald-700 dark:text-emerald-300">🎙 {sesDurum}</p>}
      {okuyor && okuyor !== 'bu' && okuyor !== 'sonraki' && <p className="text-[12.5px] text-center text-rose-600">{okuyor}</p>}
    </div>
  )
}
