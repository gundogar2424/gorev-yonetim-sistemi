import { useNavigate } from 'react-router-dom'
import ZnHeader from '../ZnHeader'
import { GAMES, SKILL_COLORS, type Skill } from '../lib/games'
import { getLevel, resultsFor } from '../lib/store'

const ORDER: Skill[] = ['Hafıza', 'Dikkat', 'Hız', 'Dil', 'Hesap', 'Mantık']

export default function GamesPage() {
  const navigate = useNavigate()
  return (
    <div>
      <ZnHeader title="Oyunlar" subtitle="Her biri farklı bir yetiyi çalıştırır" />
      <div className="px-4 space-y-5">
        {ORDER.map((skill) => {
          const list = GAMES.filter((g) => g.skill === skill)
          if (list.length === 0) return null
          return (
            <section key={skill}>
              <h2 className="zn-label mb-2 px-1">{skill}</h2>
              <div className="space-y-2">
                {list.map((g) => {
                  const lv = getLevel(g.id)
                  const n = resultsFor(g.id).length
                  return (
                    <button
                      key={g.id}
                      onClick={() => navigate(`/oyna/${g.id}`)}
                      className="zn-card w-full flex items-center gap-3 text-left active:scale-[0.98] transition"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-[#241f38] grid place-items-center text-[30px] flex-shrink-0">
                        {g.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[18px] font-semibold text-slate-900 dark:text-[#ece8f7]">{g.name}</div>
                        <div className="text-[14px] text-slate-500 dark:text-[#8b849e]">{g.short}</div>
                        <div className="mt-1 flex items-center gap-2 text-[12px]">
                          <span className={`px-1.5 py-0.5 rounded-md font-semibold ${SKILL_COLORS[g.skill]}`}>{g.skill}</span>
                          <span className="text-slate-500 dark:text-[#8b849e]">
                            Seviye {lv}/{g.maxLevel}
                            {n > 0 ? ` · ${n} kez oynandı` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="text-[26px] text-slate-300 dark:text-[#4b4462]">›</div>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
