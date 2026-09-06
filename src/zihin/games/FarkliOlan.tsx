import { useMemo, useRef, useState } from 'react'
import type { GameProps } from './types'
import { pick, randInt } from '../lib/random'
import { sfxCorrect, sfxWrong } from '../lib/sound'
import { useTimers } from '../lib/useTimers'
import Progress from '../components/Progress'

const ROUNDS = 12
const EMOJI = ['🍎', '🍌', '🍇', '🐱', '🐶', '🐟', '🌻', '⭐', '🚗', '⛵', '🎈', '🔑', '☂️', '🧀', '🥕']
const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'arrow'] as const
type Shape = (typeof SHAPES)[number]

interface Cell {
  emoji?: string
  shape?: Shape
  hue: number
  light: number
  rotate: number
  scale: number
}

interface Round {
  cols: number
  base: Cell
  odd: Cell
  oddIndex: number
}

function makeRound(level: number): Round {
  const cols = level <= 1 ? 3 : level <= 5 ? 4 : 5
  const n = cols * cols
  const oddIndex = randInt(0, n - 1)
  const hue = randInt(0, 359)
  const base: Cell = { hue, light: 50, rotate: 0, scale: 1 }
  let odd: Cell = { ...base }
  if (level <= 2) {
    // Bambaska bir emoji
    base.emoji = pick(EMOJI)
    odd = { ...base, emoji: pick(EMOJI.filter((e) => e !== base.emoji)) }
  } else if (level === 3) {
    base.shape = pick(SHAPES)
    odd = { ...base, shape: pick(SHAPES.filter((s) => s !== base.shape)) }
  } else if (level === 4) {
    base.shape = pick(['triangle', 'arrow'] as Shape[])
    odd = { ...base, rotate: 180 }
  } else if (level === 5) {
    base.shape = pick(SHAPES)
    odd = { ...base, light: base.light + 13 }
  } else if (level === 6) {
    base.shape = pick(SHAPES)
    odd = { ...base, light: base.light + 9 }
  } else if (level === 7) {
    base.shape = pick(['triangle', 'arrow'] as Shape[])
    odd = { ...base, rotate: 90 }
  } else {
    base.shape = pick(SHAPES)
    odd = Math.random() < 0.5 ? { ...base, scale: 0.82 } : { ...base, light: base.light + 7 }
  }
  return { cols, base, odd, oddIndex }
}

function ShapeSvg({ c }: { c: Cell }) {
  const fill = `hsl(${c.hue} 70% ${c.light}%)`
  const common = { fill }
  return (
    <svg viewBox="0 0 100 100" className="w-[70%] h-[70%]" style={{ transform: `rotate(${c.rotate}deg) scale(${c.scale})` }}>
      {c.shape === 'circle' && <circle cx="50" cy="50" r="42" {...common} />}
      {c.shape === 'square' && <rect x="10" y="10" width="80" height="80" rx="10" {...common} />}
      {c.shape === 'triangle' && <polygon points="50,8 92,88 8,88" {...common} />}
      {c.shape === 'diamond' && <polygon points="50,6 94,50 50,94 6,50" {...common} />}
      {c.shape === 'arrow' && <polygon points="50,6 90,50 64,50 64,94 36,94 36,50 10,50" {...common} />}
    </svg>
  )
}

export default function FarkliOlan({ level, onFinish }: GameProps) {
  const rounds = useMemo(() => Array.from({ length: ROUNDS }, () => makeRound(level)), [level])
  const [i, setI] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [mark, setMark] = useState<{ idx: number; ok: boolean } | null>(null)
  const t0 = useRef(Date.now())
  const { later } = useTimers()
  const r = rounds[i]

  function tap(idx: number) {
    if (mark) return
    const ok = idx === r.oddIndex
    if (ok) sfxCorrect()
    else sfxWrong()
    setMark({ idx, ok })
    const c = correct + (ok ? 1 : 0)
    setCorrect(c)
    later(
      () => {
        setMark(null)
        if (i + 1 >= ROUNDS) {
          const sn = Math.round((Date.now() - t0.current) / 1000)
          onFinish({ score: (c / ROUNDS) * 100, passed: c >= 10, lines: [`${c} / ${ROUNDS} doğru`, `Toplam süre: ${sn} sn`] })
        } else setI(i + 1)
      },
      ok ? 400 : 1000
    )
  }

  const cells = Array.from({ length: r.cols * r.cols }, (_, k) => (k === r.oddIndex ? r.odd : r.base))
  return (
    <div className="flex-1 flex flex-col">
      <Progress value={i} max={ROUNDS} label="Tur" />
      <p className="text-center text-[16px] text-slate-600 dark:text-[#b7b1c8] mb-3">Diğerlerinden farklı olana dokun</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${r.cols}, minmax(0, 1fr))` }}>
        {cells.map((c, k) => {
          let ring = ''
          if (mark) {
            if (k === r.oddIndex) ring = 'ring-4 ring-emerald-500'
            else if (k === mark.idx) ring = 'ring-4 ring-rose-500'
          }
          return (
            <button
              key={k}
              onClick={() => tap(k)}
              className={`aspect-square rounded-2xl bg-white dark:bg-[#1b1828] shadow-card dark:shadow-none grid place-items-center active:scale-95 transition ${ring}`}
              style={{ fontSize: r.cols >= 5 ? 28 : 36 }}
            >
              {c.emoji ? <span>{c.emoji}</span> : <ShapeSvg c={c} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
