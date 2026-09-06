import { useMemo, useRef, useState } from 'react'
import type { GameProps } from './types'
import { pick, randInt, shuffle } from '../lib/random'
import { sfxCorrect, sfxWrong } from '../lib/sound'
import { useTimers } from '../lib/useTimers'
import Progress from '../components/Progress'

const COUNT = 10

interface Q {
  text: string
  answer: number
  options: number[]
}

function makeQ(level: number): Q {
  let a: number, b: number, c: number, text: string, answer: number
  const op = (() => {
    if (level <= 3) return pick(['+', '-'])
    if (level <= 5) return pick(['+', '-', '×'])
    return pick(['+', '-', '×', '÷', '2'])
  })()
  const max = [10, 20, 50, 50, 100, 100, 200, 500][Math.min(8, level) - 1]
  switch (op) {
    case '+':
      a = randInt(1, max)
      b = randInt(1, max)
      text = `${a} + ${b}`
      answer = a + b
      break
    case '-':
      a = randInt(2, max)
      b = randInt(1, a)
      text = `${a} − ${b}`
      answer = a - b
      break
    case '×': {
      const m = level <= 4 ? 5 : level <= 6 ? 10 : 12
      a = randInt(2, m)
      b = randInt(2, m)
      text = `${a} × ${b}`
      answer = a * b
      break
    }
    case '÷': {
      b = randInt(2, level >= 8 ? 12 : 10)
      answer = randInt(2, level >= 8 ? 12 : 10)
      a = b * answer
      text = `${a} ÷ ${b}`
      break
    }
    default: {
      // iki adimli: a + b − c
      a = randInt(5, max / 2)
      b = randInt(1, max / 2)
      c = randInt(1, a + b - 1)
      text = `${a} + ${b} − ${c}`
      answer = a + b - c
    }
  }
  // Yakin, inandirici yanlis secenekler
  const set = new Set<number>([answer])
  const jitters = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5, 20]
  let guard = 0
  while (set.size < 4 && guard++ < 60) {
    const v = answer + pick(jitters) * (Math.random() < 0.3 ? 2 : 1)
    if (v >= 0 && v !== answer) set.add(v)
  }
  while (set.size < 4) set.add(answer + set.size * 7)
  return { text, answer, options: shuffle([...set]) }
}

export default function ZihindenHesap({ level, onFinish }: GameProps) {
  const qs = useMemo(() => Array.from({ length: COUNT }, () => makeQ(level)), [level])
  const [i, setI] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const t0 = useRef(Date.now())
  const { later } = useTimers()
  const q = qs[i]

  function cevap(v: number) {
    if (picked !== null) return
    setPicked(v)
    const ok = v === q.answer
    if (ok) sfxCorrect()
    else sfxWrong()
    const c = correct + (ok ? 1 : 0)
    setCorrect(c)
    later(
      () => {
        setPicked(null)
        if (i + 1 >= COUNT) {
          const sn = Math.round((Date.now() - t0.current) / 1000)
          onFinish({
            score: (c / COUNT) * 100,
            passed: c >= 8,
            lines: [`${c} / ${COUNT} doğru`, `Toplam süre: ${sn} sn`]
          })
        } else setI(i + 1)
      },
      ok ? 450 : 1100
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <Progress value={i} max={COUNT} label="Soru" />
      <div className="flex-1 grid place-items-center rounded-3xl bg-white dark:bg-[#1b1828] my-3" style={{ minHeight: 150 }}>
        <div className="text-center">
          <div className="font-bold tabular-nums text-slate-900 dark:text-[#ece8f7]" style={{ fontSize: 'clamp(40px, 11vw, 60px)' }}>
            {q.text} = ?
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((v) => {
          let cls = ''
          if (picked !== null) {
            if (v === q.answer) cls = '!bg-emerald-500 !text-white'
            else if (v === picked) cls = '!bg-rose-500 !text-white'
          }
          return (
            <button key={v} onClick={() => cevap(v)} className={`zn-choice min-h-[72px] !text-[28px] tabular-nums ${cls}`}>
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}
