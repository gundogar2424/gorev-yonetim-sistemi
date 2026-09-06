import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import TmHeader from '../TmHeader'
import { getRecipe, markCooked, readTmSettings } from '../db'
import { durationLabel, modeLabel, speedLabel, tempLabel } from '../lib/tm7'

// Sure bitince kisa bir uyari sesi (dosya gerekmez; ses tarayicida uretilir).
function beep(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.95)
    setTimeout(() => void ctx.close(), 1200)
  } catch {
    /* ses calinamadi — onemli degil */
  }
}

// Ekran kilidi (Wake Lock). Desteklemeyen tarayicida sessizce atlanir.
type WakeSentinel = { release: () => Promise<void> }

export default function Cook() {
  const { id } = useParams()
  const rid = Number(id)
  const navigate = useNavigate()
  const recipe = useLiveQuery(() => getRecipe(rid), [rid], undefined)
  const settings = useLiveQuery(() => readTmSettings(), [], undefined)

  const [i, setI] = useState(0)
  const [kalan, setKalan] = useState(0)
  const [calisiyor, setCalisiyor] = useState(false)
  const [bitti, setBitti] = useState(false)
  const wakeRef = useRef<WakeSentinel | null>(null)

  const steps = recipe?.steps ?? []
  const step = steps[i]

  // Adim degisince sayaci o adimin suresine kur
  useEffect(() => {
    setKalan(step?.seconds ?? 0)
    setCalisiyor(false)
    setBitti(false)
  }, [i, step?.seconds])

  // Geri sayim
  useEffect(() => {
    if (!calisiyor) return
    const t = setInterval(() => {
      setKalan((k) => {
        if (k <= 1) {
          clearInterval(t)
          setCalisiyor(false)
          setBitti(true)
          return 0
        }
        return k - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [calisiyor])

  // Sure dolunca: ses + titresim, istenmisse sonraki adima gec
  useEffect(() => {
    if (!bitti) return
    if (settings?.sound !== false) {
      beep()
      try {
        navigator.vibrate?.([200, 100, 200])
      } catch {
        /* titresim yok */
      }
    }
    if (settings?.autoAdvance !== false && i < steps.length - 1) {
      const t = setTimeout(() => setI((v) => Math.min(v + 1, steps.length - 1)), 1200)
      return () => clearTimeout(t)
    }
  }, [bitti, settings?.sound, settings?.autoAdvance, i, steps.length])

  // Pisirirken ekran acik kalsin
  useEffect(() => {
    if (settings?.keepAwake === false) return
    let iptal = false
    const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<WakeSentinel> } }
    void nav.wakeLock
      ?.request('screen')
      .then((s) => {
        if (iptal) void s.release()
        else wakeRef.current = s
      })
      .catch(() => {
        /* desteklenmiyor */
      })
    return () => {
      iptal = true
      void wakeRef.current?.release().catch(() => {})
      wakeRef.current = null
    }
  }, [settings?.keepAwake])

  const bitir = useCallback(async () => {
    await markCooked(rid)
    navigate(`/tarif/${rid}`)
  }, [rid, navigate])

  if (!recipe) {
    return (
      <div>
        <TmHeader title="Pişirme" back />
        <div className="px-4 py-6 text-center text-slate-400 text-sm">Tarif bulunamadı.</div>
      </div>
    )
  }
  if (!step) {
    return (
      <div>
        <TmHeader title={recipe.title} back />
        <div className="px-4 py-6 text-center text-slate-400 text-sm">Bu tarifte adım yok.</div>
      </div>
    )
  }

  const sonAdim = i === steps.length - 1

  return (
    <div>
      <TmHeader title={recipe.title} subtitle={`Adım ${i + 1} / ${steps.length}`} back />

      <div className="px-4 py-3 space-y-3">
        {/* Ilerleme cubugu */}
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-[#252733] overflow-hidden">
          <div
            className="h-full bg-tm-600 transition-all"
            style={{ width: `${((i + (bitti ? 1 : 0)) / steps.length) * 100}%` }}
          />
        </div>

        {/* Adim metni */}
        <div className="card p-5">
          <p className="text-[22px] leading-snug font-semibold text-slate-800 dark:text-[#e0e1e6]">{step.text}</p>
          {step.ingredients && (
            <p className="mt-3 text-[15px] text-slate-600 dark:text-slate-300">
              <span className="font-semibold">Kaba gir:</span> {step.ingredients}
            </p>
          )}
          {step.tip && <p className="mt-3 text-[13px] text-amber-600">💡 {step.tip}</p>}
        </div>

        {/* Cihaz ayarlari — buyuk ve okunakli */}
        <div className="grid grid-cols-3 gap-2">
          <Kutu baslik="Süre" deger={step.seconds ? durationLabel(step.seconds) : '—'} />
          <Kutu baslik="Sıcaklık" deger={step.temp ? tempLabel(step.temp) : '—'} />
          <Kutu
            baslik="Devir"
            deger={step.speed ? speedLabel(step.speed).replace('Devir ', '') : '—'}
            alt={step.speed ? (step.reverse ? 'ters bıçak ↺' : 'düz bıçak') : ''}
          />
        </div>
        {step.mode && (
          <div className="card p-3 text-center text-sm font-semibold text-tm-600">Mod: {modeLabel(step.mode)}</div>
        )}

        {/* Sayac */}
        {step.seconds > 0 && (
          <div className="card p-5 text-center">
            <div
              className={`text-[52px] font-bold tabular-nums leading-none ${
                bitti ? 'text-emerald-500' : 'text-slate-900 dark:text-[#e0e1e6]'
              }`}
            >
              {String(Math.floor(kalan / 60)).padStart(2, '0')}:{String(kalan % 60).padStart(2, '0')}
            </div>
            <div className="mt-4 flex gap-2 justify-center">
              {!bitti && (
                <button onClick={() => setCalisiyor((v) => !v)} className="btn-tm px-6 py-2.5">
                  {calisiyor ? 'Duraklat' : kalan === step.seconds ? 'Başlat' : 'Devam et'}
                </button>
              )}
              <button
                onClick={() => {
                  setKalan(step.seconds)
                  setCalisiyor(false)
                  setBitti(false)
                }}
                className="btn-ghost px-4 py-2.5"
              >
                Sıfırla
              </button>
            </div>
            {bitti && <p className="mt-3 text-sm text-emerald-600 font-semibold">Süre doldu ✔</p>}
          </div>
        )}

        {/* Gezinme */}
        <div className="flex gap-2">
          <button onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} className="btn-ghost flex-1 py-3">
            ← Önceki
          </button>
          {sonAdim ? (
            <button onClick={bitir} className="btn-tm flex-1 py-3">
              Bitir ✔
            </button>
          ) : (
            <button onClick={() => setI((v) => Math.min(steps.length - 1, v + 1))} className="btn-tm flex-1 py-3">
              Sonraki →
            </button>
          )}
        </div>

        {/* Sonraki adimin onizlemesi — elini hazirlayabilesin diye */}
        {!sonAdim && (
          <div className="card p-3 text-[13px] text-slate-500">
            <span className="font-semibold">Sırada:</span> {steps[i + 1].text}
          </div>
        )}
      </div>
    </div>
  )
}

function Kutu({ baslik, deger, alt }: { baslik: string; deger: string; alt?: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="stat-label">{baslik}</div>
      <div className="stat-num text-[18px] mt-1 dark:text-[#e0e1e6]">{deger}</div>
      {alt && (
        <div className={`text-[11px] mt-0.5 ${alt.startsWith('ters') ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
          {alt}
        </div>
      )}
    </div>
  )
}
