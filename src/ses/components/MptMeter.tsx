// En uzun "a" tutma (MPT) olcumu. Mikrofon acilabilirse ses basladiginda
// kronometre kendiliginden baslar, sessizlikte durur. Mikrofon yoksa/izin
// verilmediyse elle kronometre (Basla / Bitti).
import { useEffect, useRef, useState } from 'react'
import { createMic, mptComment, mptInit, mptStep, type Mic, type MicStatus, type MptState } from '../lib/mic'
import { AcousticAccumulator, type AcousticResult } from '../lib/acoustic'
import AcousticCard from './AcousticCard'
import { sfxDone, sfxGo } from '../lib/sound'
import { unlockAudio } from '../lib/audioCtx'
import Icon from './Icon'

export interface MptResult {
  sec: number
  db?: number
  manual: boolean
  ac?: AcousticResult // akustik olcum (mikrofonla)
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
  const accRef = useRef<AcousticAccumulator>(new AcousticAccumulator())

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
    accRef.current = new AcousticAccumulator()
    if (!micRef.current) micRef.current = createMic()
    const mic = micRef.current
    mic.onFrame((f) => {
      setLevel(f.db)
      if (!armedRef.current) return
      // Ses surerken akustik analiz (perde/jitter/shimmer/HNR)
      if (stRef.current.phase === 'olcuyor' && f.voiced) accRef.current.push(f.buf, f.sr)
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
    const r: MptResult = { sec: Math.round(sec * 10) / 10, db: s.dbN ? Math.round(s.dbSum / s.dbN) : undefined, manual: false, ac: accRef.current.result() ?? undefined }
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

      <div className={`rounded-[14px] bg-ses-50 dark:bg-sesui-dsoft text-center ${compact ? 'py-4' : 'py-7'}`}>
        <div className="text-[14px] font-semibold uppercase tracking-[0.08em] text-ses-700 dark:text-ses-300">
          {manual ? (manualT0 ? 'Sürüyor…' : result ? 'Sonuç' : 'Elle kronometre') : armed ? (olcuyor ? 'Sürüyor… sesi tut' : 'Hazır — "aaaa" de') : result ? 'Sonuç' : 'En uzun "A" tutma'}
        </div>
        <div className={`font-bold tabular-nums text-sesui-text dark:text-sesui-dtext ${compact ? 'text-[60px]' : 'text-[76px]'} leading-none mt-2`}>
          {shownSec.toFixed(1).replace('.', ',')}
          <span className="text-[20px] font-semibold text-sesui-body dark:text-sesui-dbody ml-1">sn</span>
        </div>
        {!manual && (
          <div className="mx-8 mt-4 h-3 rounded-full bg-white/70 dark:bg-black/25 overflow-hidden">
            <div className="h-full rounded-full bg-ses-500 transition-[width] duration-75" style={{ width: `${status === 'acik' ? pct : 0}%` }} />
          </div>
        )}
        {result && <p className="text-[16px] text-sesui-body dark:text-sesui-dbody mt-3 px-4">{mptComment(result.sec)}</p>}
      </div>
      {result?.ac && <AcousticCard ac={result.ac} compact={compact} />}

      {!manual ? (
        <div className="grid grid-cols-2 gap-2">
          {!armed ? (
            <button className="ses-btn-primary col-span-2 min-h-[58px] text-[18px]" onClick={baslat} disabled={status === 'aciliyor'}>
              <Icon name="mic" size={16} />
              {status === 'aciliyor' ? 'Mikrofon açılıyor…' : result ? 'Yeniden ölç' : 'Ölçümü başlat'}
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
          <button className="col-span-2 text-[15px] text-sesui-body dark:text-sesui-dbody underline py-1" onClick={() => setManual(true)}>
            Mikrofon yerine elle kronometre kullan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {!manualT0 ? (
            <button className="ses-btn-primary col-span-2 min-h-[58px] text-[18px]" onClick={elleBasla}>
              <Icon name="play" size={16} />
              Başla (nefes al, "aaaa" de)
            </button>
          ) : (
            <button className="ses-btn-primary col-span-2 min-h-[58px] text-[18px]" onClick={elleBitir}>
              ■ Bitti
            </button>
          )}
          {status === 'izin-yok' && (
            <p className="col-span-2 text-[14px] text-sesui-body dark:text-sesui-dbody">
              Mikrofon izni verilmedi. Telefon ayarlarından uygulamaya mikrofon izni verirsen süre kendiliğinden ölçülür.
            </p>
          )}
          {status !== 'izin-yok' && status !== 'yok' && (
            <button className="col-span-2 text-[15px] text-sesui-body dark:text-sesui-dbody underline py-1" onClick={() => setManual(false)}>
              Mikrofonla ölç
            </button>
          )}
        </div>
      )}
    </div>
  )
}
