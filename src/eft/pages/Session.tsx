import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import EftHeader from '../EftHeader'
import BodyMap from '../components/BodyMap'
import HandMap from '../components/HandMap'
import SudsPicker, { sudsColor } from '../components/SudsPicker'
import { customIssue, FOOD_KIND_LABEL, foodIssue, ISSUES, issueById, phraseFor, POINTS, QUICK_FOODS, type FoodKind, type Issue } from '../lib/content'
import { addSession, readCustomIssues, readRecentFoods, readSettings, rememberCustomIssue, rememberFood, TEMPO_MS, updateSession } from '../lib/store'
import { sfxDone, sfxPoint, sfxTick } from '../lib/sound'
import { fmtMinutes } from '../lib/date'

// Rehberli seans akisi:
//   konu -> puan -> kurulum (karate noktasi, 3 kez) -> vurus (8 nokta) -> nefes
//   -> yeniden puan -> [bir tur daha | olumlu tur | bitir] -> bitti
// Yemek istegi modunda konu -> telkin (uretilen ifadeler okunur) -> puan -> ...
type Phase = 'konu' | 'telkin' | 'puan' | 'kurulum' | 'vurus' | 'nefes' | 'yeniden' | 'bitti'

const SETUP_REPEATS = 3

export default function Session() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ayar = useMemo(() => readSettings(), [])
  const tempoMs = TEMPO_MS[ayar.tempo]
  const taps = ayar.taps

  const [phase, setPhase] = useState<Phase>('konu')
  const [issue, setIssue] = useState<Issue | null>(null)
  const [ozel, setOzel] = useState('')
  const [yemek, setYemek] = useState('')
  const [foodKindSel, setFoodKindSel] = useState<FoodKind>('genel')
  const [before, setBefore] = useState<number | null>(null)
  const [current, setCurrent] = useState<number | null>(null) // son turdan sonraki puan
  const [pick, setPick] = useState<number | null>(null) // secici gecici degeri
  const [round, setRound] = useState(1)
  const [positive, setPositive] = useState(false)
  const [setupText, setSetupText] = useState('')
  const [setupCount, setSetupCount] = useState(0)
  const [pos, setPos] = useState({ pi: 0, beat: 0 })
  const [running, setRunning] = useState(true)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const startRef = useRef<Date>(new Date())
  const finishMsRef = useRef(0)

  // URL'den hazir konu (ana sayfadaki hizli secim)
  useEffect(() => {
    const id = params.get('konu')
    const i = id ? issueById(id) : undefined
    if (i && phase === 'konu') basla(i)
    const y = params.get('yemek')
    if (y && y.trim() && phase === 'konu') yemekTelkin(y)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [phase])

  // Seans boyunca ekran acik kalsin (destekleyen cihazlarda)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => {
      void lock?.release().catch(() => {})
    }
  }, [])

  // Vurus motoru: kurulumda yalnizca animasyon; vurus asamasinda noktalar ilerler.
  useEffect(() => {
    const active = phase === 'kurulum' || (phase === 'vurus' && running)
    if (!active) return
    const id = setInterval(() => {
      sfxTick()
      setPos((p) => {
        if (phase === 'kurulum') return { pi: p.pi, beat: p.beat + 1 }
        const nb = p.beat + 1
        if (nb < taps) return { pi: p.pi, beat: nb }
        if (!ayar.auto) return { pi: p.pi, beat: 0 } // elle ilerleme: sayac doner
        if (p.pi + 1 >= POINTS.length) return { pi: p.pi, beat: nb } // tur bitti (asagida yakalanir)
        return { pi: p.pi + 1, beat: 0 }
      })
    }, tempoMs)
    return () => clearInterval(id)
  }, [phase, running, tempoMs, taps, ayar.auto])

  // Nokta degisince kisa ses; tur bitince nefes asamasina gec
  const lastPi = useRef(0)
  useEffect(() => {
    if (phase !== 'vurus') return
    if (pos.pi !== lastPi.current) {
      lastPi.current = pos.pi
      sfxPoint()
    }
    if (pos.pi === POINTS.length - 1 && pos.beat >= taps) turBitti()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, phase])

  function basla(i: Issue) {
    setIssue(i)
    setSetupText(i.setup)
    setBefore(null)
    setCurrent(null)
    setPick(null)
    setRound(1)
    setPositive(false)
    startRef.current = new Date()
    setPhase('puan')
  }

  function ozelBasla() {
    const x = ozel.trim()
    if (!x) return
    rememberCustomIssue(x)
    basla(customIssue(x))
  }

  // Yemek istegi: once o yemege ozel telkinler gosterilir, sonra seans.
  function yemekTelkin(text: string) {
    const x = text.trim()
    if (!x) return
    rememberFood(x)
    const fi = foodIssue(x)
    setYemek(x)
    setFoodKindSel(fi.kind)
    setIssue(fi)
    setSetupText(fi.setup)
    setPhase('telkin')
  }

  function puanVerildi() {
    if (pick === null) return
    setBefore(pick)
    setCurrent(pick)
    kurulumaGec()
  }

  function kurulumaGec() {
    setSetupCount(0)
    setPos({ pi: 0, beat: 0 })
    setPhase('kurulum')
  }

  function vurusaGec() {
    lastPi.current = 0
    setPos({ pi: 0, beat: 0 })
    setRunning(true)
    setPhase('vurus')
  }

  function turBitti() {
    sfxDone()
    setPhase('nefes')
  }

  function oncekiNokta() {
    setPos((p) => ({ pi: Math.max(0, p.pi - 1), beat: 0 }))
  }

  function sonrakiNokta() {
    if (pos.pi + 1 >= POINTS.length) {
      turBitti()
      return
    }
    setPos((p) => ({ pi: p.pi + 1, beat: 0 }))
  }

  function yenidenPuanlandi() {
    if (pick === null) return
    setCurrent(pick)
  }

  function birTurDaha(olumlu: boolean) {
    setRound((r) => r + 1)
    setPositive(olumlu)
    setPick(null)
    // Olumlu turda kurulum cumlesi tekrarlanmaz; dogrudan vuruslara gecilir.
    if (olumlu) vurusaGec()
    else {
      if (issue) setSetupText(issue.setup.replace('Her ne kadar', 'Her ne kadar hâlâ'))
      kurulumaGec()
    }
  }

  function bitir() {
    if (!issue || before === null || current === null) return
    const ms = Date.now() - startRef.current.getTime()
    finishMsRef.current = ms
    const s = addSession({ issueId: issue.id, issue: issue.name, before, after: current, rounds: round, ms }, startRef.current)
    setSavedId(s.id)
    sfxDone()
    setPhase('bitti')
  }

  function cik() {
    const ortada = phase !== 'konu' && phase !== 'bitti'
    if (ortada && !window.confirm('Seans yarım kalacak ve kaydedilmeyecek. Çıkılsın mı?')) return
    navigate('/')
  }

  const point = POINTS[pos.pi]
  const phrase = issue ? phraseFor(issue, round, pos.pi, positive) : ''

  // ---------------- KONU ----------------
  if (phase === 'konu') {
    const sonOzel = readCustomIssues()
    const sonYemek = readRecentFoods()
    const yemekCipleri = [...sonYemek, ...QUICK_FOODS.filter((q) => !sonYemek.some((s) => s.toLocaleLowerCase('tr') === q))].slice(0, 8)
    return (
      <div>
        <EftHeader title="Konu seç" subtitle="Şu an seni ne rahatsız ediyor?" back={cik} />
        <div className="px-4 space-y-4 pb-6">
          <section className="eft-card bg-amber-50/60 dark:bg-[#2b2a1a]">
            <h3 className="eft-label mb-1">🍽️ Canın bir şey mi çekiyor?</h3>
            <p className="text-[14px] text-slate-500 dark:text-[#7f9896] mb-2">Yemeği yaz, ona özel telkinleri göreyim; istersen vuruşlarla söndürelim.</p>
            <input
              className="eft-input"
              placeholder="örn. çikolata, cips, pizza…"
              value={yemek}
              onChange={(e) => setYemek(e.target.value.slice(0, 40))}
              onKeyDown={(e) => e.key === 'Enter' && yemekTelkin(yemek)}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {yemekCipleri.map((f) => (
                <button key={f} className="eft-pill min-h-[36px] px-3 text-[14px]" onClick={() => yemekTelkin(f)}>
                  {f}
                </button>
              ))}
            </div>
            <button className="eft-btn-primary w-full mt-3" disabled={!yemek.trim()} onClick={() => yemekTelkin(yemek)}>
              Telkinleri göster
            </button>
          </section>

          <section className="eft-card">
            <h3 className="eft-label mb-2">Kendi konunu yaz</h3>
            <input
              className="eft-input"
              placeholder="örn. yarınki sınav, dizimdeki ağrı…"
              value={ozel}
              onChange={(e) => setOzel(e.target.value.slice(0, 60))}
              onKeyDown={(e) => e.key === 'Enter' && ozelBasla()}
            />
            {sonOzel.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {sonOzel.map((s) => (
                  <button key={s} className="eft-pill min-h-[36px] px-3 text-[14px]" onClick={() => setOzel(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <button className="eft-btn-primary w-full mt-3" disabled={!ozel.trim()} onClick={ozelBasla}>
              Bu konuyla başla
            </button>
          </section>

          <section className="eft-card">
            <h3 className="eft-label mb-2">Hazır konular</h3>
            <ul className="space-y-2">
              {ISSUES.map((i) => (
                <li key={i.id}>
                  <button
                    onClick={() => basla(i)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-[#1e3231] p-3 text-left transition active:scale-[0.98]"
                  >
                    <span className="w-12 h-12 rounded-xl bg-white dark:bg-[#172625] grid place-items-center text-[26px] flex-shrink-0">{i.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[16px] font-semibold text-slate-900 dark:text-[#e8f2f1]">{i.name}</span>
                      <span className="block text-[13px] text-slate-500 dark:text-[#7f9896]">{i.hint}</span>
                    </span>
                    <span className="text-[24px] text-slate-300 dark:text-[#5f7a78]">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    )
  }

  if (!issue) return null

  // ---------------- TELKIN (yemek istegi) ----------------
  if (phase === 'telkin') {
    return (
      <div>
        <EftHeader
          title={issue.name}
          subtitle={`Telkinler · ${FOOD_KIND_LABEL[foodKindSel]}`}
          back={() => {
            setIssue(null)
            setPhase('konu')
          }}
          compact
        />
        <div className="px-4 space-y-4 pb-6">
          <section className="eft-card">
            <h3 className="eft-label mb-1">1 · Kurulum cümlesi</h3>
            <p className="text-[13px] text-slate-500 dark:text-[#7f9896] mb-2">Karate noktasına vururken 3 kez yüksek sesle</p>
            <p className="text-[18px] leading-snug font-semibold text-slate-900 dark:text-[#e8f2f1]">“{issue.setup}”</p>
          </section>

          <section className="eft-card">
            <h3 className="eft-label mb-1">2 · Hatırlatma ifadeleri</h3>
            <p className="text-[13px] text-slate-500 dark:text-[#7f9896] mb-2">Her noktada bir tanesi, sırayla</p>
            <ol className="space-y-1.5">
              {issue.reminders.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[16px] text-slate-800 dark:text-[#e8f2f1]">
                  <span className="w-6 h-6 flex-shrink-0 rounded-full bg-eft-50 dark:bg-[#1e3231] text-eft-700 dark:text-eft-300 grid place-items-center text-[12px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span>{POINTS[i] ? <span className="text-slate-400 dark:text-[#7f9896] text-[13px]">{POINTS[i].name}: </span> : null}“{r}”</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="eft-card bg-eft-50 dark:bg-[#1e3231]">
            <h3 className="eft-label mb-1">3 · Olumlu tur</h3>
            <p className="text-[13px] text-slate-500 dark:text-[#7f9896] mb-2">İstek 3'ün altına inince</p>
            <ul className="space-y-1.5">
              {issue.positives.map((r, i) => (
                <li key={i} className="text-[16px] text-eft-800 dark:text-eft-300">
                  ✨ “{r}”
                </li>
              ))}
            </ul>
          </section>

          <button className="eft-btn-primary w-full text-[19px] min-h-[62px]" onClick={() => basla(issue)}>
            Vuruşlarla seansa başla
          </button>
          <button
            className="eft-btn-ghost w-full"
            onClick={() => {
              setIssue(null)
              setPhase('konu')
            }}
          >
            Başka yemek
          </button>
        </div>
      </div>
    )
  }

  // ---------------- PUAN ----------------
  if (phase === 'puan') {
    return (
      <div>
        <EftHeader title={issue.name} subtitle="Adım 1 · Yoğunluk" back={cik} compact />
        <div className="px-4 space-y-4 pb-6">
          <section className="eft-card">
            <h2 className="text-[20px] font-bold text-slate-900 dark:text-[#e8f2f1] leading-snug">
              {issue.id === 'yemek' ? 'Şu an bu istek ne kadar şiddetli?' : 'Bu konuyu şimdi düşününce ne kadar rahatsız oluyorsun?'}
            </h2>
            <p className="text-[14px] text-slate-500 dark:text-[#7f9896] mt-1 mb-4">
              {issue.id === 'yemek'
                ? 'Yemeği gözünün önüne getir, kokusunu ve tadını düşün. Sonra bir sayı seç.'
                : 'Gözlerini kapatıp bir an hisset. Bedeninde nerede? Sonra bir sayı seç.'}
            </p>
            <SudsPicker value={pick} onChange={setPick} />
          </section>
          <button className="eft-btn-primary w-full text-[19px] min-h-[62px]" disabled={pick === null} onClick={puanVerildi}>
            Devam
          </button>
        </div>
      </div>
    )
  }

  // ---------------- KURULUM ----------------
  if (phase === 'kurulum') {
    const tamam = setupCount >= SETUP_REPEATS
    return (
      <div>
        <EftHeader title={issue.name} subtitle={`Tur ${round} · Kurulum cümlesi`} back={cik} compact />
        <div className="px-4 space-y-4 pb-6">
          <section className="eft-card text-center">
            <HandMap beat={pos.beat} className="w-44 h-44 mx-auto" />
            <div className="text-[16px] font-bold text-slate-900 dark:text-[#e8f2f1]">Karate noktasına vur</div>
            <p className="text-[14px] text-slate-500 dark:text-[#7f9896]">Elin dış kenarı, serçe parmağın altı. Vururken cümleyi {SETUP_REPEATS} kez yüksek sesle söyle.</p>
          </section>

          <section className="eft-card">
            <h3 className="eft-label mb-2">Kurulum cümlesi (istersen düzenle)</h3>
            <textarea
              className="eft-input text-[19px] leading-snug font-semibold min-h-[120px] resize-none"
              value={setupText}
              onChange={(e) => setSetupText(e.target.value.slice(0, 240))}
            />
            <div className="flex items-center justify-center gap-3 mt-4">
              {Array.from({ length: SETUP_REPEATS }, (_, i) => (
                <span key={i} className={`w-4 h-4 rounded-full transition ${i < setupCount ? 'bg-eft-600' : 'bg-slate-200 dark:bg-[#2b4442]'}`} />
              ))}
            </div>
            {!tamam ? (
              <button className="eft-btn-primary w-full mt-3 text-[19px] min-h-[62px]" onClick={() => setSetupCount((c) => c + 1)}>
                Söyledim ({setupCount + 1}/{SETUP_REPEATS})
              </button>
            ) : (
              <button className="eft-btn-primary w-full mt-3 text-[19px] min-h-[62px] eft-pop" onClick={vurusaGec}>
                Noktalara geç ›
              </button>
            )}
            {!tamam && (
              <button className="w-full mt-2 text-[14px] font-semibold text-slate-500 dark:text-[#7f9896] min-h-[40px]" onClick={vurusaGec}>
                Atla
              </button>
            )}
          </section>
        </div>
      </div>
    )
  }

  // ---------------- VURUS ----------------
  if (phase === 'vurus') {
    return (
      <div className="flex-1 flex flex-col">
        <EftHeader
          title={issue.name}
          subtitle={`Tur ${round}${positive ? ' · olumlu' : ''} · nokta ${pos.pi + 1}/${POINTS.length}`}
          back={cik}
          compact
          right={
            <button
              onClick={() => setRunning((r) => !r)}
              className="w-12 h-12 rounded-full bg-white dark:bg-[#1e3231] shadow-card dark:shadow-none grid place-items-center text-slate-700 dark:text-[#d5e6e4] active:scale-95"
              aria-label={running ? 'Duraklat' : 'Devam et'}
            >
              {running ? (
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          }
        />
        <div className="px-4 pb-6 flex-1 flex flex-col">
          {/* ilerleme */}
          <div className="flex gap-1 mb-3">
            {POINTS.map((p, i) => (
              <div key={p.id} className={`h-1.5 flex-1 rounded-full ${i < pos.pi ? 'bg-eft-600' : i === pos.pi ? 'bg-eft-300' : 'bg-slate-200 dark:bg-[#2b4442]'}`} />
            ))}
          </div>

          <section className="eft-card flex-1 flex flex-col items-center">
            <BodyMap active={point.id} beat={pos.beat} className="w-full max-w-[250px]" />
            <div className="text-[22px] font-bold text-slate-900 dark:text-[#e8f2f1] mt-1">{point.name}</div>
            <div className="text-[14px] text-slate-500 dark:text-[#7f9896] text-center">{point.where}</div>

            <div className="mt-4 w-full rounded-2xl bg-eft-50 dark:bg-[#1e3231] px-4 py-4 text-center eft-pop" key={`${round}-${pos.pi}`}>
              <div className="eft-label mb-1">{positive ? 'Söyle' : 'Söyle (hatırlatma)'}</div>
              <div className="text-[24px] leading-snug font-bold text-eft-800 dark:text-eft-300">“{phrase}”</div>
            </div>

            {/* vurus sayaci */}
            <div className="flex items-center justify-center gap-2 mt-4">
              {Array.from({ length: taps }, (_, i) => (
                <span
                  key={i}
                  className={`rounded-full transition-all ${i < pos.beat ? 'w-3.5 h-3.5 bg-eft-600' : 'w-2.5 h-2.5 bg-slate-200 dark:bg-[#2b4442]'}`}
                />
              ))}
            </div>
            {!running && <div className="mt-3 text-[14px] font-semibold text-amber-600">Duraklatıldı</div>}
          </section>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className="eft-btn-ghost" onClick={oncekiNokta} disabled={pos.pi === 0}>
              ‹ Önceki
            </button>
            <button className="eft-btn-soft" onClick={sonrakiNokta}>
              {pos.pi + 1 >= POINTS.length ? 'Turu bitir' : 'Sonraki ›'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------- NEFES ----------------
  if (phase === 'nefes') {
    return (
      <div className="flex-1 flex flex-col">
        <EftHeader title={issue.name} subtitle={`Tur ${round} tamamlandı`} back={cik} compact />
        <div className="px-4 pb-6 flex-1 flex flex-col">
          <section className="eft-card flex-1 flex flex-col items-center justify-center text-center">
            <div className="relative w-52 h-52 grid place-items-center">
              <div className="absolute inset-0 rounded-full bg-eft-100 dark:bg-[#1e3231] eft-breathe" />
              <div className="relative text-[18px] font-bold text-eft-800 dark:text-eft-300">Nefes al · ver</div>
            </div>
            <p className="mt-4 text-[17px] leading-relaxed text-slate-700 dark:text-[#d5e6e4] max-w-xs">
              Derin bir nefes al, yavaşça ver. Bir yudum su iç. Sonra konuyu tekrar düşün.
            </p>
          </section>
          <button
            className="eft-btn-primary w-full mt-3 text-[19px] min-h-[62px]"
            onClick={() => {
              setPick(null)
              setPhase('yeniden')
            }}
          >
            Yeniden puanla
          </button>
        </div>
      </div>
    )
  }

  // ---------------- YENIDEN PUAN ----------------
  if (phase === 'yeniden') {
    const secildi = pick !== null && current === pick && before !== null
    return (
      <div>
        <EftHeader title={issue.name} subtitle={`Tur ${round} sonrası`} back={cik} compact />
        <div className="px-4 space-y-4 pb-6">
          <section className="eft-card">
            <h2 className="text-[20px] font-bold text-slate-900 dark:text-[#e8f2f1] leading-snug">
              {issue.id === 'yemek' ? 'Şimdi istek ne kadar şiddetli?' : 'Şimdi ne kadar rahatsız oluyorsun?'}
            </h2>
            <p className="text-[14px] text-slate-500 dark:text-[#7f9896] mt-1 mb-4">Başlangıçta {before} demiştin.</p>
            <SudsPicker
              value={pick}
              onChange={(v) => {
                setPick(v)
                setCurrent(v)
              }}
            />
          </section>

          {secildi && before !== null && current !== null && (
            <section className="eft-card eft-pop">
              <div className="flex items-center justify-center gap-3 text-[34px] font-bold tabular-nums">
                <span style={{ color: sudsColor(before) }}>{before}</span>
                <span className="text-slate-300 dark:text-[#5f7a78] text-[26px]">→</span>
                <span style={{ color: sudsColor(current) }}>{current}</span>
              </div>
              <p className="text-center text-[15px] text-slate-600 dark:text-[#d5e6e4] mt-1">{yorum(before, current)}</p>
              <div className="space-y-2 mt-4">
                {current > 0 && (
                  <button className="eft-btn-soft w-full" onClick={() => birTurDaha(false)}>
                    Bir tur daha (kalan duyguyla)
                  </button>
                )}
                {current <= 3 && !positive && (
                  <button className="eft-btn-soft w-full" onClick={() => birTurDaha(true)}>
                    ✨ Olumlu tur yap
                  </button>
                )}
                <button className="eft-btn-primary w-full text-[19px] min-h-[62px]" onClick={bitir}>
                  Bitir ve kaydet
                </button>
              </div>
            </section>
          )}
          {!secildi && (
            <button className="eft-btn-primary w-full text-[19px] min-h-[62px]" disabled={pick === null} onClick={yenidenPuanlandi}>
              Devam
            </button>
          )}
        </div>
      </div>
    )
  }

  // ---------------- BITTI ----------------
  const b = before ?? 0
  const c = current ?? 0
  return (
    <div>
      <EftHeader title="Seans tamam" subtitle={issue.name} compact />
      <div className="px-4 space-y-4 pb-6">
        <section className="eft-card text-center eft-pop">
          <div className="text-[44px]">{c <= 2 ? '🌿' : c < b ? '🙂' : '🤍'}</div>
          <div className="flex items-center justify-center gap-3 text-[40px] font-bold tabular-nums mt-1">
            <span style={{ color: sudsColor(b) }}>{b}</span>
            <span className="text-slate-300 dark:text-[#5f7a78] text-[28px]">→</span>
            <span style={{ color: sudsColor(c) }}>{c}</span>
          </div>
          <p className="text-[16px] text-slate-700 dark:text-[#d5e6e4] mt-1">{yorum(b, c)}</p>
          <p className="text-[13px] text-slate-500 dark:text-[#7f9896] mt-2">
            {round} tur · {fmtMinutes(finishMsRef.current)}
          </p>
        </section>

        <section className="eft-card">
          <h3 className="eft-label mb-2">Not (isteğe bağlı)</h3>
          <textarea
            className="eft-input min-h-[90px] resize-none text-[16px]"
            placeholder="Ne fark ettin? Bedeninde ne değişti? Altından başka bir duygu çıktı mı?"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            onBlur={() => savedId && updateSession(savedId, { note: note.trim() || undefined })}
          />
        </section>

        <button
          className="eft-btn-primary w-full text-[19px] min-h-[62px]"
          onClick={() => {
            if (savedId) updateSession(savedId, { note: note.trim() || undefined })
            navigate('/')
          }}
        >
          Ana sayfa
        </button>
        <button
          className="eft-btn-ghost w-full"
          onClick={() => {
            if (savedId) updateSession(savedId, { note: note.trim() || undefined })
            setNote('')
            setSavedId(null)
            basla(issue)
          }}
        >
          Aynı konuyla yeni seans
        </button>
      </div>
    </div>
  )
}

function yorum(before: number, after: number): string {
  const fark = before - after
  if (after === 0) return 'Rahatsızlık tamamen geçti. Harika iş.'
  if (fark >= 4) return 'Belirgin bir rahatlama var. Kalanı için bir tur daha yapabilirsin.'
  if (fark >= 2) return 'İyi bir düşüş. Devam etmeye değer.'
  if (fark > 0) return 'Küçük bir hafifleme. Konuyu daha da somutlaştırıp bir tur daha dene.'
  if (fark === 0) return 'Değişmedi. Konu belki daha özel bir şey; ifadeyi bedende hissettiğin yere göre değiştirmeyi dene.'
  return 'Yoğunluk arttı; bu bazen bastırılmış bir duygunun yüzeye çıkmasıdır. Nefes al, gerekirse ara ver.'
}
