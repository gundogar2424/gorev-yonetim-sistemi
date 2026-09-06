import { useMemo, useState } from 'react'
import type { GameProps } from './types'
import { shuffle } from '../lib/random'
import { sfxCorrect, sfxTap, sfxWrong } from '../lib/sound'
import { useTimers } from '../lib/useTimers'
import Progress from '../components/Progress'

const EMOJIS = ['🍎', '🍌', '🍇', '🍓', '🍒', '🍋', '🥕', '🌽', '🐱', '🐶', '🐰', '🐢', '🐟', '🐝', '🌻', '🌹', '⭐', '🌙', '☂️', '🚗', '✈️', '⛵', '🎈', '🔑', '🎁', '📚', '⌚', '🧢', '👓', '🎸']

// Seviyeye gore cift sayisi ve sutun sayisi
const LEVELS: { pairs: number; cols: number }[] = [
  { pairs: 3, cols: 3 },
  { pairs: 4, cols: 4 },
  { pairs: 6, cols: 3 },
  { pairs: 6, cols: 4 },
  { pairs: 8, cols: 4 },
  { pairs: 10, cols: 4 },
  { pairs: 10, cols: 5 },
  { pairs: 12, cols: 4 }
]

interface Card {
  id: number
  face: string
  open: boolean
  done: boolean
}

export default function HafizaKartlari({ level, onFinish }: GameProps) {
  const cfg = LEVELS[Math.min(LEVELS.length, Math.max(1, level)) - 1]
  const { later } = useTimers()
  const [cards, setCards] = useState<Card[]>(() => {
    const faces = shuffle(EMOJIS).slice(0, cfg.pairs)
    return shuffle([...faces, ...faces]).map((face, id) => ({ id, face, open: false, done: false }))
  })
  const [openIds, setOpenIds] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [busy, setBusy] = useState(false)
  const matched = useMemo(() => cards.filter((c) => c.done).length / 2, [cards])
  const hideDelay = level >= 5 ? 650 : 950

  function tap(id: number) {
    if (busy) return
    const c = cards[id]
    if (c.open || c.done) return
    sfxTap()
    const next = cards.map((k) => (k.id === id ? { ...k, open: true } : k))
    const opened = [...openIds, id]
    setCards(next)
    setOpenIds(opened)
    if (opened.length < 2) return

    const [a, b] = opened
    const m = moves + 1
    setMoves(m)
    setBusy(true)
    if (next[a].face === next[b].face) {
      later(() => {
        sfxCorrect()
        const after = next.map((k) => (k.id === a || k.id === b ? { ...k, done: true } : k))
        setCards(after)
        setOpenIds([])
        setBusy(false)
        if (after.every((k) => k.done)) bitir(m)
      }, 250)
    } else {
      later(() => {
        sfxWrong()
        setCards(next.map((k) => (k.id === a || k.id === b ? { ...k, open: false } : k)))
        setOpenIds([])
        setBusy(false)
      }, hideDelay)
    }
  }

  function bitir(m: number) {
    const p = cfg.pairs
    // Kusursuz oyun = cift sayisi kadar hamle. 3 kati hamlede puan 0.
    const score = Math.max(0, Math.min(100, Math.round(100 - ((m - p) * 100) / (p * 2))))
    onFinish({
      score,
      passed: score >= 55,
      lines: [`${p} çift, ${m} hamlede`, `En iyi olası: ${p} hamle`]
    })
  }

  return (
    <div className="flex-1 flex flex-col">
      <Progress value={matched} max={cfg.pairs} label="Eşleşen çift" />
      <div className="text-[14px] text-slate-500 dark:text-[#8b849e] mb-2 tabular-nums">Hamle: {moves}</div>
      <div className="grid gap-2.5 flex-1 content-start" style={{ gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))` }}>
        {cards.map((c) => (
          <button
            key={c.id}
            onClick={() => tap(c.id)}
            aria-label={c.open || c.done ? c.face : 'Kapalı kart'}
            className={`relative aspect-[3/4] rounded-2xl zn-flip ${c.open || c.done ? 'on' : ''} ${c.done ? 'opacity-60' : ''}`}
          >
            <span className="zn-face absolute inset-0 rounded-2xl bg-zn-600 grid place-items-center">
              <span className="w-1/2 h-1/2 rounded-xl border-4 border-white/30" />
            </span>
            <span
              className="zn-face zn-face-back absolute inset-0 rounded-2xl bg-white dark:bg-[#1b1828] shadow-card dark:shadow-none grid place-items-center"
              style={{ fontSize: cfg.cols >= 5 ? 30 : cfg.cols === 4 ? 36 : 44 }}
            >
              {c.face}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
