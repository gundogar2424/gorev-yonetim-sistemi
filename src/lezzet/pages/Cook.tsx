import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb, markCooked } from '../db'
import { Icon, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'

// PISIRME MODU: adimlar tek tek, buyuk yazi. Ekran acik kalir. Adimda
// "10 dakika" gibi bir sure geciyorsa tek dokunusla geri sayim baslatilir.
export default function Cook() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const r = useLiveQuery(() => lzDb.recipes.get(id), [id])
  const [i, setI] = useState(-1) // -1 = malzeme kontrolu
  const [kalan, setKalan] = useState(0)
  const [sayac, setSayac] = useState(false)
  const bitti = useRef(false)

  // Ekran uyumasin (destekleyen cihazlarda)
  useEffect(() => {
    let kilit: { release: () => Promise<void> } | null = null
    const al = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
        if (wl) kilit = await wl.request('screen')
      } catch {
        /* desteklenmiyor */
      }
    }
    void al()
    const gorunur = () => document.visibilityState === 'visible' && void al()
    document.addEventListener('visibilitychange', gorunur)
    return () => {
      document.removeEventListener('visibilitychange', gorunur)
      void kilit?.release().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!sayac) return
    const t = window.setInterval(() => {
      setKalan((k) => {
        if (k <= 1) {
          setSayac(false)
          uyar()
          return 0
        }
        return k - 1
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [sayac])

  if (!r) return null
  const adimlar = r.steps
  const son = i === adimlar.length - 1
  const adim = i >= 0 ? adimlar[i] : ''
  const sure = adim.match(/(\d+)\s*(?:-\s*\d+\s*)?(dakika|dk|saat|sa\b|saniye|sn)/i)
  const sureSn = sure ? Number(sure[1]) * (/^sa/i.test(sure[2]) ? 3600 : /^s(an|n)/i.test(sure[2]) ? 1 : 60) : 0

  const ileri = async () => {
    if (son) {
      if (!bitti.current) {
        bitti.current = true
        await markCooked(r.id!)
      }
      navigate(-1)
      return
    }
    setI(i + 1)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#221d1a] flex items-center justify-center text-[#5a4a3f] dark:text-[#d9cec5]"
          aria-label="Kapat"
        >
          <Icon name="x" />
        </button>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold truncate ${T_BASLIK}`}>{r.title}</div>
          <div className={`text-[12px] ${T_SOLUK}`}>{i < 0 ? 'Hazırlık' : `Adım ${i + 1} / ${adimlar.length}`}</div>
        </div>
      </div>

      <div className="px-4">
        <div className="h-1.5 rounded-full bg-[#f3ebe2] dark:bg-[#2a2420] overflow-hidden">
          <div className="h-full bg-lz-600 transition-all" style={{ width: `${((i + 1) / Math.max(1, adimlar.length)) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 px-5 py-6 overflow-y-auto">
        {i < 0 ? (
          <div>
            <h2 className={`text-2xl font-bold mb-3 ${T_BASLIK}`}>Malzemeleri hazırla</h2>
            <ul className="space-y-2">
              {r.ingredients.map((m, k) => (
                <li key={k} className={`text-[19px] leading-snug flex gap-2 ${T_GOVDE}`}>
                  <span className="text-lz-500">•</span> {m}
                </li>
              ))}
            </ul>
            {adimlar.length === 0 && <p className={`mt-6 ${T_SOLUK}`}>Bu tarifte adım yazılmamış.</p>}
          </div>
        ) : (
          <div>
            <div className="text-lz-600 font-bold text-lg mb-2">{i + 1}.</div>
            <p className={`text-[24px] leading-[1.45] font-medium ${T_BASLIK}`}>{adim}</p>
            {sureSn > 0 && (
              <div className="mt-6 lz-card p-4 flex items-center gap-4">
                <div className={`text-3xl font-bold tabular-nums flex-1 ${T_BASLIK}`}>{saat(kalan || sureSn)}</div>
                {sayac ? (
                  <button className="lz-btn-soft" onClick={() => setSayac(false)}>
                    Durdur
                  </button>
                ) : (
                  <button
                    className="lz-btn-primary"
                    onClick={() => {
                      setKalan(kalan || sureSn)
                      setSayac(true)
                    }}
                  >
                    <Icon name="clock" className="w-4 h-4" /> Sayacı başlat
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-6 grid grid-cols-2 gap-3" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        <button
          className="lz-btn-soft py-4"
          disabled={i < 0}
          onClick={() => {
            setSayac(false)
            setKalan(0)
            setI(i - 1)
          }}
        >
          ‹ Geri
        </button>
        <button
          className="lz-btn-primary py-4"
          disabled={adimlar.length === 0 && i >= 0}
          onClick={() => {
            setSayac(false)
            setKalan(0)
            void ileri()
          }}
        >
          {i < 0 ? 'Başla ›' : son ? 'Afiyet olsun! ✓' : 'Sonraki ›'}
        </button>
      </div>
    </div>
  )
}

function saat(sn: number): string {
  const s = Math.floor(sn / 3600)
  const d = Math.floor((sn % 3600) / 60)
  const k = sn % 60
  return s ? `${s}:${String(d).padStart(2, '0')}:${String(k).padStart(2, '0')}` : `${d}:${String(k).padStart(2, '0')}`
}

// Sure dolunca kisa bip + titresim
function uyar() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300])
  } catch {
    /* yok */
  }
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    for (let n = 0; n < 3; n++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      o.connect(g)
      g.connect(ctx.destination)
      const t = ctx.currentTime + n * 0.45
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      o.start(t)
      o.stop(t + 0.36)
    }
    window.setTimeout(() => void ctx.close(), 2000)
  } catch {
    /* ses yok */
  }
}
