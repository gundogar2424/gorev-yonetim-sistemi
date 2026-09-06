import { useMemo, useState } from 'react'
import type { GameProps } from './types'
import { shuffle } from '../lib/random'
import { ANAGRAM_WORDS, scrambleWord, upperTr } from '../lib/words'
import { sfxCorrect, sfxTap, sfxWrong } from '../lib/sound'
import { useTimers } from '../lib/useTimers'
import Progress from '../components/Progress'

const LEN_BY_LEVEL = [3, 4, 4, 5, 5, 6, 7, 8]

interface Tile {
  id: number
  ch: string
}

export default function KarisikHarfler({ level, onFinish }: GameProps) {
  const len = LEN_BY_LEVEL[Math.min(LEN_BY_LEVEL.length, Math.max(1, level)) - 1]
  const count = len >= 7 ? 5 : 6
  const words = useMemo(() => shuffle(ANAGRAM_WORDS[len] ?? ANAGRAM_WORDS[5]).slice(0, count), [len, count])
  const [wi, setWi] = useState(0)
  const [tiles, setTiles] = useState<Tile[]>(() => scrambleWord(words[0]).map((ch, id) => ({ id, ch })))
  const [used, setUsed] = useState<number[]>([]) // secilen tile id'leri sirayla
  const [hints, setHints] = useState(0)
  const [wrongs, setWrongs] = useState(0)
  const [shake, setShake] = useState(false)
  const [puanlar, setPuanlar] = useState<number[]>([])
  const { later } = useTimers()
  const word = words[wi]

  const typed = used.map((id) => tiles.find((t) => t.id === id)!.ch).join('')

  function yeniKelime(next: number) {
    setTiles(scrambleWord(words[next]).map((ch, id) => ({ id, ch })))
    setUsed([])
    setHints(0)
    setWrongs(0)
    setWi(next)
  }

  function kaydet(p: number) {
    const list = [...puanlar, p]
    setPuanlar(list)
    if (wi + 1 >= words.length) {
      const ort = Math.round(list.reduce((s, x) => s + x, 0) / list.length)
      onFinish({
        score: ort,
        passed: ort >= 70,
        lines: [`${words.length} kelime, ${len} harfli`, `Kelimeler: ${words.map(upperTr).join(', ')}`]
      })
    } else {
      later(() => yeniKelime(wi + 1), 600)
    }
  }

  function tap(t: Tile) {
    if (used.includes(t.id)) return
    sfxTap()
    const u = [...used, t.id]
    setUsed(u)
    if (u.length === tiles.length) {
      const guess = u.map((id) => tiles.find((x) => x.id === id)!.ch).join('')
      if (guess === word) {
        sfxCorrect()
        kaydet(Math.max(0, 100 - hints * 20 - wrongs * 15))
      } else {
        sfxWrong()
        setWrongs(wrongs + 1)
        setShake(true)
        later(() => {
          setShake(false)
          setUsed([])
        }, 450)
      }
    }
  }

  function sil() {
    if (used.length === 0) return
    sfxTap()
    setUsed(used.slice(0, -1))
  }

  // Ipucu: siradaki dogru harfi otomatik yerlestir
  function ipucu() {
    const pos = used.length
    if (pos >= word.length) return
    // Baslangictaki yanlis harfleri temizle: yazilan kisim dogru degilse sifirla
    const dogruOnEk = typed === word.slice(0, pos)
    const base = dogruOnEk ? used : []
    const hedef = word[base.length]
    const aday = tiles.find((t) => t.ch === hedef && !base.includes(t.id))
    if (!aday) return
    setHints(hints + 1)
    const u = [...base, aday.id]
    setUsed(u)
    sfxTap()
    if (u.length === tiles.length) {
      sfxCorrect()
      kaydet(Math.max(0, 100 - (hints + 1) * 20 - wrongs * 15))
    }
  }

  function gec() {
    sfxWrong()
    kaydet(0)
  }

  return (
    <div className="flex-1 flex flex-col">
      <Progress value={wi} max={words.length} label="Kelime" />
      <p className="text-center text-[16px] text-slate-600 dark:text-[#b7b1c8] mb-3">{len} harfli bir kelime kur</p>

      {/* Yazilan */}
      <div className={`flex justify-center gap-1.5 mb-6 ${shake ? 'zn-shake' : ''}`}>
        {Array.from({ length: word.length }).map((_, i) => (
          <div
            key={i}
            className={`w-11 h-14 rounded-xl grid place-items-center text-[26px] font-bold border-2 ${
              typed[i]
                ? 'bg-zn-600 border-zn-600 text-white'
                : 'bg-white dark:bg-[#1b1828] border-dashed border-slate-300 dark:border-[#3a3157] text-transparent'
            }`}
          >
            {typed[i] ? upperTr(typed[i]) : '·'}
          </div>
        ))}
      </div>

      {/* Harf tasları */}
      <div className="flex flex-wrap justify-center gap-2.5 mb-6">
        {tiles.map((t) => {
          const secili = used.includes(t.id)
          return (
            <button
              key={t.id}
              onClick={() => tap(t)}
              disabled={secili}
              className={`w-14 h-16 rounded-2xl text-[30px] font-bold transition select-none ${
                secili
                  ? 'bg-slate-100 dark:bg-[#241f38] text-slate-300 dark:text-[#4b4462]'
                  : 'bg-white dark:bg-[#1b1828] text-slate-900 dark:text-[#ece8f7] shadow-card dark:shadow-none active:scale-95'
              }`}
            >
              {upperTr(t.ch)}
            </button>
          )
        })}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2">
        <button className="zn-btn-ghost" onClick={sil}>
          ⌫ Sil
        </button>
        <button className="zn-btn-soft" onClick={ipucu}>
          💡 İpucu
        </button>
        <button className="zn-btn-ghost" onClick={gec}>
          Geç ›
        </button>
      </div>
    </div>
  )
}
