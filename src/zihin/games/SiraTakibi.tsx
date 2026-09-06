import { useEffect, useRef, useState } from 'react'
import type { GameProps } from './types'
import { randInt } from '../lib/random'
import { sfxCorrect, sfxNote, sfxWrong } from '../lib/sound'
import { useTimers } from '../lib/useTimers'
import Progress from '../components/Progress'

const PADS = [
  { name: 'Kırmızı', bg: '#ef5350', on: '#ff8a80' },
  { name: 'Mavi', bg: '#42a5f5', on: '#90caf9' },
  { name: 'Yeşil', bg: '#66bb6a', on: '#b9f6ca' },
  { name: 'Sarı', bg: '#fdd835', on: '#fff59d' },
  { name: 'Mor', bg: '#ab47bc', on: '#e1bee7' },
  { name: 'Turuncu', bg: '#ffa726', on: '#ffe0b2' }
]

type Phase = 'ready' | 'show' | 'input' | 'fail'

export default function SiraTakibi({ level, onFinish }: GameProps) {
  const padCount = level >= 5 ? 6 : 4
  const target = level + 2 // ulasilmasi gereken dizi uzunlugu
  const speed = level >= 6 ? 480 : level >= 3 ? 600 : 750
  const [lives, setLives] = useState(level <= 3 ? 2 : 1)
  const { later, clearAll } = useTimers()
  const [seq, setSeq] = useState<number[]>([])
  const [phase, setPhase] = useState<Phase>('ready')
  const [lit, setLit] = useState<number | null>(null)
  const [idx, setIdx] = useState(0)
  const [pressed, setPressed] = useState<number | null>(null)
  const best = useRef(0)
  const [reached, setReached] = useState(0)

  // Diziyi bir uzat ve goster
  function nextRound(cur: number[]) {
    const s = [...cur, randInt(0, padCount - 1)]
    setSeq(s)
    setIdx(0)
    setPhase('show')
    s.forEach((p, i) => {
      later(() => {
        setLit(p)
        sfxNote(p)
      }, 600 + i * speed)
      later(() => setLit(null), 600 + i * speed + speed * 0.6)
    })
    later(() => setPhase('input'), 600 + s.length * speed + 100)
  }

  useEffect(() => {
    later(() => nextRound([]), 400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function tap(p: number) {
    if (phase !== 'input') return
    setPressed(p)
    later(() => setPressed(null), 180)
    sfxNote(p)
    if (p !== seq[idx]) {
      // Hata
      clearAll()
      sfxWrong()
      if (lives > 1) {
        setLives(lives - 1)
        setPhase('fail')
        later(() => nextRound(seq.slice(0, -1)), 1200) // ayni uzunlugu yeni diziyle tekrar dene
      } else {
        bitir(best.current)
      }
      return
    }
    const ni = idx + 1
    if (ni < seq.length) {
      setIdx(ni)
      return
    }
    // Tur tamam
    best.current = Math.max(best.current, seq.length)
    setReached(best.current)
    sfxCorrect()
    setPhase('ready')
    if (seq.length >= target) {
      later(() => bitir(seq.length), 500)
    } else {
      later(() => nextRound(seq), 900)
    }
  }

  function bitir(reached: number) {
    const score = Math.round(Math.min(100, (reached / target) * 100))
    onFinish({
      score,
      passed: reached >= target,
      lines: [`En uzun dizi: ${reached}`, `Hedef: ${target}`]
    })
  }

  const cols = padCount === 6 ? 3 : 2
  return (
    <div className="flex-1 flex flex-col">
      <Progress value={reached} max={target} label="Tamamlanan dizi" />
      <div className="flex items-center justify-between mb-3 text-[16px]">
        <span className="font-semibold text-slate-800 dark:text-[#ece8f7]">
          {phase === 'show' && 'İzle…'}
          {phase === 'input' && `Sıra sende (${idx}/${seq.length})`}
          {phase === 'ready' && 'Hazırlan…'}
          {phase === 'fail' && 'Olmadı, bir hak daha'}
        </span>
        <span className="text-slate-500 dark:text-[#8b849e]">{'❤️'.repeat(lives)}</span>
      </div>
      <div className="grid gap-3 flex-1 content-center" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {PADS.slice(0, padCount).map((pad, i) => {
          const active = lit === i || pressed === i
          return (
            <button
              key={i}
              onPointerDown={() => tap(i)}
              disabled={phase !== 'input'}
              aria-label={pad.name}
              className="rounded-3xl transition-all duration-100 select-none touch-manipulation"
              style={{
                background: active ? pad.on : pad.bg,
                transform: active ? 'scale(0.96)' : 'scale(1)',
                boxShadow: active ? `0 0 0 6px ${pad.on}66` : 'none',
                aspectRatio: padCount === 6 ? '1 / 1' : '1 / 0.9',
                opacity: phase === 'show' && !active ? 0.75 : 1
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
