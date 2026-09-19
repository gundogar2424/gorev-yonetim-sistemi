// Diksiyon seansi: her egzersiz icin once aciklama, sonra satirlar tek tek
// buyuk yaziyla; her satir icin sure cubugu (tempoya gore). Isteyen mikrofon
// duzey cubugunu acar (sesini yeterince duyuruyor mu?).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SesHeader from '../SesHeader'
import { DGROUP_LABEL, findDExercise, type DExercise } from '../lib/diksiyon'
import { activeDExercises, addSession, dSecFor, readSettings, updateSession, type DoneExercise } from '../lib/store'
import { sfxDone, sfxGo, sfxRest } from '../lib/sound'
import { unlockAudio } from '../lib/audioCtx'
import { createMic, type Mic } from '../lib/mic'
import { fmtMinutes } from '../lib/date'

type Phase = 'intro' | 'oku' | 'done'

export default function DiksiyonSession() {
  const navigate = useNavigate()
  const loc = useLocation()
  const ayar = useMemo(() => readSettings(), [])
  const list = useMemo<DExercise[]>(() => {
    const tek = new URLSearchParams(loc.search).get('tek')
    if (tek) {
      const e = findDExercise(tek)
      if (e) return [e]
    }
    return activeDExercises(ayar)
  }, [loc.search, ayar])

  const [idx, setIdx] = useState(0)
  const [rep, setRep] = useState(0)
  const [phase, setPhase] = useState<Phase>('intro')
  const [left, setLeft] = useState(0)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState<DoneExercise[]>([])
  const [note, setNote] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [micOn, setMicOn] = useState(false)
  const [level, setLevel] = useState(-90)
  const micRef = useRef<Mic | null>(null)
  const startedAt = useRef(new Date())
  const endAt = useRef(0)
  const pausedLeft = useRef(0)

  const ex = list[idx]
  const n = ex ? ex.reps : 0
  const sec = ex ? dSecFor(ex.sec, ayar) : 0

  // Ekran uyumasin
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
      micRef.current?.stop()
    }
  }, [])

  // Satir sayaci
  useEffect(() => {
    if (phase !== 'oku' || paused) return
    const id = setInterval(() => {
      const kalan = (endAt.current - Date.now()) / 1000
      setLeft(Math.max(0, kalan))
      if (kalan <= 0) ilerle()
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, idx, rep])

  function zamanla(s: number) {
    endAt.current = Date.now() + s * 1000
    setLeft(s)
  }

  function basla() {
    unlockAudio()
    if (!ex) return
    setRep(0)
    setPhase('oku')
    zamanla(sec)
    sfxGo()
  }

  function ilerle() {
    if (!ex) return
    if (rep + 1 < n) {
      setRep(rep + 1)
      zamanla(sec)
      sfxRest()
    } else {
      egzersizBitti({ id: ex.id, reps: n })
    }
  }

  function geri() {
    if (rep > 0) {
      setRep(rep - 1)
      zamanla(sec)
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
    } else bitir(yeni)
  }

  function atla() {
    setPaused(false)
    if (idx + 1 < list.length) {
      setIdx(idx + 1)
      setRep(0)
      setPhase('intro')
    } else bitir(done)
  }

  function bitir(yapilan: DoneExercise[]) {
    setPaused(false)
    setPhase('done')
    micRef.current?.stop()
    setMicOn(false)
    if (yapilan.length > 0 && !savedId) {
      const s = addSession({ ms: Date.now() - startedAt.current.getTime(), done: yapilan, kind: 'diksiyon' }, startedAt.current)
      setSavedId(s.id)
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

  async function micToggle() {
    if (micOn) {
      micRef.current?.stop()
      setMicOn(false)
      return
    }
    if (!micRef.current) micRef.current = createMic()
    const m = micRef.current
    m.onFrame((f) => setLevel(f.db))
    await m.start()
    setMicOn(m.status === 'acik')
  }

  const pct = sec > 0 ? Math.max(0, Math.min(100, (left / sec) * 100)) : 0
  const lvl = Math.max(0, Math.min(100, ((level + 70) / 70) * 100))

  // ---------- BITIS ----------
  if (phase === 'done' || !ex) {
    const ms = Date.now() - startedAt.current.getTime()
    return (
      <div className="flex-1 flex flex-col">
        <SesHeader title="Seans bitti" subtitle={done.length > 0 ? 'Aferin, her gün birkaç dakika yeter' : 'Bir dahaki sefere'} back={() => navigate('/diksiyon')} />
        <div className="px-4 space-y-4 pb-8">
          <section className="ses-card text-center py-6">
            <div className="text-[56px]">{done.length > 0 ? '🎉' : '🙂'}</div>
            <div className="text-[24px] font-bold text-slate-900 dark:text-[#f5ece4] mt-1">{done.length} egzersiz</div>
            <div className="text-[15px] text-slate-500 dark:text-[#a3908a]">{fmtMinutes(ms)} · diksiyon</div>
          </section>
          {done.length > 0 && (
            <section className="ses-card">
              <ul className="divide-y divide-slate-100 dark:divide-[#4a3a30]">
                {done.map((d, i) => {
                  const e = findDExercise(d.id)
                  return (
                    <li key={i} className="py-2 flex items-center justify-between text-[15px]">
                      <span className="text-slate-800 dark:text-[#f5ece4]">
                        {e?.emoji} {e?.name ?? d.id}
                      </span>
                      <span className="text-slate-500 dark:text-[#a3908a]">{d.reps} ×</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          {savedId && (
            <section className="ses-card space-y-2">
              <h3 className="ses-label">Not (isteğe bağlı)</h3>
              <textarea
                className="ses-input min-h-[80px]"
                placeholder="Hangi ses zor geldi? Neresi netleşti?"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value.slice(0, 300))
                  updateSession(savedId, { note: e.target.value.slice(0, 300) })
                }}
              />
            </section>
          )}
          <button className="ses-btn-primary w-full min-h-[62px] text-[19px]" onClick={() => navigate('/diksiyon')}>
            Diksiyon sayfası
          </button>
        </div>
      </div>
    )
  }

  // ---------- GIRIS ----------
  if (phase === 'intro') {
    return (
      <div className="flex-1 flex flex-col">
        <SesHeader title={ex.name} subtitle={`${idx + 1} / ${list.length} · ${DGROUP_LABEL[ex.group]}`} compact back={() => (done.length > 0 || idx > 0 ? bitir(done) : navigate(-1))} />
        <div className="px-4 space-y-4 pb-8 flex-1 flex flex-col">
          <section className="ses-card ses-pop">
            <div className="flex items-center gap-3">
              <span className="w-14 h-14 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[30px]">{ex.emoji}</span>
              <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">{ex.short}</p>
            </div>
            <p className="text-[14px] text-slate-600 dark:text-[#d8c8bf] mt-3">
              <b>Neden:</b> {ex.why}
            </p>
            <ol className="space-y-2 mt-3">
              {ex.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px] text-slate-700 dark:text-[#d8c8bf]">
                  <span className="w-7 h-7 rounded-full bg-ses-600 text-white grid place-items-center text-[13px] font-bold flex-shrink-0">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {ex.tip && <p className="mt-3 rounded-2xl bg-amber-50 dark:bg-[#2b2418] p-3 text-[14px] text-amber-800 dark:text-amber-200">⚠️ {ex.tip}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="ses-pill">
                {n} satır × {sec} sn
              </span>
            </div>
          </section>
          <div className="mt-auto space-y-2">
            <button className="ses-btn-primary w-full min-h-[66px] text-[20px]" onClick={basla}>
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

  // ---------- OKUMA ----------
  const satir = ex.lines[rep % ex.lines.length]
  const uzun = satir.length > 80
  return (
    <div className="flex-1 flex flex-col">
      <SesHeader title={ex.name} subtitle={`${idx + 1} / ${list.length} · satır ${rep + 1} / ${n}`} compact back={() => bitir(done)} />
      <div className="px-4 pb-8 flex-1 flex flex-col">
        <div className="flex-1 flex flex-col rounded-3xl p-5 bg-white dark:bg-[#261d16]">
          <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ses-700 dark:text-ses-300 text-center">{paused ? 'Duraklatıldı' : 'Oku / söyle'}</div>
          <div className={`flex-1 flex items-center justify-center text-center font-bold leading-snug text-slate-900 dark:text-[#f5ece4] py-4 ${uzun ? 'text-[20px]' : 'text-[30px]'}`}>{satir}</div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 rounded-full bg-slate-200 dark:bg-[#4a3a30] overflow-hidden">
              <div className="h-full rounded-full bg-ses-500 transition-[width] duration-100" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[18px] font-bold tabular-nums text-slate-700 dark:text-[#f5ece4] w-8 text-right">{Math.ceil(left)}</span>
          </div>
          {micOn && (
            <div className="mt-3">
              <div className="text-[12px] text-slate-500 dark:text-[#a3908a] mb-1">Ses düzeyi</div>
              <div className="h-3 rounded-full bg-slate-200 dark:bg-[#4a3a30] overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-75" style={{ width: `${lvl}%` }} />
              </div>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-1.5 mt-4">
            {Array.from({ length: n }).map((_, i) => (
              <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < rep ? 'bg-ses-600' : i === rep ? 'bg-ses-300' : 'bg-slate-200 dark:bg-[#4a3a30]'}`} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3">
          <button className="ses-btn-ghost px-2" onClick={geri} disabled={rep === 0}>
            ◀
          </button>
          <button className="ses-btn-ghost px-2" onClick={duraklat}>
            {paused ? '▶' : '⏸'}
          </button>
          <button className="ses-btn-ghost px-2" onClick={ilerle}>
            ▶▶
          </button>
          <button className="ses-btn-ghost px-2" onClick={atla}>
            Atla
          </button>
        </div>
        <button className={`mt-2 w-full min-h-[44px] rounded-2xl text-[14px] font-semibold ${micOn ? 'bg-emerald-50 dark:bg-[#1f2e22] text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-[#a3908a]'}`} onClick={() => void micToggle()}>
          {micOn ? '🎤 Mikrofon açık (kapat)' : '🎤 Ses düzeyi çubuğunu aç'}
        </button>
      </div>
    </div>
  )
}
