import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ZnHeader from '../ZnHeader'
import { gameById, SKILL_COLORS } from '../lib/games'
import { dailyPlan, getLevel, playedToday, readSettings, streakDays } from '../lib/store'
import { dayNumber } from '../lib/random'
import { tipOfDay } from '../lib/tips'

function selam(): string {
  const h = new Date().getHours()
  if (h < 6) return 'İyi geceler'
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

export default function Home() {
  const navigate = useNavigate()
  const ayar = readSettings()
  const plan = useMemo(() => dailyPlan(), [])
  const durum = plan.map((id) => ({ game: gameById(id)!, done: playedToday(id), level: getLevel(id) }))
  const kalan = durum.filter((d) => !d.done)
  const seri = streakDays()
  const tip = tipOfDay(dayNumber())
  const bugunTamam = kalan.length === 0

  return (
    <div>
      <ZnHeader title={`${selam()}${ayar.name ? `, ${ayar.name}` : ''}`} subtitle="Zihin Jimnastiği · günde 10 dakika" />

      <div className="px-4 space-y-4">
        {/* Seri */}
        <div className="zn-card flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 grid place-items-center text-[30px]">🔥</div>
          <div className="flex-1">
            <div className="text-[22px] font-bold text-slate-900 dark:text-[#ece8f7] leading-tight">
              {seri === 0 ? 'Bugün başla' : `${seri} gündür üst üste`}
            </div>
            <div className="text-[14px] text-slate-500 dark:text-[#8b849e]">
              {seri === 0 ? 'Düzenlilik en önemli şey' : bugunTamam ? 'Bugünkü antrenman tamam ✔' : 'Seriyi bugün de sürdür'}
            </div>
          </div>
        </div>

        {/* Gunun plani */}
        <section className="zn-card">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[19px] font-bold text-slate-900 dark:text-[#ece8f7]">Bugünün antrenmanı</h2>
            <span className="text-[14px] text-slate-500 dark:text-[#8b849e] tabular-nums">
              {durum.filter((d) => d.done).length} / {plan.length}
            </span>
          </div>
          <ul className="space-y-2">
            {durum.map(({ game, done, level }) => (
              <li key={game.id}>
                <button
                  onClick={() => navigate(`/oyna/${game.id}`)}
                  className={`w-full flex items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.98] ${
                    done ? 'bg-emerald-50 dark:bg-[#15261f]' : 'bg-slate-50 dark:bg-[#241f38]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#1b1828] grid place-items-center text-[26px] flex-shrink-0">
                    {game.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[17px] font-semibold text-slate-900 dark:text-[#ece8f7] truncate">{game.name}</div>
                    <div className="text-[13px] text-slate-500 dark:text-[#8b849e] flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${SKILL_COLORS[game.skill]}`}>{game.skill}</span>
                      <span>Seviye {level}</span>
                    </div>
                  </div>
                  <div className={`text-[24px] ${done ? 'text-emerald-500' : 'text-slate-300 dark:text-[#4b4462]'}`}>{done ? '✔' : '›'}</div>
                </button>
              </li>
            ))}
          </ul>
          <button
            className="zn-btn-primary w-full mt-4 text-[19px] min-h-[62px]"
            onClick={() => navigate(`/oyna/${(kalan[0] ?? durum[0]).game.id}`)}
          >
            {bugunTamam ? 'Bir tur daha' : kalan.length === plan.length ? 'Antrenmana başla' : 'Kaldığım yerden devam'}
          </button>
        </section>

        {/* Gunun ipucu */}
        <section className="zn-card bg-zn-50 dark:bg-[#1f1a33]">
          <h3 className="zn-label mb-1.5">Günün ipucu</h3>
          <p className="text-[16px] leading-relaxed text-slate-800 dark:text-[#d7d2e6]">{tip}</p>
        </section>

        <div className="text-center pb-2">
          <Link to="/oyunlar" className="text-zn-700 dark:text-zn-300 font-semibold text-[16px]">
            Tüm oyunları gör ›
          </Link>
        </div>
      </div>
    </div>
  )
}
