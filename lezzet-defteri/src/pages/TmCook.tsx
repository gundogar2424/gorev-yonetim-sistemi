import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb, markCooked } from '../db'
import { Icon, T_BASLIK, T_SOLUK } from '../components/ui'
import { adimKutulari, cihazAdimi, modAdi, tmSurumDenetle } from '../lib/tm7'

// TM7 PISIRME MODU: her adimda cihaz ayarlari (sure / sicaklik / devir / yon)
// buyuk kutucuklarda; sureli adimda tek dokunusla geri sayim. Ekran uyumaz.
export default function TmCook() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const r = useLiveQuery(() => lzDb.recipes.get(id), [id])
  const [i, setI] = useState(0)
  const [kalan, setKalan] = useState(0)
  const [sayac, setSayac] = useState(false)

  useEffect(() => {
    let kilit: { release: () => Promise<void> } | null = null
    const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
    wl?.request('screen').then((k) => (kilit = k)).catch(() => {})
    return () => void kilit?.release().catch(() => {})
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

  if (!r?.tm) return null
  const adimlar = tmSurumDenetle(r.tm).steps
  const a = adimlar[i]
  const son = i === adimlar.length - 1
  const sonraki = adimlar[i + 1]

  const git = async (n: number) => {
    setSayac(false)
    setKalan(0)
    if (n >= adimlar.length) {
      await markCooked(r.id!)
      navigate(-1)
      return
    }
    setI(Math.max(0, n))
  }

  const kutular = adimKutulari(a).map(([ad, deger]) => ({ ad, deger }))

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#1c1c1f] flex items-center justify-center text-[#3f3f46] dark:text-[#d4d4d8]"
          aria-label="Kapat"
        >
          <Icon name="x" />
        </button>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold truncate ${T_BASLIK}`}>{r.title}</div>
          <div className={`text-[12px] ${T_SOLUK}`}>
            TM7 · Adım {i + 1} / {adimlar.length}
          </div>
        </div>
      </div>
      <div className="px-4">
        <div className="h-1.5 rounded-full bg-[#f1f1ef] dark:bg-[#26262a] overflow-hidden">
          <div className="h-full bg-lz-600 transition-all" style={{ width: `${((i + 1) / adimlar.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 px-5 py-5 overflow-y-auto space-y-4">
        {a.ingredients && (
          <div className="lz-card p-3.5">
            <div className="lz-label mb-1">Kaba ekle</div>
            <div className={`text-[19px] font-semibold ${T_BASLIK}`}>{a.ingredients}</div>
          </div>
        )}
        <p className={`text-[23px] leading-[1.45] font-medium ${T_BASLIK}`}>{a.text}</p>
        {!cihazAdimi(a) && <div className={`lz-pill text-[13px] ${T_SOLUK}`}>Cihaz dışı adım</div>}
        {a.mode && <div className="lz-pill text-[14px] !bg-lz-600 !text-white">{modAdi(a.mode)}</div>}
        {kutular.length > 0 && (
          <div className={`grid gap-2 ${kutular.length >= 4 ? 'grid-cols-4' : kutular.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {kutular.map((k) => (
              <div key={k.ad} className="lz-card p-2.5 text-center">
                <div className={`text-[11px] ${T_SOLUK}`}>{k.ad}</div>
                <div className={`text-[16px] font-bold leading-tight mt-0.5 break-words ${T_BASLIK}`}>{k.deger}</div>
              </div>
            ))}
          </div>
        )}
        {a.tip && <p className={`text-[14px] rounded-2xl bg-amber-50 dark:bg-[#2a2113] text-amber-900 dark:text-amber-200 p-3`}>{a.tip}</p>}
        {a.seconds > 0 && (
          <div className="lz-card p-4 flex items-center gap-4">
            <div className={`text-3xl font-bold tabular-nums flex-1 ${T_BASLIK}`}>{sayacYaz(kalan || a.seconds)}</div>
            {sayac ? (
              <button className="lz-btn-soft" onClick={() => setSayac(false)}>
                Durdur
              </button>
            ) : (
              <button
                className="lz-btn-primary"
                onClick={() => {
                  setKalan(kalan || a.seconds)
                  setSayac(true)
                }}
              >
                <Icon name="clock" className="w-4 h-4" /> Sayaç
              </button>
            )}
          </div>
        )}
      </div>

      {sonraki && (
        <p className={`px-5 pb-2 text-[12.5px] truncate ${T_SOLUK}`}>
          Sıradaki: {sonraki.ingredients ? `${sonraki.ingredients} → ` : ''}
          {sonraki.text}
        </p>
      )}
      <div className="px-4 grid grid-cols-2 gap-3" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        <button className="lz-btn-soft py-4" disabled={i === 0} onClick={() => void git(i - 1)}>
          ‹ Geri
        </button>
        <button className="lz-btn-primary py-4" onClick={() => void git(i + 1)}>
          {son ? 'Afiyet olsun! ✓' : 'Sonraki ›'}
        </button>
      </div>
    </div>
  )
}

function sayacYaz(sn: number): string {
  const d = Math.floor(sn / 60)
  const k = sn % 60
  return `${d}:${String(k).padStart(2, '0')}`
}

function uyar() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300])
  } catch {
    /* yok */
  }
  try {
    const ctx = new AudioContext()
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
