import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import TmHeader from '../TmHeader'
import { getRecipe, markCooked, readTmSettings } from '../db'
import { durationLabel, modeLabel, speedLabel, tempLabel } from '../lib/tm7'
import StepVisual from '../components/StepVisual'
import { alarmIptal, alarmKur } from '../lib/alarm'

// Sure bitince kisa bir uyari sesi (dosya gerekmez; ses tarayicida uretilir).
function beep(kez = 3): void {
  for (let n = 0; n < kez; n++) setTimeout(() => tekBip(), n * 700)
}

function tekBip(): void {
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

  // Sayac calisirken isletim sistemine alarm kur: ekran kapali olsa da calsin.
  // Duraklatinca / adim degisince / ekrandan cikinca iptal edilir.
  useEffect(() => {
    if (!calisiyor || !step || settings?.notify === false) return
    const sirada = steps[i + 1]?.text
    void alarmKur(
      kalan,
      `${recipe?.title ?? 'Tarif'} — süre doldu`,
      sirada ? `Sıradaki adım: ${sirada}` : 'Son adım bitti.'
    )
    return () => {
      void alarmIptal()
    }
    // kalan her saniye degisiyor; alarm YALNIZCA baslat/duraklat/adim
    // degisiminde yeniden kurulmali, o yuzden bagimliliklarda kalan yok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calisiyor, i, settings?.notify])

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
        navigator.vibrate?.([300, 150, 300, 150, 500])
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

  // Ekrandan cikilinca bekleyen alarm kalmasin
  useEffect(() => {
    return () => {
      void alarmIptal()
    }
  }, [])

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

        {/* Kapta ne oluyor: bicak yonu/hizi, isitma, buhar */}
        <StepVisual step={step} running={calisiyor} />

        {/* Adim metni */}
        <div key={i} className="tm-card p-5 tm-step-in">
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
          <div className="tm-card p-3 text-center text-sm font-semibold text-tm-600">Mod: {modeLabel(step.mode)}</div>
        )}

        {/* Sayac: kalan sure hem rakamla hem dolan halkayla */}
        {step.seconds > 0 && (
          <div className="tm-card p-4 text-center">
            <div className="relative mx-auto w-[146px] h-[146px]">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="54" fill="none" strokeWidth="8" className="stroke-slate-100 dark:stroke-[#1c2622]" />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className={bitti ? 'stroke-tm-500' : 'stroke-tm-600'}
                  strokeDasharray={2 * Math.PI * 54}
                  strokeDashoffset={2 * Math.PI * 54 * (1 - kalan / Math.max(1, step.seconds))}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div
                className={`absolute inset-0 flex items-center justify-center text-[38px] font-bold tabular-nums tracking-tight ${
                  bitti ? 'text-tm-500' : 'text-slate-900 dark:text-[#e7ece9]'
                }`}
              >
                {String(Math.floor(kalan / 60)).padStart(2, '0')}:{String(kalan % 60).padStart(2, '0')}
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-center">
              {!bitti && (
                <button onClick={() => setCalisiyor((v) => !v)} className="tm-btn-primary px-6 py-2.5">
                  {calisiyor ? 'Duraklat' : kalan === step.seconds ? 'Başlat' : 'Devam et'}
                </button>
              )}
              <button
                onClick={() => {
                  setKalan(step.seconds)
                  setCalisiyor(false)
                  setBitti(false)
                  void alarmIptal()
                }}
                className="tm-btn-soft px-4 py-2.5"
              >
                Sıfırla
              </button>
            </div>
            {bitti && <p className="mt-3 text-sm text-emerald-600 font-semibold">Süre doldu ✔</p>}
          </div>
        )}

        {/* Gezinme */}
        <div className="flex gap-2">
          <button onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} className="tm-btn-soft flex-1 py-3">
            ← Önceki
          </button>
          {sonAdim ? (
            <button onClick={bitir} className="tm-btn-primary flex-1 py-3">
              Bitir ✔
            </button>
          ) : (
            <button onClick={() => setI((v) => Math.min(steps.length - 1, v + 1))} className="tm-btn-primary flex-1 py-3">
              Sonraki →
            </button>
          )}
        </div>

        {/* Takilirsan videoyu buradan da acabil */}
        {recipe.video && (
          <a
            href={recipe.video}
            target="_blank"
            rel="noreferrer noopener"
            className="tm-btn-soft w-full py-2.5 text-[13px]"
          >
            🎬 Videoyu aç
          </a>
        )}

        {/* Sonraki adimin onizlemesi — elini hazirlayabilesin diye */}
        {!sonAdim && (
          <div className="tm-card p-3 text-[13px] text-slate-500">
            <span className="font-semibold">Sırada:</span> {steps[i + 1].text}
          </div>
        )}
      </div>
    </div>
  )
}

function Kutu({ baslik, deger, alt }: { baslik: string; deger: string; alt?: string }) {
  return (
    <div className="tm-card p-3 text-center">
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
