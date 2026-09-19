// En uzun "a" tutma (MPT) olcumu. Mikrofon acilabilirse ses basladiginda
// kronometre kendiliginden baslar, sessizlikte durur. Mikrofon yoksa/izin
// verilmediyse elle kronometre (Basla / Bitti).
import { useEffect, useRef, useState } from 'react'
import { createMic, mptComment, mptInit, mptStep, type Mic, type MicStatus, type MptState } from '../lib/mic'
import { sfxDone, sfxGo } from '../lib/sound'
import { unlockAudio } from '../lib/audioCtx'

export interface MptResult {
  sec: number
  db?: number
  manual: boolean
}

interface Props {
  onResult: (r: MptResult) => void
  attempt?: number // 1..n (bilgi)
  attempts?: number
  compact?: boolean
}

export default function MptMeter({ onResult, attempt, attempts, compact }: Props) {
  const micRef = useRef<Mic | null>(null)
  const [status, setStatus] = useState<MicStatus>('kapali')
  const [level, setLevel] = useState(-90)
  const [st, setSt] = useState<MptState>(mptInit())
  const stRef = useRef(st)
  const memRef = useRef({ t0: 0, lastVoice: 0, firstVoice: 0 })
  const [armed, setArmed] = useState(false) // olcum bekliyor mu
  const [manual, setManual] = useState(false)
  const [manualT0, setManualT0] = useState(0)
  const [manualSec, setManualSec] = useState(0)
  const [result, setResult] = useState<MptResult | null>(null)

  useEffect(() => {
    stRef.current = st
  }, [st])

  // Bilesen kapaninca mikrofonu kapat
  useEffect(() => {
    return () => {
      micRef.current?.stop()
      micRef.current = null
    }
  }, [])

  // Elle kronometre sayaci
  useEffect(() => {
    if (!manualT0) return
    const id = setInterval(() => setManualSec((Date.now() - manualT0) / 1000), 100)
    return () => clearInterval(id)
  }, [manualT0])

  async function baslat() {
    unlockAudio()
    setResult(null)
    setSt(mptInit())
    memRef.current = { t0: 0, lastVoice: 0, firstVoice: 0 }
    if (!micRef.current) micRef.current = createMic()
    const mic = micRef.current
    mic.onFrame((f) => {
      setLevel(f.db)
      if (!armedRef.current) return
      const next = mptStep(stRef.current, f, performance.now(), memRef.current)
      if (next !== stRef.current) {
        if (next.phase === 'olcuyor' && stRef.current.phase === 'bekliyor') sfxGo()
        stRef.current = next
        setSt(next)
        if (next.phase === 'bitti') bitir(next, false)
      }
    })
    setStatus('aciliyor')
    await mic.start()
    setStatus(mic.status)
    if (mic.status === 'acik') {
      armedRef.current = true
      setArmed(true)
    } else {
      // mikrofon yok: elle kronometre
      setManual(true)
    }
  }
  const armedRef = useRef(false)

  function bitir(s: MptState, forced: boolean) {
    armedRef.current = false
    setArmed(false)
    const sec = forced && s.phase === 'olcuyor' ? (performance.now() - memRef.current.t0) / 1000 : s.sec
    const r: MptResult = { sec: Math.round(sec * 10) / 10, db: s.dbN ? Math.round(s.dbSum / s.dbN) : undefined, manual: false }
    micRef.current?.stop()
    setStatus('kapali')
    setResult(r)
    sfxDone()
    onResult(r)
  }

  function elleBasla() {
    unlockAudio()
    setResult(null)
    setManualT0(Date.now())
    setManualSec(0)
    sfxGo()
  }
  function elleBitir() {
    const sec = Math.round(((Date.now() - manualT0) / 1000) * 10) / 10
    setManualT0(0)
    const r: MptResult = { sec, manual: true }
    setResult(r)
    sfxDone()
    onResult(r)
  }

  const olcuyor = st.phase === 'olcuyor'
  const shownSec = manual ? (manualT0 ? manualSec : result?.sec ?? 0) : olcuyor ? st.sec : result?.sec ?? 0
  const pct = Math.max(0, Math.min(100, ((level + 70) / 70) * 100))

  return (
    <div className="space-y-3">
      {attempt != null && attempts != null && <div className="ses-pill">Deneme {attempt} / {attempts}</div>}

      <div className={`rounded-3xl bg-ses-50 dark:bg-[#352820] text-center ${compact ? 'py-4' : 'py-7'}`}>
        <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ses-700 dark:text-ses-300">
          {manual ? (manualT0 ? 'Sürüyor…' : result ? 'Sonuç' : 'Elle kronometre') : armed ? (olcuyor ? 'Sürüyor… sesi tut' : 'Hazır — "aaaa" de') : result ? 'Sonuç' : 'En uzun "A" tutma'}
        </div>
        <div className={`font-bold tabular-nums text-slate-900 dark:text-[#f5ece4] ${compact ? 'text-[56px]' : 'text-[72px]'} leading-none mt-2`}>
          {shownSec.toFixed(1).replace('.', ',')}
          <span className="text-[22px] font-semibold text-slate-500 dark:text-[#a3908a] ml-1">sn</span>
        </div>
        {!manual && (
          <div className="mx-8 mt-4 h-3 rounded-full bg-white/70 dark:bg-black/25 overflow-hidden">
            <div className="h-full rounded-full bg-ses-500 transition-[width] duration-75" style={{ width: `${status === 'acik' ? pct : 0}%` }} />
          </div>
        )}
        {result && <p className="text-[15px] text-slate-600 dark:text-[#d8c8bf] mt-3 px-4">{mptComment(result.sec)}</p>}
      </div>

      {!manual ? (
        <div className="grid grid-cols-2 gap-2">
          {!armed ? (
            <button className="ses-btn-primary col-span-2 min-h-[62px] text-[19px]" onClick={baslat} disabled={status === 'aciliyor'}>
              {status === 'aciliyor' ? 'Mikrofon açılıyor…' : result ? '🎤 Yeniden ölç' : '🎤 Ölçümü başlat'}
            </button>
          ) : (
            <>
              <button className="ses-btn-ghost" onClick={() => bitir(stRef.current, true)}>
                Bitti
              </button>
              <button
                className="ses-btn-ghost"
                onClick={() => {
                  armedRef.current = false
                  setArmed(false)
                  micRef.current?.stop()
                  setStatus('kapali')
                  setSt(mptInit())
                }}
              >
                Vazgeç
              </button>
            </>
          )}
          <button className="col-span-2 text-[14px] text-slate-500 dark:text-[#a3908a] underline py-1" onClick={() => setManual(true)}>
            Mikrofon yerine elle kronometre kullan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {!manualT0 ? (
            <button className="ses-btn-primary col-span-2 min-h-[62px] text-[19px]" onClick={elleBasla}>
              ▶ Başla (nefes al, "aaaa" de)
            </button>
          ) : (
            <button className="ses-btn-primary col-span-2 min-h-[62px] text-[19px]" onClick={elleBitir}>
              ■ Bitti
            </button>
          )}
          {status === 'izin-yok' && (
            <p className="col-span-2 text-[13px] text-slate-500 dark:text-[#a3908a]">
              Mikrofon izni verilmedi. Telefon ayarlarından uygulamaya mikrofon izni verirsen süre kendiliğinden ölçülür.
            </p>
          )}
          {status !== 'izin-yok' && status !== 'yok' && (
            <button className="col-span-2 text-[14px] text-slate-500 dark:text-[#a3908a] underline py-1" onClick={() => setManual(false)}>
              Mikrofonla ölç
            </button>
          )}
        </div>
      )}
    </div>
  )
}
