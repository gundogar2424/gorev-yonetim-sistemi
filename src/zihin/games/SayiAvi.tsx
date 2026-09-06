import { useEffect, useRef, useState } from 'react'
import type { GameProps } from './types'
import { shuffle } from '../lib/random'
import { sfxCorrect, sfxTap, sfxWrong } from '../lib/sound'

const LEVELS: { n: number; cols: number; moving: boolean }[] = [
  { n: 9, cols: 3, moving: false },
  { n: 12, cols: 3, moving: false },
  { n: 16, cols: 4, moving: false },
  { n: 16, cols: 4, moving: true },
  { n: 20, cols: 4, moving: false },
  { n: 25, cols: 5, moving: false },
  { n: 25, cols: 5, moving: true },
  { n: 30, cols: 5, moving: true }
]

export default function SayiAvi({ level, onFinish }: GameProps) {
  const cfg = LEVELS[Math.min(LEVELS.length, Math.max(1, level)) - 1]
  const target = cfg.n * (cfg.moving ? 1.6 : 1.25) // saniye
  const [order, setOrder] = useState<number[]>(() => shuffle(Array.from({ length: cfg.n }, (_, i) => i + 1)))
  const [next, setNext] = useState(1)
  const [wrongAt, setWrongAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const penalty = useRef(0)
  const t0 = useRef(Date.now())
  const done = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((Date.now() - t0.current) / 1000 + penalty.current), 100)
    return () => window.clearInterval(id)
  }, [])

  function tap(v: number) {
    if (done.current) return
    if (v !== next) {
      sfxWrong()
      penalty.current += 1 // her yanlis 1 sn ceza
      setWrongAt(v)
      window.setTimeout(() => setWrongAt(null), 350)
      return
    }
    sfxTap()
    if (v === cfg.n) {
      done.current = true
      sfxCorrect()
      const sure = (Date.now() - t0.current) / 1000 + penalty.current
      const score = Math.round(Math.max(0, Math.min(100, (target / sure) * 100)))
      onFinish({
        score,
        passed: sure <= target,
        lines: [`${cfg.n} sayı, ${sure.toFixed(1)} sn`, `Hedef süre: ${target.toFixed(0)} sn${penalty.current ? ` · ${penalty.current} yanlış` : ''}`]
      })
      return
    }
    setNext(v + 1)
    if (cfg.moving) setOrder(shuffle(order))
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[17px] text-slate-700 dark:text-[#d7d2e6]">
          Sıradaki: <b className="text-zn-700 dark:text-zn-300 text-[24px] tabular-nums">{next}</b>
        </div>
        <div className={`text-[17px] tabular-nums ${elapsed > target ? 'text-rose-500' : 'text-slate-500 dark:text-[#8b849e]'}`}>
          {elapsed.toFixed(1)} sn
        </div>
      </div>
      {cfg.moving && <p className="text-[13px] text-amber-700 dark:text-amber-300 mb-2">Dikkat: her dokunuşta sayılar yer değiştirir.</p>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))` }}>
        {order.map((v) => {
          const bitti = v < next
          return (
            <button
              key={v}
              onPointerDown={() => tap(v)}
              disabled={bitti}
              className={`aspect-square rounded-2xl font-bold tabular-nums transition select-none touch-manipulation ${
                bitti
                  ? 'bg-emerald-100 dark:bg-[#15261f] text-emerald-500'
                  : 'bg-white dark:bg-[#1b1828] text-slate-900 dark:text-[#ece8f7] shadow-card dark:shadow-none active:scale-95'
              } ${wrongAt === v ? 'zn-shake !bg-rose-100' : ''}`}
              style={{ fontSize: cfg.cols >= 5 ? 24 : 30 }}
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}
