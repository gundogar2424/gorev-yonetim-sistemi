import { useEffect, useMemo, useState } from 'react'
import type { GameProps } from './types'
import { shuffle } from '../lib/random'
import { RECALL_WORDS, upperTr } from '../lib/words'
import { sfxCorrect, sfxWrong } from '../lib/sound'
import { useTimers } from '../lib/useTimers'
import Progress from '../components/Progress'

const SIZE = [4, 5, 6, 7, 8, 9, 10, 12]
type Phase = 'study' | 'wait' | 'test'

export default function KelimeleriHatirla({ level, onFinish }: GameProps) {
  const size = SIZE[Math.min(SIZE.length, Math.max(1, level)) - 1]
  const studyMs = size * 2500
  const waitMs = level >= 5 ? 12000 : 0
  const { list, quiz } = useMemo(() => {
    const all = shuffle(RECALL_WORDS)
    const list = all.slice(0, size)
    const yeni = all.slice(size, size * 2)
    const quiz = shuffle([...list.map((w) => ({ w, old: true })), ...yeni.map((w) => ({ w, old: false }))])
    return { list, quiz }
  }, [size])

  const [phase, setPhase] = useState<Phase>('study')
  const [left, setLeft] = useState(studyMs)
  const [i, setI] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null)
  const { later } = useTimers()

  // Calisma / bekleme geri sayimi
  useEffect(() => {
    if (phase === 'test') return
    const total = phase === 'study' ? studyMs : waitMs
    const t0 = Date.now()
    setLeft(total)
    const id = window.setInterval(() => {
      const k = total - (Date.now() - t0)
      setLeft(Math.max(0, k))
      if (k <= 0) {
        window.clearInterval(id)
        setPhase(phase === 'study' && waitMs > 0 ? 'wait' : 'test')
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [phase, studyMs, waitMs])

  function cevap(evet: boolean) {
    if (flash) return
    const ok = evet === quiz[i].old
    const c = correct + (ok ? 1 : 0)
    setCorrect(c)
    setFlash(ok ? 'ok' : 'no')
    if (ok) sfxCorrect()
    else sfxWrong()
    later(() => {
      setFlash(null)
      if (i + 1 >= quiz.length) {
        const pct = Math.round((c / quiz.length) * 100)
        onFinish({
          score: pct,
          passed: pct >= 85,
          lines: [`${c} / ${quiz.length} doğru`, `Liste: ${list.map(upperTr).join(', ')}`]
        })
      } else setI(i + 1)
    }, 500)
  }

  if (phase === 'study') {
    return (
      <div className="flex-1 flex flex-col">
        <p className="text-center text-[17px] text-slate-700 dark:text-[#d7d2e6] mb-3">
          Bu <b>{size}</b> kelimeyi ezberle
        </p>
        <div className="h-2.5 rounded-full bg-slate-200/70 dark:bg-[#2a2440] overflow-hidden mb-4">
          <div className="h-full bg-zn-500" style={{ width: `${(left / studyMs) * 100}%`, transition: 'width 100ms linear' }} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {list.map((w) => (
            <div key={w} className="zn-card py-4 text-center text-[22px] font-bold text-slate-900 dark:text-[#ece8f7]">
              {upperTr(w)}
            </div>
          ))}
        </div>
        <button className="zn-btn-primary w-full mt-auto" onClick={() => setPhase(waitMs > 0 ? 'wait' : 'test')}>
          Hazırım
        </button>
      </div>
    )
  }

  if (phase === 'wait') {
    const sn = Math.ceil(left / 1000)
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="text-[64px] font-bold tabular-nums text-zn-600 dark:text-zn-300">{sn}</div>
        <p className="text-[18px] text-slate-700 dark:text-[#d7d2e6] mt-2">Kısa bir ara. Bu sırada 100’den geriye 7’şer say: 100, 93, 86…</p>
        <p className="text-[14px] text-slate-500 dark:text-[#8b849e] mt-3">Ara, hafızayı gerçekten sınamak içindir.</p>
      </div>
    )
  }

  const q = quiz[i]
  return (
    <div className="flex-1 flex flex-col">
      <Progress value={i} max={quiz.length} label="Soru" />
      <p className="text-center text-[16px] text-slate-600 dark:text-[#b7b1c8]">Bu kelime listede var mıydı?</p>
      <div
        className={`flex-1 grid place-items-center rounded-3xl my-3 transition-colors ${
          flash === 'ok' ? 'bg-emerald-50' : flash === 'no' ? 'bg-rose-50' : 'bg-white dark:bg-[#1b1828]'
        }`}
        style={{ minHeight: 150 }}
      >
        <span className="font-black text-slate-900 dark:text-[#ece8f7]" style={{ fontSize: 'clamp(36px, 11vw, 56px)' }}>
          {upperTr(q.w)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button className="zn-choice min-h-[72px] !bg-emerald-500 !text-white" onClick={() => cevap(true)}>
          ✔ Vardı
        </button>
        <button className="zn-choice min-h-[72px] !bg-rose-500 !text-white" onClick={() => cevap(false)}>
          ✘ Yoktu
        </button>
      </div>
    </div>
  )
}
