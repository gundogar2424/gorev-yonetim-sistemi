import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameProps } from './types'
import { pick, shuffle } from '../lib/random'
import { sfxCorrect, sfxWrong } from '../lib/sound'
import { useTimers } from '../lib/useTimers'
import Progress from '../components/Progress'

const COLORS = [
  { name: 'KIRMIZI', hex: '#e53935' },
  { name: 'MAVİ', hex: '#1e88e5' },
  { name: 'YEŞİL', hex: '#43a047' },
  { name: 'SARI', hex: '#f9a825' },
  { name: 'MOR', hex: '#8e24aa' },
  { name: 'TURUNCU', hex: '#fb8c00' }
]

const TRIALS = 12

interface Trial {
  word: number // yazilan renk adi (indeks)
  ink: number // murekkep rengi (indeks) — dogru cevap
}

export default function RenkTuzagi({ level, onFinish }: GameProps) {
  const n = level <= 2 ? 3 : level <= 5 ? 4 : level <= 7 ? 5 : 6
  const incongruentRate = level === 1 ? 0.5 : level <= 3 ? 0.7 : 0.85
  const limitMs = level <= 2 ? 0 : level <= 4 ? 4000 : level <= 6 ? 3000 : 2200
  const palette = useMemo(() => shuffle(COLORS).slice(0, n), [n])
  const trials = useMemo<Trial[]>(() => {
    const t: Trial[] = []
    for (let i = 0; i < TRIALS; i++) {
      const ink = Math.floor(Math.random() * n)
      let word = ink
      if (Math.random() < incongruentRate) {
        word = pick(palette.map((_, k) => k).filter((k) => k !== ink))
      }
      t.push({ word, ink })
    }
    return t
  }, [n, incongruentRate, palette])

  const [i, setI] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null)
  const [left, setLeft] = useState(limitMs)
  const times = useRef<number[]>([])
  const startedAt = useRef(Date.now())
  const { later } = useTimers()
  const locked = useRef(false)

  // Sure siniri: her soruda geri sayim
  useEffect(() => {
    if (!limitMs) return
    setLeft(limitMs)
    const t0 = Date.now()
    const id = window.setInterval(() => {
      const kal = limitMs - (Date.now() - t0)
      setLeft(Math.max(0, kal))
      if (kal <= 0) {
        window.clearInterval(id)
        cevap(-1)
      }
    }, 50)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  function cevap(k: number) {
    if (locked.current) return
    locked.current = true
    const dogru = k === trials[i].ink
    times.current.push(Date.now() - startedAt.current)
    const c = correct + (dogru ? 1 : 0)
    setCorrect(c)
    setFlash(dogru ? 'ok' : 'no')
    if (dogru) sfxCorrect()
    else sfxWrong()
    later(() => {
      setFlash(null)
      locked.current = false
      if (i + 1 >= TRIALS) {
        const ort = Math.round(times.current.reduce((s, x) => s + x, 0) / times.current.length / 100) / 10
        onFinish({
          score: Math.round((c / TRIALS) * 100),
          passed: c >= 10,
          lines: [`${c} / ${TRIALS} doğru`, `Ortalama tepki: ${ort} sn`]
        })
      } else {
        startedAt.current = Date.now()
        setI(i + 1)
      }
    }, 350)
  }

  const t = trials[i]
  return (
    <div className="flex-1 flex flex-col">
      <Progress value={i} max={TRIALS} label="Soru" />
      <p className="text-center text-[16px] text-slate-600 dark:text-[#b7b1c8]">Yazının <b>rengi</b> hangisi?</p>

      <div
        className={`flex-1 grid place-items-center rounded-3xl my-3 transition-colors ${
          flash === 'ok' ? 'bg-emerald-50' : flash === 'no' ? 'bg-rose-50' : 'bg-white dark:bg-[#1b1828]'
        } ${flash === 'no' ? 'zn-shake' : ''}`}
        style={{ minHeight: 150 }}
      >
        <span className="font-black tracking-wide" style={{ color: palette[t.ink].hex, fontSize: 'clamp(40px, 12vw, 64px)' }}>
          {palette[t.word].name}
        </span>
      </div>

      {limitMs > 0 && (
        <div className="h-2 rounded-full bg-slate-200/70 dark:bg-[#2a2440] overflow-hidden mb-3">
          <div className="h-full bg-amber-400" style={{ width: `${(left / limitMs) * 100}%`, transition: 'width 50ms linear' }} />
        </div>
      )}

      <div className={`grid gap-2.5 ${n === 3 ? 'grid-cols-1' : n >= 5 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {palette.map((c, k) => (
          <button key={c.name} onClick={() => cevap(k)} className="zn-choice !text-[18px] gap-2 min-h-[64px]">
            <span className="w-7 h-7 rounded-lg flex-shrink-0" style={{ background: c.hex }} />
            <span>{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
