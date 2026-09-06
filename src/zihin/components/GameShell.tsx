import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import ZnHeader from '../ZnHeader'
import type { GameInfo } from '../lib/games'
import { addResult, getLevel, setLevel } from '../lib/store'
import { sfxWin, sfxWrong } from '../lib/sound'

// Her oyunun sonunda dondurdugu ozet
export interface Outcome {
  score: number // 0-100
  passed: boolean // seviye gecildi mi (bir ust seviyeye cikilir)
  lines: string[] // sonuc ekraninda gosterilecek kisa satirlar
}

interface Props {
  game: GameInfo
  // Oyun icerigi: seviye ve bitirme geri cagrisi verilir
  render: (level: number, finish: (o: Outcome) => void) => ReactNode
}

type Phase = 'intro' | 'play' | 'done'

// Ortak sarmalayici: giris (nasil oynanir) -> oyun -> sonuc. Seviye kaydi,
// sonuc kaydi ve seviye ayari burada; oyunlar yalnizca kendi kurallarini bilir.
export default function GameShell({ game, render }: Props) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('intro')
  const [level, setLvl] = useState(() => getLevel(game.id))
  const [attempt, setAttempt] = useState(0)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [delta, setDelta] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [phase])

  function start() {
    startRef.current = Date.now()
    setOutcome(null)
    setAttempt((a) => a + 1)
    setPhase('play')
  }

  function finish(o: Outcome) {
    const ms = Date.now() - startRef.current
    addResult({ g: game.id, lv: level, sc: Math.round(o.score), ok: o.passed, ms })
    let next = level
    if (o.passed) next = Math.min(game.maxLevel, level + 1)
    else if (o.score < 40) next = Math.max(1, level - 1)
    setLevel(game.id, next)
    setDelta(next - level)
    setOutcome(o)
    setPhase('done')
    if (o.passed) sfxWin()
    else sfxWrong()
  }

  function again() {
    setLvl(getLevel(game.id))
    start()
  }

  if (phase === 'intro') {
    return (
      <div className="flex-1 flex flex-col">
        <ZnHeader title={game.name} subtitle={game.skill} back={() => navigate('/')} />
        <div className="px-5 pb-6 flex-1 flex flex-col">
          <div className="zn-card zn-pop">
            <div className="text-[64px] leading-none text-center py-3">{game.emoji}</div>
            <h2 className="zn-label mb-2">Nasıl oynanır?</h2>
            <p className="text-[18px] leading-relaxed text-slate-800 dark:text-[#ece8f7]">{game.how}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[15px] text-slate-500">Seviye</span>
              <span className="zn-pill text-[14px]">
                {level} / {game.maxLevel}
              </span>
            </div>
          </div>
          <div className="mt-auto pt-6">
            <button className="zn-btn-primary w-full text-[20px] min-h-[64px]" onClick={start}>
              Başla
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'done' && outcome) {
    const basari = outcome.passed
    return (
      <div className="flex-1 flex flex-col">
        <ZnHeader title={game.name} subtitle={`Seviye ${level}`} back={() => navigate('/')} />
        <div className="px-5 pb-6 flex-1 flex flex-col">
          <div className="zn-card zn-pop text-center">
            <div className="text-[64px] leading-none py-2">{basari ? '🎉' : '💪'}</div>
            <h2 className="text-[26px] font-bold text-slate-900 dark:text-[#ece8f7]">
              {basari ? 'Harika!' : 'İyi denemeydi'}
            </h2>
            <p className="text-[17px] text-slate-600 dark:text-[#b7b1c8] mt-1">
              {delta > 0 && 'Bir üst seviyeye geçtin.'}
              {delta === 0 && basari && 'En üst seviyedesin, böyle devam!'}
              {delta === 0 && !basari && 'Aynı seviyede bir daha dene.'}
              {delta < 0 && 'Biraz kolaylaştırdık; alışınca yine zorlaşır.'}
            </p>

            <div className="mt-5 mx-auto w-[128px] h-[128px] rounded-full grid place-items-center relative">
              <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="12" className="text-slate-100 dark:text-[#2a2440]" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.max(0, Math.min(100, outcome.score)) / 100) * 326.7} 326.7`}
                  className={basari ? 'text-emerald-500' : 'text-amber-500'}
                />
              </svg>
              <div className="text-[34px] font-bold tabular-nums text-slate-900 dark:text-[#ece8f7]">
                %{Math.round(outcome.score)}
              </div>
            </div>

            <ul className="mt-5 space-y-1.5 text-[16px] text-slate-700 dark:text-[#d7d2e6]">
              {outcome.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>

          <div className="mt-auto pt-6 space-y-3">
            <button className="zn-btn-primary w-full text-[20px] min-h-[64px]" onClick={again}>
              Tekrar oyna
            </button>
            <button className="zn-btn-ghost w-full" onClick={() => navigate('/')}>
              Ana sayfaya dön
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <ZnHeader
        title={game.name}
        compact
        back={() => {
          if (window.confirm('Oyundan çıkılsın mı? Bu tur kaydedilmez.')) navigate('/')
        }}
        right={<span className="zn-pill text-[14px]">Seviye {level}</span>}
      />
      <div key={attempt} className="flex-1 flex flex-col px-4 pb-6">
        {render(level, finish)}
      </div>
    </div>
  )
}
