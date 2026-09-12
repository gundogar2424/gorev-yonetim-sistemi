import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import EftHeader from '../EftHeader'
import { customIssue, foodIssue, HUNGER_ISSUES, ISSUES, issueById, phraseFor, POINTS, QUICK_FOODS, type Issue } from '../lib/content'
import { readRecentFoods, readSettings, rememberCustomIssue, rememberFood, saveSettings } from '../lib/store'

// KAYAN YAZI (teleprompter): EFT metni ekranda surekli yukari kayar.
// Telefon karsiya konur, okunur, vurulur. Hiz ve yazi boyutu ayarlanir,
// dokununca durur/devam eder, sona gelince basa doner. Ses gerekmez.

interface Line {
  kind: 'baslik' | 'cumle' | 'nokta' | 'ara'
  text: string
  sub?: string
}

const ROUNDS = 3 // kurulum + 3 tur (3. tur olumlu), sonra basa

function buildScript(issue: Issue): Line[] {
  const L: Line[] = []
  L.push({ kind: 'baslik', text: 'Kurulum', sub: 'Karate noktasına vur, 3 kez söyle' })
  for (let i = 1; i <= 3; i++) L.push({ kind: 'cumle', text: issue.setup, sub: `${i} / 3` })
  for (let r = 1; r <= ROUNDS; r++) {
    const positive = r === ROUNDS
    L.push({ kind: 'baslik', text: `Tur ${r}`, sub: positive ? 'Olumlu tur' : r === 1 ? 'Her noktaya yaklaşık 7 vuruş' : 'Kalan duyguyla' })
    POINTS.forEach((p, i) => L.push({ kind: 'nokta', text: phraseFor(issue, r, i, positive), sub: `${i + 1} · ${p.name}` }))
    L.push({ kind: 'ara', text: 'Derin bir nefes al… ve ver.', sub: positive ? 'Şimdi yeniden puanla' : 'Duyguyu yeniden hisset' })
  }
  L.push({ kind: 'ara', text: '· · ·', sub: 'Baştan başlıyor' })
  return L
}

const SPEEDS = [12, 18, 25, 35, 48, 65, 90] // piksel/sn
const FONTS = [22, 26, 30, 36, 42]

export default function Flow() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ayar = useMemo(() => readSettings(), [])
  const [issue, setIssue] = useState<Issue | null>(() => {
    const k = params.get('konu')
    const y = params.get('yemek')
    const o = params.get('ozel')
    if (y && y.trim()) return foodIssue(y)
    if (o && o.trim()) return customIssue(o)
    return k ? (issueById(k) ?? null) : null
  })
  const [ozel, setOzel] = useState('')
  const [yemek, setYemek] = useState('')
  const viewRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)

  // Sayfa acikken adres degisirse (baska konuyla yeniden acilma) konuyu guncelle
  useEffect(() => {
    const k = params.get('konu')
    const y = params.get('yemek')
    const o = params.get('ozel')
    const next = y && y.trim() ? foodIssue(y) : o && o.trim() ? customIssue(o) : k ? (issueById(k) ?? null) : null
    if (next) {
      setIssue(next)
      offsetRef.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  const [speedIx, setSpeedIx] = useState(() => Math.max(0, Math.min(SPEEDS.length - 1, ayar.flowSpeed)))
  const [fontIx, setFontIx] = useState(() => Math.max(0, Math.min(FONTS.length - 1, ayar.flowFont)))
  const [running, setRunning] = useState(true)

  const lines = useMemo(() => (issue ? buildScript(issue) : []), [issue])

  // Ekran acik kalsin
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => {
      void lock?.release().catch(() => {})
    }
  }, [])

  // Kaydirma motoru: requestAnimationFrame ile piksel/sn cinsinden akis.
  // Icerik iki kez arka arkaya cizilir; ilk kopya bitince sessizce basa doner.
  useEffect(() => {
    if (!issue) return
    let raf = 0
    let last = performance.now()
    const speed = SPEEDS[speedIx]
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (running) {
        const track = trackRef.current
        if (track) {
          const half = track.scrollHeight / 2
          offsetRef.current += speed * dt
          if (half > 0 && offsetRef.current >= half) offsetRef.current -= half
          track.style.transform = `translateY(${-offsetRef.current}px)`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [issue, running, speedIx])

  function basaDon() {
    offsetRef.current = 0
    if (trackRef.current) trackRef.current.style.transform = 'translateY(0px)'
  }

  function hiz(d: number) {
    const ix = Math.max(0, Math.min(SPEEDS.length - 1, speedIx + d))
    setSpeedIx(ix)
    saveSettings({ flowSpeed: ix })
  }

  function yazi(d: number) {
    const ix = Math.max(0, Math.min(FONTS.length - 1, fontIx + d))
    setFontIx(ix)
    saveSettings({ flowFont: ix })
  }

  // ---------------- KONU SECIMI ----------------
  if (!issue) {
    const sonYemek = readRecentFoods()
    const yemekCipleri = [...sonYemek, ...QUICK_FOODS.filter((q) => !sonYemek.some((s) => s.toLocaleLowerCase('tr') === q))].slice(0, 8)
    return (
      <div>
        <EftHeader title="Kayan yazı" subtitle="Konu seç; metin ekranda aksın, sen oku ve vur" back={() => navigate('/')} />
        <div className="px-4 space-y-4 pb-6">
          <section className="eft-card">
            <h3 className="eft-label mb-2">Kendi konun</h3>
            <input className="eft-input" placeholder="örn. yarınki sınav" value={ozel} onChange={(e) => setOzel(e.target.value.slice(0, 60))} />
            <button
              className="eft-btn-primary w-full mt-2"
              disabled={!ozel.trim()}
              onClick={() => {
                rememberCustomIssue(ozel)
                setIssue(customIssue(ozel))
              }}
            >
              Başlat
            </button>
          </section>
          <section className="eft-card bg-amber-50/60 dark:bg-[#2b2a1a]">
            <h3 className="eft-label mb-2">🍽️ Yemek isteği</h3>
            <input className="eft-input" placeholder="örn. çikolata" value={yemek} onChange={(e) => setYemek(e.target.value.slice(0, 40))} />
            <div className="flex flex-wrap gap-2 mt-2">
              {yemekCipleri.map((f) => (
                <button
                  key={f}
                  className="eft-pill min-h-[36px] px-3 text-[14px]"
                  onClick={() => {
                    rememberFood(f)
                    setIssue(foodIssue(f))
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              className="eft-btn-primary w-full mt-2"
              disabled={!yemek.trim()}
              onClick={() => {
                rememberFood(yemek)
                setIssue(foodIssue(yemek))
              }}
            >
              Başlat
            </button>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {HUNGER_ISSUES.map((h) => (
                <button key={h.id} onClick={() => setIssue(h)} className="flex items-center gap-2 rounded-2xl bg-white dark:bg-[#1e3231] p-2.5 text-left active:scale-[0.98]">
                  <span className="text-[20px]">{h.emoji}</span>
                  <span className="text-[13px] font-semibold text-slate-800 dark:text-[#e8f2f1] leading-tight">{h.name}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="eft-card">
            <h3 className="eft-label mb-2">Hazır konular</h3>
            <ul className="space-y-2">
              {ISSUES.map((i) => (
                <li key={i.id}>
                  <button onClick={() => setIssue(i)} className="w-full flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-[#1e3231] p-3 text-left active:scale-[0.98]">
                    <span className="text-[24px]">{i.emoji}</span>
                    <span className="text-[16px] font-semibold text-slate-900 dark:text-[#e8f2f1]">{i.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    )
  }

  // ---------------- KAYAN YAZI ----------------
  const font = FONTS[fontIx]
  const renderLines = (copy: number) =>
    lines.map((l, i) => {
      const key = `${copy}-${i}`
      if (l.kind === 'baslik')
        return (
          <div key={key} className="pt-10 pb-3">
            <div className="eft-label !text-eft-600 dark:!text-eft-300 text-[15px]">{l.text}</div>
            {l.sub && <div className="text-[15px] text-slate-500 dark:text-[#7f9896]">{l.sub}</div>}
          </div>
        )
      if (l.kind === 'ara')
        return (
          <div key={key} className="py-6 text-center">
            <div className="font-semibold text-slate-700 dark:text-[#d5e6e4]" style={{ fontSize: font * 0.85 }}>
              {l.text}
            </div>
            {l.sub && <div className="text-[15px] text-slate-500 dark:text-[#7f9896]">{l.sub}</div>}
          </div>
        )
      return (
        <div key={key} className="py-4 border-b border-slate-100 dark:border-[#2b4442]">
          {l.sub && <div className="text-[14px] font-semibold text-eft-700 dark:text-eft-300 mb-1">{l.sub}</div>}
          <div className={`font-bold leading-snug text-slate-900 dark:text-[#e8f2f1] ${l.kind === 'cumle' ? '' : ''}`} style={{ fontSize: l.kind === 'cumle' ? font * 0.9 : font }}>
            {l.kind === 'nokta' ? `“${l.text}”` : l.text}
          </div>
        </div>
      )
    })

  // Sayfa ekran yuksekligine SABIT: kayan icerik binlerce piksel uzundur;
  // kapsayici onunla buyurse solma katmanlari ve okuma bandi kayar.
  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <EftHeader
        title={issue.name}
        subtitle={`Kayan yazı · ${running ? 'akıyor' : 'duraklatıldı'} · hız ${speedIx + 1}/${SPEEDS.length}`}
        back={() => navigate(-1)}
        compact
        right={
          <button onClick={() => setIssue(null)} className="min-h-[44px] px-3 rounded-full bg-white dark:bg-[#1e3231] text-[14px] font-semibold text-slate-700 dark:text-[#d5e6e4] shadow-card dark:shadow-none">
            Konu
          </button>
        }
      />

      <div
        ref={viewRef}
        className="relative flex-1 min-h-0 overflow-hidden px-5 select-none"
        onClick={() => setRunning((r) => !r)}
        role="button"
        aria-label={running ? 'Duraklat' : 'Devam et'}
      >
        {/* okuma bandi: ortadaki satir vurgulu gorunsun */}
        <div className="pointer-events-none absolute inset-x-0 top-[38%] h-[24%] bg-eft-50/50 dark:bg-[#1e3231]/50 border-y border-eft-100 dark:border-[#2b4442]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-[#f2f8f7] dark:from-[#0f1a1a] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-[#f2f8f7] dark:from-[#0f1a1a] to-transparent z-10" />
        <div ref={trackRef} className="will-change-transform pt-[40vh]">
          {renderLines(0)}
          {renderLines(1)}
        </div>
        {!running && (
          <div className="absolute inset-0 grid place-items-center z-20 pointer-events-none">
            <div className="rounded-full bg-slate-900/70 text-white px-5 py-3 text-[17px] font-semibold">Duraklatıldı · dokun</div>
          </div>
        )}
      </div>

      {/* kontroller */}
      <div
        className="flex-shrink-0 bg-white/90 dark:bg-[#0f1a1a]/90 border-t border-slate-200/60 dark:border-[#2b4442] px-4 pt-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 mb-2">
          <button className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#1e3231] text-[22px] font-bold active:scale-95" onClick={() => hiz(-1)} aria-label="Yavaşlat">
            −
          </button>
          <div>
            <div className="flex justify-between text-[12px] text-slate-500 dark:text-[#7f9896] mb-1">
              <span>Hız</span>
              <span>{['çok yavaş', 'yavaş', 'sakin', 'orta', 'hızlı', 'daha hızlı', 'çok hızlı'][speedIx]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={SPEEDS.length - 1}
              value={speedIx}
              onChange={(e) => {
                const ix = Number(e.target.value)
                setSpeedIx(ix)
                saveSettings({ flowSpeed: ix })
              }}
              className="w-full h-3"
              aria-label="Kayma hızı"
            />
          </div>
          <button className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#1e3231] text-[22px] font-bold active:scale-95" onClick={() => hiz(1)} aria-label="Hızlandır">
            +
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button className="eft-btn-ghost min-h-[48px] text-[15px]" onClick={() => yazi(-1)} aria-label="Yazıyı küçült">
            A−
          </button>
          <button className="eft-btn-ghost min-h-[48px] text-[15px]" onClick={() => yazi(1)} aria-label="Yazıyı büyüt">
            A+
          </button>
          <button className="eft-btn-ghost min-h-[48px] text-[15px]" onClick={basaDon}>
            Başa
          </button>
          <button className={`${running ? 'eft-btn-soft' : 'eft-btn-primary'} min-h-[48px] text-[15px]`} onClick={() => setRunning((r) => !r)}>
            {running ? 'Duraklat' : 'Devam'}
          </button>
        </div>
      </div>
    </div>
  )
}
