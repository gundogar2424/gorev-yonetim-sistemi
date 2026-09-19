// Rehberli seans: egzersizler sirayla; her tekrar icin geri sayim, tutma
// suresi, dinlenme; sesli/titresimli isaretler. Uzun "A" egzersizinde
// mikrofonla olcum (ya da elle kronometre).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SesHeader from '../SesHeader'
import MptMeter, { type MptResult } from '../components/MptMeter'
import { findExercise, GROUP_LABEL, type Exercise } from '../lib/content'
import { activeExercises, addMpt, addSession, readSettings, repsFor, updateSession, type DoneExercise, type Session as SessionRec } from '../lib/store'
import Rating from '../components/Rating'
import VideoEmbed from '../components/VideoEmbed'
import FeedbackCard from '../components/FeedbackCard'
import { sfxDone, sfxGo, sfxRest, sfxTick } from '../lib/sound'
import { unlockAudio } from '../lib/audioCtx'
import { fmtMinutes } from '../lib/date'

type Phase = 'intro' | 'ready' | 'go' | 'rest' | 'mpt' | 'done'
const READY_SEC = 3

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
    if (ayar.countdown) {
      setPhase('ready')
      zamanla(READY_SEC)
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
        zamanla(ex.rest)
        sfxRest()
      } else {
        egzersizBitti({ id: ex.id, reps: n })
      }
      return
    }
    if (phase === 'rest') {
      setRep((r) => r + 1)
      setPhase('go')
      zamanla(ex.hold)
      sfxGo()
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
  const total = ex ? (phase === 'ready' ? READY_SEC : phase === 'go' ? ex.hold : ex.rest) : 1
  const pct = total > 0 ? Math.max(0, Math.min(100, (left / total) * 100)) : 0

  // ---------- BITIS ----------
  if (phase === 'done' || !ex) {
    const ms = Date.now() - startedAt.current.getTime()
    const best = done.reduce((m, d) => Math.max(m, d.mpt ?? 0), 0)
    return (
      <div className="flex-1 flex flex-col">
        <SesHeader title="Seans bitti" subtitle={done.length > 0 ? 'Aferin, düzenli olmak en önemlisi' : 'Bir dahaki sefere'} back={() => navigate('/')} />
        <div className="px-4 space-y-5 pb-8">
          <section className="ses-card text-center py-6">
            <div className="text-[60px]">{done.length > 0 ? '🎉' : '🙂'}</div>
            <div className="text-[26px] font-bold text-slate-900 dark:text-[#f5ece4] mt-1">{done.length} egzersiz</div>
            <div className="text-[17px] text-slate-700 dark:text-[#d8c8bf]">
              {fmtMinutes(ms)}
              {best > 0 ? ` · en uzun "A": ${best.toFixed(1).replace('.', ',')} sn` : ''}
            </div>
          </section>
          {done.length > 0 && (
            <section className="ses-card">
              <ul className="divide-y divide-slate-100 dark:divide-[#4a3a30]">
                {done.map((d, i) => {
                  const e = findExercise(d.id)
                  return (
                    <li key={i} className="py-2 flex items-center justify-between text-[17px]">
                      <span className="text-slate-800 dark:text-[#f5ece4]">
                        {e?.emoji} {e?.name ?? d.id}
                      </span>
                      <span className="text-slate-700 dark:text-[#d8c8bf]">{d.mpt ? `${d.mpt.toFixed(1).replace('.', ',')} sn` : `${d.reps} ×`}</span>
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
          <button className="ses-btn-primary w-full min-h-[68px] text-[21px]" onClick={() => navigate('/')}>
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
          {ex.video && (
            <section className="ses-card">
              <h3 className="ses-label mb-2">Başlamadan önce izle</h3>
              <VideoEmbed video={ex.video} />
            </section>
          )}
          <section className="ses-card">
            <div className="flex items-center gap-3">
              <span className="w-14 h-14 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[32px]">{ex.emoji}</span>
              <p className="text-[18px] text-slate-700 dark:text-[#d8c8bf]">{ex.short}</p>
            </div>
            <ol className="space-y-2 mt-4">
              {ex.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[17px] text-slate-700 dark:text-[#d8c8bf]">
                  <span className="w-7 h-7 rounded-full bg-ses-600 text-white grid place-items-center text-[15px] font-bold flex-shrink-0">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {ex.caution && <p className="mt-3 rounded-2xl bg-amber-50 dark:bg-[#2b2418] p-3 text-[16px] text-amber-800 dark:text-amber-200">⚠️ {ex.caution}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="ses-pill">{ex.mode === 'mpt' ? `${n} deneme` : ex.mode === 'sure' ? `${n} set × ${ex.hold} sn` : `${n} tekrar × ${ex.hold} sn`}</span>
              {ex.mode !== 'mpt' && <span className="ses-pill">ara: {ex.rest} sn</span>}
            </div>
          </section>
          <div className="mt-auto space-y-2">
            <button className="ses-btn-primary w-full min-h-[72px] text-[22px]" onClick={basla}>
              ▶ Başla
            </button>
            <button className="ses-btn-ghost w-full" onClick={atla}>
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
          {mptBest > 0 && <div className="text-center text-[17px] text-slate-700 dark:text-[#d8c8bf]">Bu seansta en iyi: {mptBest.toFixed(1).replace('.', ',')} sn</div>}
          <div className="mt-auto space-y-2">
            <button className="ses-btn-primary w-full min-h-[68px] text-[21px]" onClick={mptSonraki} disabled={!mptResult}>
              {mptAttempt < n ? 'Sonraki deneme ▶' : 'Devam ▶'}
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
        <div className={`flex-1 flex flex-col items-center justify-center rounded-3xl p-6 text-center transition-colors ${isGo ? 'bg-ses-600 text-white' : isReady ? 'bg-ses-50 dark:bg-[#352820]' : 'bg-white dark:bg-[#261d16]'}`}>
          <div className={`text-[16px] font-semibold uppercase tracking-[0.1em] ${isGo ? 'text-white/80' : 'text-ses-700 dark:text-ses-300'}`}>{baslik}</div>
          <div className={`font-bold leading-none tabular-nums my-4 ${isGo ? 'text-[96px] ses-pulse' : 'text-[84px] text-slate-900 dark:text-[#f5ece4]'}`}>{Math.ceil(left)}</div>
          <div className={`text-[32px] font-bold leading-tight ${isGo ? 'text-white' : 'text-slate-800 dark:text-[#f5ece4]'}`}>
            {isReady ? (ex.mode === 'sure' ? 'Nefes al…' : 'Nefes al…') : isGo ? cue : 'Gevşe, nefes al'}
          </div>
          {phase === 'rest' && <div className="text-[17px] text-slate-700 dark:text-[#d8c8bf] mt-2">Sonraki: {Array.isArray(ex.cue) ? ex.cue[(rep + 1) % ex.cue.length] : ex.cue}</div>}
          <div className={`w-full h-2.5 rounded-full mt-6 overflow-hidden ${isGo ? 'bg-white/25' : 'bg-slate-200 dark:bg-[#4a3a30]'}`}>
            <div className={`h-full rounded-full transition-[width] duration-100 ${isGo ? 'bg-[#ffffff]' : 'bg-ses-500'}`} style={{ width: `${pct}%` }} />
          </div>
          {/* tekrar noktalari */}
          <div className="flex flex-wrap justify-center gap-1.5 mt-4 max-w-[260px]">
            {Array.from({ length: n }).map((_, i) => (
              <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < rep || (i === rep && phase === 'rest') ? (isGo ? 'bg-[#ffffff]' : 'bg-ses-600') : i === rep ? (isGo ? 'bg-[#ffffff]/70' : 'bg-ses-300') : isGo ? 'bg-white/25' : 'bg-slate-200 dark:bg-[#4a3a30]'}`} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <button className="ses-btn-ghost px-2 whitespace-nowrap" onClick={duraklat}>
            {paused ? '▶ Devam' : '⏸ Dur'}
          </button>
          <button className="ses-btn-ghost px-2 whitespace-nowrap" onClick={ilerle}>
            ⏭ İleri
          </button>
          <button className="ses-btn-ghost px-2 whitespace-nowrap" onClick={atla}>
            Atla
          </button>
        </div>
      </div>
    </div>
  )
}
