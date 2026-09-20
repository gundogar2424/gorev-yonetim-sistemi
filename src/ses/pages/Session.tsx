// Rehberli seans: egzersizler sirayla; her tekrar icin geri sayim, tutma
// suresi, dinlenme; sesli/titresimli isaretler. Uzun "A" egzersizinde
// mikrofonla olcum (ya da elle kronometre).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SesHeader from '../SesHeader'
import MptMeter, { type MptResult } from '../components/MptMeter'
import { findExercise, GROUP_LABEL, type Exercise } from '../lib/content'
import { activeExercises, addMpt, addSession, readSettings, readySec, repsFor, restFor, updateSession, type DoneExercise, type Session as SessionRec } from '../lib/store'
import Rating from '../components/Rating'
import VideoTabs from '../components/VideoTabs'
import FeedbackCard from '../components/FeedbackCard'
import { sfxDone, sfxGo, sfxRest, sfxTick } from '../lib/sound'
import { unlockAudio } from '../lib/audioCtx'
import { fmtMinutes } from '../lib/date'
import Icon from '../components/Icon'

type Phase = 'intro' | 'ready' | 'go' | 'rest' | 'mpt' | 'done'

export default function Session() {
  const navigate = useNavigate()
  const loc = useLocation()
  const ayar = useMemo(() => readSettings(), [])
  const list = useMemo<Exercise[]>(() => {
    const tek = new URLSearchParams(loc.search).get('tek')
    if (tek) {
      const e = findExercise(tek)
      if (e) return [e]
    }
    return activeExercises(ayar)
  }, [loc.search, ayar])

  const [idx, setIdx] = useState(0)
  const [rep, setRep] = useState(0)
  const [phase, setPhase] = useState<Phase>('intro')
  const [left, setLeft] = useState(0) // kalan saniye (goruntu)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState<DoneExercise[]>([])
  const [mptBest, setMptBest] = useState(0)
  const [mptAttempt, setMptAttempt] = useState(1)
  const [mptResult, setMptResult] = useState<MptResult | null>(null)
  const [mptBestAc, setMptBestAc] = useState<MptResult['ac']>(undefined)
  const [note, setNote] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saved, setSaved] = useState<SessionRec | null>(null)
  const [rating, setRating] = useState<number | undefined>(undefined)
  const startedAt = useRef(new Date())
  const endAt = useRef(0)
  const pausedLeft = useRef(0)
  const lastTick = useRef(-1)

  const ex = list[idx]
  const n = ex ? repsFor(ex.reps, ayar) : 0
  const readyLen = readySec(ayar) // her tekrardan onceki 3-2-1
  const restLen = ex ? restFor(ex.rest, ayar) : 0 // tekrarlar arasi dinlenme

  // Ekran uyumasin (destekleyen cihazlarda)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock
      ?.request('screen')
      .then((l) => {
        lock = l
      })
      .catch(() => {})
    return () => {
      void lock?.release().catch(() => {})
    }
  }, [])

  // Sayac: ready / go / rest evrelerinde calisir
  useEffect(() => {
    if (!(phase === 'ready' || phase === 'go' || phase === 'rest') || paused) return
    const id = setInterval(() => {
      const kalan = (endAt.current - Date.now()) / 1000
      setLeft(Math.max(0, kalan))
      if (phase === 'ready') {
        const s = Math.ceil(kalan)
        if (s !== lastTick.current && s > 0) {
          lastTick.current = s
          sfxTick()
        }
      }
      if (kalan <= 0) ilerle()
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, idx, rep])

  function zamanla(sec: number) {
    endAt.current = Date.now() + sec * 1000
    setLeft(sec)
    lastTick.current = -1
  }

  function basla() {
    unlockAudio()
    if (!ex) return
    setRep(0)
    setMptAttempt(1)
    setMptBest(0)
    setMptBestAc(undefined)
    setMptResult(null)
    if (ex.mode === 'mpt') {
      setPhase('mpt')
      return
    }
    sonrakiTekrar()
  }

  // Bir tekrari baslat: geri sayim aciksa once "hazirlan" (nefes al) evresi
  function sonrakiTekrar() {
    if (!ex) return
    if (ayar.countdown) {
      setPhase('ready')
      zamanla(readyLen)
    } else {
      setPhase('go')
      zamanla(ex.hold)
      sfxGo()
    }
  }

  // Sayac bitince bir sonraki evre
  function ilerle() {
    if (!ex) return
    if (phase === 'ready') {
      setPhase('go')
      zamanla(ex.hold)
      sfxGo()
      return
    }
    if (phase === 'go') {
      if (rep + 1 < n) {
        setPhase('rest')
        zamanla(restLen)
        sfxRest()
      } else {
        egzersizBitti({ id: ex.id, reps: n })
      }
      return
    }
    if (phase === 'rest') {
      setRep((r) => r + 1)
      sonrakiTekrar()
    }
  }

  function egzersizBitti(d: DoneExercise) {
    const yeni = [...done, d]
    setDone(yeni)
    sfxDone()
    if (idx + 1 < list.length) {
      setIdx(idx + 1)
      setRep(0)
      setPhase('intro')
    } else {
      bitir(yeni)
    }
  }

  function atla() {
    if (idx + 1 < list.length) {
      setIdx(idx + 1)
      setRep(0)
      setPhase('intro')
      setPaused(false)
    } else {
      bitir(done)
    }
  }

  function bitir(yapilan: DoneExercise[]) {
    setPaused(false)
    setPhase('done')
    if (yapilan.length > 0 && !savedId) {
      const s = addSession({ ms: Date.now() - startedAt.current.getTime(), done: yapilan }, startedAt.current)
      setSavedId(s.id)
      setSaved(s)
    }
  }

  function duraklat() {
    if (paused) {
      endAt.current = Date.now() + pausedLeft.current * 1000
      setPaused(false)
    } else {
      pausedLeft.current = Math.max(0, (endAt.current - Date.now()) / 1000)
      setPaused(true)
    }
  }

  function mptSonuc(r: MptResult) {
    setMptResult(r)
    if (r.sec > mptBest) {
      setMptBest(r.sec)
      setMptBestAc(r.ac)
    }
    if (r.sec > 0) addMpt({ sec: r.sec, db: r.db, manual: r.manual, ac: r.ac })
  }

  function mptSonraki() {
    if (!ex) return
    if (mptAttempt < n) {
      setMptAttempt(mptAttempt + 1)
      setMptResult(null)
    } else {
      egzersizBitti({ id: ex.id, reps: mptAttempt, mpt: mptBest || undefined, ac: mptBestAc })
    }
  }

  const cue = ex ? (Array.isArray(ex.cue) ? ex.cue[rep % ex.cue.length] : ex.cue) : ''
  const total = ex ? (phase === 'ready' ? readyLen : phase === 'go' ? ex.hold : restLen) : 1
  const pct = total > 0 ? Math.max(0, Math.min(100, (left / total) * 100)) : 0

  // ---------- BITIS ----------
  if (phase === 'done' || !ex) {
    const ms = Date.now() - startedAt.current.getTime()
    const best = done.reduce((m, d) => Math.max(m, d.mpt ?? 0), 0)
    return (
      <div className="flex-1 flex flex-col">
        <SesHeader title="Seans bitti" subtitle={done.length > 0 ? 'Aferin, düzenli olmak en önemlisi' : 'Bir dahaki sefere'} back={() => navigate('/')} />
        <div className="px-4 space-y-5 pb-8">
          <section className="ses-card text-center py-7">
            <div className="inline-flex w-12 h-12 rounded-full bg-ses-50 dark:bg-sesui-dsoft text-ses-700 dark:text-ses-300 items-center justify-center">
              <Icon name={done.length > 0 ? 'check' : 'info'} size={24} strokeWidth={1.8} />
            </div>
            <div className="text-[28px] font-semibold tabular-nums text-sesui-text dark:text-sesui-dtext mt-3 leading-none">{done.length} egzersiz</div>
            <div className="text-[14px] text-sesui-muted dark:text-sesui-dmuted mt-1.5">
              {fmtMinutes(ms)}
              {best > 0 ? ` · en uzun "A": ${best.toFixed(1).replace('.', ',')} sn` : ''}
            </div>
          </section>
          {done.length > 0 && (
            <section className="ses-card">
              <ul className="divide-y divide-sesui-line dark:divide-sesui-dline">
                {done.map((d, i) => {
                  const e = findExercise(d.id)
                  return (
                    <li key={i} className="py-2.5 flex items-center justify-between gap-3 text-[15px]">
                      <span className="text-sesui-text dark:text-sesui-dtext min-w-0 truncate">{e?.name ?? d.id}</span>
                      <span className="text-[13px] tabular-nums text-sesui-muted dark:text-sesui-dmuted flex-shrink-0">{d.mpt ? `${d.mpt.toFixed(1).replace('.', ',')} sn` : `${d.reps} tekrar`}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          {savedId && (
            <section className="ses-card">
              <Rating
                value={rating}
                label="Bugün sesin nasıldı? (öz değerlendirme)"
                onChange={(v) => {
                  setRating(v)
                  updateSession(savedId, { rating: v })
                }}
              />
            </section>
          )}
          {savedId && (
            <section className="ses-card space-y-2">
              <h3 className="ses-label">Not (isteğe bağlı)</h3>
              <textarea
                className="ses-input min-h-[80px]"
                placeholder="Ses nasıldı? Zorlanan egzersiz var mıydı?"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value.slice(0, 300))
                  updateSession(savedId, { note: e.target.value.slice(0, 300) })
                }}
              />
            </section>
          )}
          {saved && <FeedbackCard session={{ ...saved, note, rating }} />}
          <button className="ses-btn-primary w-full" onClick={() => navigate('/')}>
            Ana sayfa
          </button>
        </div>
      </div>
    )
  }

  // ---------- GIRIS KARTI ----------
  if (phase === 'intro') {
    return (
      <div className="flex-1 flex flex-col">
        <SesHeader
          title={ex.name}
          subtitle={`${idx + 1} / ${list.length} · ${GROUP_LABEL[ex.group]}`}
          compact
          back={() => (done.length > 0 || idx > 0 ? bitir(done) : navigate(-1))}
        />
        <div className="px-4 space-y-5 pb-8 flex-1 flex flex-col">
          <VideoTabs id={ex.id} clip={ex.clip} title="Başlamadan önce izle" />
          <section className="ses-card">
            <p className="text-[15px] leading-relaxed text-sesui-body dark:text-sesui-dbody">{ex.short}</p>
            <ol className="mt-3">
              {ex.steps.map((s, i) => (
                <li key={i} className="ses-row flex gap-3 text-[15px] leading-relaxed text-sesui-body dark:text-sesui-dbody">
                  <span className="text-[12px] font-semibold tabular-nums text-sesui-muted dark:text-sesui-dmuted pt-1 w-4 flex-shrink-0">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {ex.caution && (
              <p className="ses-row flex gap-2.5 text-[14px] leading-relaxed text-amber-800 dark:text-amber-300">
                <Icon name="alert" size={16} className="mt-0.5" />
                <span>{ex.caution}</span>
              </p>
            )}
            <div className="ses-row flex flex-wrap gap-1.5">
              <span className="ses-pill">{ex.mode === 'mpt' ? `${n} deneme` : ex.mode === 'sure' ? `${n} set × ${ex.hold} sn` : `${n} tekrar × ${ex.hold} sn`}</span>
              {ex.mode !== 'mpt' && <span className="ses-pill">ara: {restLen} sn</span>}
              {ex.mode !== 'mpt' && ayar.countdown && <span className="ses-pill">her tekrar öncesi {readyLen} sn geri sayım</span>}
            </div>
          </section>
          <div className="mt-auto space-y-2 pt-2">
            <button className="ses-btn-primary w-full min-h-[54px] text-[17px]" onClick={basla}>
              <Icon name="play" size={16} />
              Başla
            </button>
            <button className="ses-btn-ghost w-full min-h-[44px] text-[14px]" onClick={atla}>
              Bu egzersizi atla
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- MPT ----------
  if (phase === 'mpt') {
    return (
      <div className="flex-1 flex flex-col">
        <SesHeader title={ex.name} subtitle={`${idx + 1} / ${list.length}`} compact back={() => bitir(done)} />
        <div className="px-4 space-y-4 pb-8 flex-1 flex flex-col">
          <section className="ses-card">
            <MptMeter key={mptAttempt} onResult={mptSonuc} attempt={mptAttempt} attempts={n} compact />
          </section>
          {mptBest > 0 && <div className="text-center text-[16px] text-sesui-body dark:text-sesui-dbody">Bu seansta en iyi: {mptBest.toFixed(1).replace('.', ',')} sn</div>}
          <div className="mt-auto space-y-2">
            <button className="ses-btn-primary w-full" onClick={mptSonraki} disabled={!mptResult}>
              {mptAttempt < n ? 'Sonraki deneme' : 'Devam'}
            </button>
            <button className="ses-btn-ghost w-full" onClick={atla}>
              Atla
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- TEKRAR / SURE ----------
  const isGo = phase === 'go'
  const isReady = phase === 'ready'
  const baslik = isReady ? 'Hazırlan' : isGo ? (ex.mode === 'sure' ? 'Sürdür' : 'ŞİMDİ') : 'Dinlen'
  return (
    <div className="flex-1 flex flex-col">
      <SesHeader title={ex.name} subtitle={`${idx + 1} / ${list.length} · ${ex.mode === 'sure' ? 'set' : 'tekrar'} ${rep + 1} / ${n}`} compact back={() => bitir(done)} />
      <div className="px-4 pb-8 flex-1 flex flex-col">
        <div className={`flex-1 flex flex-col items-center justify-center rounded-[14px] p-6 text-center transition-colors border ${isGo ? 'bg-ses-600 border-ses-600 text-white' : isReady ? 'bg-white dark:bg-sesui-dcard border-sesui-line dark:border-sesui-dline' : 'bg-sesui-soft dark:bg-sesui-dsoft border-transparent'}`}>
          <div className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${isGo ? 'text-white/70' : 'text-sesui-muted dark:text-sesui-dmuted'}`}>{baslik}</div>
          <div className={`font-semibold leading-none tabular-nums my-5 ${isGo ? 'text-[88px] ses-pulse' : 'text-[76px] text-sesui-text dark:text-sesui-dtext'}`}>{Math.ceil(left)}</div>
          <div className={`text-[24px] font-semibold leading-tight ${isGo ? 'text-white' : 'text-sesui-text dark:text-sesui-dtext'}`}>
            {isReady ? 'Nefes al…' : isGo ? cue : 'Gevşe, nefes al'}
          </div>
          {isReady && <div className="text-[14px] text-sesui-muted dark:text-sesui-dmuted mt-2">Sırada: {cue}</div>}
          {phase === 'rest' && (
            <div className="text-[14px] text-sesui-muted dark:text-sesui-dmuted mt-2">Sonraki: {Array.isArray(ex.cue) ? ex.cue[(rep + 1) % ex.cue.length] : ex.cue}</div>
          )}
          <div className={`w-full h-1.5 rounded-full mt-7 overflow-hidden ${isGo ? 'bg-white/25' : 'bg-sesui-line dark:bg-sesui-dline'}`}>
            <div className={`h-full rounded-full transition-[width] duration-100 ${isGo ? 'bg-[#ffffff]' : 'bg-ses-500'}`} style={{ width: `${pct}%` }} />
          </div>
          {/* tekrar noktalari */}
          <div className="flex flex-wrap justify-center gap-1 mt-5 max-w-[240px]">
            {Array.from({ length: n }).map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < rep || (i === rep && phase === 'rest') ? (isGo ? 'bg-[#ffffff]' : 'bg-ses-600') : i === rep ? (isGo ? 'bg-[#ffffff]/70' : 'bg-ses-300') : isGo ? 'bg-white/25' : 'bg-sesui-line dark:bg-sesui-dline'}`} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <button className="ses-btn-ghost px-2 min-h-[46px] text-[14px] whitespace-nowrap" onClick={duraklat}>
            <Icon name={paused ? 'play' : 'pause'} size={15} />
            {paused ? 'Devam' : 'Dur'}
          </button>
          <button className="ses-btn-ghost px-2 min-h-[46px] text-[14px] whitespace-nowrap" onClick={ilerle}>
            <Icon name="skip" size={15} />
            İleri
          </button>
          <button className="ses-btn-ghost px-2 min-h-[46px] text-[14px] whitespace-nowrap" onClick={atla}>
            Atla
          </button>
        </div>
      </div>
    </div>
  )
}
