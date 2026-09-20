// Diksiyon seansi: her egzersiz icin once aciklama, sonra satirlar tek tek
// buyuk yaziyla; her satir icin sure cubugu (tempoya gore). Isteyen mikrofon
// duzey cubugunu acar (sesini yeterince duyuruyor mu?).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SesHeader from '../SesHeader'
import { DGROUP_LABEL, findDExercise, type DExercise } from '../lib/diksiyon'
import { activeDExercises, addSession, dSecFor, readSettings, updateSession, type DoneExercise, type LineScore, type Session as SessionRec } from '../lib/store'
import { accuracyComment, listenOnce, scoreText, speechAvailable, speechPermission, type Listener, type Score } from '../lib/speech'
import Rating from '../components/Rating'
import ClipPlayer from '../components/ClipPlayer'
import FeedbackCard from '../components/FeedbackCard'
import { sfxDone, sfxGo, sfxRest } from '../lib/sound'
import { unlockAudio } from '../lib/audioCtx'
import { createMic, type Mic } from '../lib/mic'
import { fmtMinutes } from '../lib/date'
import Icon from '../components/Icon'

type Phase = 'intro' | 'oku' | 'sonuc' | 'puan' | 'done'

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
  const [saved, setSaved] = useState<SessionRec | null>(null)
  // Konusma tanima ile puanlama
  const [scoreOn, setScoreOn] = useState(ayar.score)
  const [speechOk, setSpeechOk] = useState<boolean | null>(null)
  const listenerRef = useRef<Listener | null>(null)
  const [listening, setListening] = useState(false)
  const [lineScore, setLineScore] = useState<Score | null>(null)
  const [lineScores, setLineScores] = useState<LineScore[]>([])
  const [rating, setRating] = useState<number | undefined>(undefined)
  const lineT0 = useRef(0)
  const finishing = useRef(false) // satir bitirme surerken (tanima sonucu beklenirken) yeniden tetiklenmesin
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

  useEffect(() => {
    void speechAvailable().then(setSpeechOk)
  }, [])

  // Satir sayaci
  useEffect(() => {
    if (phase !== 'oku' || paused) return
    const id = setInterval(() => {
      const kalan = (endAt.current - Date.now()) / 1000
      setLeft(Math.max(0, kalan))
      if (kalan <= 0 && !finishing.current) ilerle()
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, idx, rep])

  function zamanla(s: number) {
    endAt.current = Date.now() + s * 1000
    setLeft(s)
  }

  const puanla = scoreOn && speechOk === true

  async function dinlemeyeBasla() {
    finishing.current = false
    if (!puanla) return
    try {
      if (!(await speechPermission())) {
        setSpeechOk(false)
        return
      }
      listenerRef.current?.stop()
      lineT0.current = Date.now()
      listenerRef.current = await listenOnce()
      setListening(true)
    } catch {
      setSpeechOk(false)
      setListening(false)
    }
  }

  // Satiri bitir: dinlemeyi durdur, puanla; puanlama acikse sonuc ekranina gec
  async function satiriBitir(next: () => void) {
    if (finishing.current) return
    if (!puanla || !listenerRef.current) {
      next()
      return
    }
    finishing.current = true
    const l = listenerRef.current
    listenerRef.current = null
    setListening(false)
    l.stop()
    const r = await l.done
    const target = ex ? ex.lines[rep % ex.lines.length] : ''
    const sc = scoreText(target, r.text, Math.max(r.ms, Date.now() - lineT0.current))
    setLineScore(sc)
    setLineScores((xs) => [...xs, { target, heard: r.text, acc: sc.accuracy, wpm: sc.wpm, missed: sc.marks.filter((m) => !m.ok).map((m) => m.w) }])
    setPhase('sonuc')
    pendingNext.current = next
    finishing.current = false
  }
  const pendingNext = useRef<() => void>(() => {})

  function basla() {
    unlockAudio()
    if (!ex) return
    setRep(0)
    setLineScores([])
    setLineScore(null)
    setRating(undefined)
    setPhase('oku')
    zamanla(sec)
    sfxGo()
    void dinlemeyeBasla()
  }

  function sonrakiSatir() {
    if (!ex) return
    if (rep + 1 < n) {
      setRep(rep + 1)
      setPhase('oku')
      zamanla(sec)
      sfxRest()
      void dinlemeyeBasla()
    } else {
      // egzersiz bitti -> oz degerlendirme
      setPhase('puan')
    }
  }

  function ilerle() {
    if (!ex) return
    void satiriBitir(sonrakiSatir)
  }

  function geri() {
    if (rep > 0) {
      listenerRef.current?.stop()
      listenerRef.current = null
      setListening(false)
      setRep(rep - 1)
      zamanla(sec)
      void dinlemeyeBasla()
    }
  }

  function puanKaydet() {
    if (!ex) return
    const accs = lineScores.map((l) => l.acc)
    const wpms = lineScores.map((l) => l.wpm).filter((w) => w > 0)
    egzersizBitti({
      id: ex.id,
      reps: n,
      rating,
      acc: accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : undefined,
      wpm: wpms.length ? Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length) : undefined,
      lines: lineScores.length ? lineScores : undefined
    })
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
    listenerRef.current?.stop()
    listenerRef.current = null
    setListening(false)
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
    listenerRef.current?.stop()
    listenerRef.current = null
    setListening(false)
    if (yapilan.length > 0 && !savedId) {
      const s = addSession({ ms: Date.now() - startedAt.current.getTime(), done: yapilan, kind: 'diksiyon' }, startedAt.current)
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
        <div className="px-4 space-y-5 pb-8">
          <section className="ses-card text-center py-6">
            <div className="inline-flex w-12 h-12 rounded-full bg-ses-50 dark:bg-sesui-dsoft text-ses-700 dark:text-ses-300 items-center justify-center">
              <Icon name={done.length > 0 ? 'check' : 'info'} size={24} strokeWidth={1.8} />
            </div>
            <div className="text-[22px] font-bold text-sesui-text dark:text-sesui-dtext mt-1">{done.length} egzersiz</div>
            <div className="text-[16px] text-sesui-body dark:text-sesui-dbody">
              {fmtMinutes(ms)} · diksiyon
              {(() => {
                const a = done.map((d) => d.acc).filter((x): x is number => typeof x === 'number')
                return a.length ? ` · doğruluk %${Math.round(a.reduce((x, y) => x + y, 0) / a.length)}` : ''
              })()}
            </div>
          </section>
          {done.length > 0 && (
            <section className="ses-card">
              <ul className="divide-y divide-sesui-line dark:divide-sesui-dline">
                {done.map((d, i) => {
                  const e = findDExercise(d.id)
                  return (
                    <li key={i} className="py-2 flex items-center justify-between text-[16px]">
                      <span className="text-sesui-text dark:text-sesui-dtext">
                        {e?.name ?? d.id}
                      </span>
                      <span className="text-sesui-body dark:text-sesui-dbody">
                        {typeof d.acc === 'number' ? `%${d.acc} · ` : ''}
                        {typeof d.rating === 'number' ? `${'★'.repeat(d.rating)} · ` : ''}
                        {d.reps} ×
                      </span>
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
          {saved && <FeedbackCard session={{ ...saved, note }} />}
          <button className="ses-btn-primary w-full min-h-[58px] text-[18px]" onClick={() => navigate('/diksiyon')}>
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
        <div className="px-4 space-y-5 pb-8 flex-1 flex flex-col">
          {ex.clip && (
            <section className="ses-card space-y-3">
              <h3 className="ses-label">Başlamadan önce izle</h3>
              <ClipPlayer src={ex.clip} />
            </section>
          )}
          <section className="ses-card">
            <div className="flex items-center gap-3">
              <p className="text-[16px] text-sesui-body dark:text-sesui-dbody">{ex.short}</p>
            </div>
            <p className="text-[15px] text-sesui-body dark:text-sesui-dbody mt-3">
              <b>Neden:</b> {ex.why}
            </p>
            <ol className="space-y-2 mt-3">
              {ex.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[16px] text-sesui-body dark:text-sesui-dbody">
                  <span className="w-7 h-7 rounded-full bg-ses-600 text-white grid place-items-center text-[14px] font-bold flex-shrink-0">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {ex.tip && (
              <p className="ses-row flex gap-2.5 text-[14px] leading-relaxed text-amber-800 dark:text-amber-300">
                <Icon name="alert" size={16} className="mt-0.5" />
                <span>{ex.tip}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="ses-pill">
                {n} satır × {sec} sn
              </span>
            </div>
          </section>
          <div className="mt-auto space-y-2">
            <button className="ses-btn-primary w-full min-h-[58px] text-[19px]" onClick={basla}>
              <Icon name="play" size={16} />
              Başla
            </button>
            <button className="ses-btn-ghost w-full" onClick={atla}>
              Bu egzersizi atla
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- SATIR SONUCU (konusma tanima) ----------
  if (phase === 'sonuc' && lineScore) {
    const sc = lineScore
    const renk = sc.accuracy >= 85 ? 'text-emerald-600 dark:text-emerald-300' : sc.accuracy >= 60 ? 'text-amber-600 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'
    return (
      <div className="flex-1 flex flex-col">
        <SesHeader title={ex.name} subtitle={`${idx + 1} / ${list.length} · satır ${rep + 1} / ${n} · sonuç`} compact back={() => bitir(done)} />
        <div className="px-4 pb-8 flex-1 flex flex-col space-y-3">
          <section className="ses-card ses-pop text-center py-5">
            <div className="text-[14px] font-semibold uppercase tracking-[0.1em] text-ses-700 dark:text-ses-300">Doğruluk</div>
            <div className={`text-[68px] font-bold leading-none tabular-nums mt-1 ${renk}`}>%{sc.accuracy}</div>
            <div className="text-[15px] text-sesui-body dark:text-sesui-dbody mt-1">{sc.wpm > 0 ? `${sc.wpm} sözcük/dk` : ''}</div>
            <p className="text-[16px] text-sesui-body dark:text-sesui-dbody mt-2">{accuracyComment(sc.accuracy)}</p>
          </section>
          <section className="ses-card">
            <div className="ses-label mb-2">Hedef metin (kırmızı: yutulan / yanlış)</div>
            <p className="text-[18px] leading-relaxed">
              {sc.marks.map((m, i) => (
                <span key={i} className={m.ok ? 'text-sesui-text dark:text-sesui-dtext' : 'text-rose-600 dark:text-rose-300 font-bold underline decoration-2'}>
                  {m.w}{' '}
                </span>
              ))}
            </p>
            <div className="ses-label mt-3 mb-1">Duyulan</div>
            <p className="text-[16px] text-sesui-body dark:text-sesui-dbody italic">{sc.heard || '(bir şey anlaşılmadı — telefonu yaklaştır, daha gür söyle)'}</p>
          </section>
          <div className="mt-auto grid grid-cols-2 gap-2">
            <button
              className="ses-btn-ghost"
              onClick={() => {
                setLineScores((xs) => xs.slice(0, -1))
                setPhase('oku')
                zamanla(sec)
                void dinlemeyeBasla()
              }}
            >
              🔁 Yeniden dene
            </button>
            <button className="ses-btn-primary" onClick={() => pendingNext.current()}>
              Devam
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- OZ DEGERLENDIRME ----------
  if (phase === 'puan') {
    const accs = lineScores.map((l) => l.acc)
    const ort = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null
    return (
      <div className="flex-1 flex flex-col">
        <SesHeader title={ex.name} subtitle="Egzersiz bitti · değerlendir" compact back={() => bitir(done)} />
        <div className="px-4 pb-8 flex-1 flex flex-col space-y-3">
          <section className="ses-card ses-pop space-y-3">
            {ort != null && (
              <div className="text-center">
                <div className="text-[14px] font-semibold uppercase tracking-[0.1em] text-ses-700 dark:text-ses-300">Bu egzersizde ortalama doğruluk</div>
                <div className="text-[52px] font-bold leading-none tabular-nums mt-1 text-sesui-text dark:text-sesui-dtext">%{ort}</div>
              </div>
            )}
            <Rating value={rating} onChange={setRating} />
          </section>
          <div className="mt-auto space-y-2">
            <button className="ses-btn-primary w-full min-h-[58px] text-[18px]" onClick={puanKaydet}>
              {idx + 1 < list.length ? 'Sonraki egzersiz' : 'Seansı bitir'}
            </button>
            <button className="ses-btn-ghost w-full" onClick={puanKaydet}>
              Puan vermeden geç
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
        <div className="flex-1 flex flex-col rounded-[14px] p-5 bg-white dark:bg-sesui-dcard">
          <div className="text-[14px] font-semibold uppercase tracking-[0.1em] text-ses-700 dark:text-ses-300 text-center">
            {paused ? 'Duraklatıldı' : listening ? '🔴 Dinliyor · oku / söyle' : 'Oku / söyle'}
          </div>
          <div className={`flex-1 flex items-center justify-center text-center font-bold leading-snug text-sesui-text dark:text-sesui-dtext py-4 ${uzun ? 'text-[19px]' : 'text-[28px]'}`}>{satir}</div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 rounded-full bg-sesui-line dark:bg-sesui-dline overflow-hidden">
              <div className="h-full rounded-full bg-ses-500 transition-[width] duration-100" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[18px] font-bold tabular-nums text-sesui-body dark:text-sesui-dtext w-8 text-right">{Math.ceil(left)}</span>
          </div>
          {micOn && (
            <div className="mt-3">
              <div className="text-[13px] text-sesui-body dark:text-sesui-dbody mb-1">Ses düzeyi</div>
              <div className="h-3 rounded-full bg-sesui-line dark:bg-sesui-dline overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-75" style={{ width: `${lvl}%` }} />
              </div>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-1.5 mt-4">
            {Array.from({ length: n }).map((_, i) => (
              <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < rep ? 'bg-ses-600' : i === rep ? 'bg-ses-300' : 'bg-sesui-line dark:bg-sesui-dline'}`} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3">
          <button className="ses-btn-ghost px-2" onClick={geri} disabled={rep === 0}>
            ◀
          </button>
          <button className="ses-btn-ghost px-2" onClick={duraklat}>
            <Icon name={paused ? 'play' : 'pause'} size={16} />
          </button>
          <button className="ses-btn-ghost px-2" onClick={ilerle}>
            <Icon name="skip" size={16} />
          </button>
          <button className="ses-btn-ghost px-2" onClick={atla}>
            Atla
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            className={`min-h-[48px] rounded-[10px] text-[14px] font-semibold ${puanla ? 'bg-emerald-50 dark:bg-[#1f2e22] text-emerald-700 dark:text-emerald-300' : 'text-sesui-body dark:text-sesui-dbody'}`}
            onClick={() => {
              const v = !scoreOn
              setScoreOn(v)
              if (!v) {
                listenerRef.current?.stop()
                listenerRef.current = null
                setListening(false)
              } else void dinlemeyeBasla()
            }}
            disabled={speechOk === false}
          >
            {speechOk === false ? '🎙️ Konuşma tanıma yok' : puanla ? '🎙️ Puanlama açık' : '🎙️ Puanlamayı aç'}
          </button>
          <button className={`min-h-[48px] rounded-[10px] text-[14px] font-semibold ${micOn ? 'bg-emerald-50 dark:bg-[#1f2e22] text-emerald-700 dark:text-emerald-300' : 'text-sesui-body dark:text-sesui-dbody'}`} onClick={() => void micToggle()}>
            <Icon name="mic" size={15} />
            {micOn ? 'Düzey çubuğu açık' : 'Ses düzeyi çubuğu'}
          </button>
        </div>
        {puanla && <p className="text-[13px] text-sesui-muted dark:text-sesui-dmuted text-center mt-1">Satırı okuyunca ileri düğmesine bas: tanıma durur ve doğruluk hesaplanır. Süre bitince de kendiliğinden değerlendirilir.</p>}
      </div>
    </div>
  )
}
