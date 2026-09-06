import ZnHeader from '../ZnHeader'
import { GAMES } from '../lib/games'
import { getLevel, lastDaysActivity, readResults, resultsFor, streakDays, totalMinutes } from '../lib/store'

export default function ProgressPage() {
  const all = readResults()
  const gunler = lastDaysActivity(7)
  const maxGun = Math.max(1, ...gunler.map((g) => g.count))
  const seri = streakDays()

  return (
    <div>
      <ZnHeader title="Gelişim" subtitle="Düzenlilik, seviyeden önemlidir" />
      <div className="px-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat num={all.length} label="oturum" />
          <Stat num={totalMinutes(all)} label="dakika" />
          <Stat num={seri} label="günlük seri" />
        </div>

        <section className="zn-card">
          <h2 className="zn-label mb-3">Son 7 gün</h2>
          <div className="flex items-end justify-between gap-2 h-28">
            {gunler.map((g, i) => {
              const bugun = i === gunler.length - 1
              const h = g.count === 0 ? 6 : Math.max(14, Math.round((g.count / maxGun) * 96))
              return (
                <div key={g.key} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="text-[12px] tabular-nums text-slate-500 dark:text-[#8b849e]">{g.count || ''}</div>
                  <div
                    className={`w-full max-w-[34px] rounded-lg transition-all ${
                      g.count === 0 ? 'bg-slate-200/70 dark:bg-[#2a2440]' : bugun ? 'bg-zn-600' : 'bg-zn-300'
                    }`}
                    style={{ height: h }}
                  />
                  <div className={`text-[12px] ${bugun ? 'font-bold text-zn-700 dark:text-zn-300' : 'text-slate-500 dark:text-[#8b849e]'}`}>
                    {g.label}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="zn-label px-1">Oyunlara göre</h2>
          {GAMES.map((g) => {
            const rs = resultsFor(g.id)
            const son = rs.slice(-8)
            const lv = getLevel(g.id)
            const ort = rs.length ? Math.round(rs.reduce((s, r) => s + r.sc, 0) / rs.length) : 0
            return (
              <div key={g.id} className="zn-card flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-[#241f38] grid place-items-center text-[26px] flex-shrink-0">
                  {g.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-semibold text-slate-900 dark:text-[#ece8f7] truncate">{g.name}</div>
                  <div className="text-[13px] text-slate-500 dark:text-[#8b849e]">
                    Seviye {lv}
                    {rs.length ? ` · ${rs.length} oturum · ort. %${ort}` : ' · henüz oynanmadı'}
                  </div>
                </div>
                {/* Son 8 oturumun basari cubuklari */}
                <div className="flex items-end gap-[3px] h-9 w-[76px] justify-end">
                  {son.map((r, i) => (
                    <div
                      key={i}
                      title={`%${r.sc}`}
                      className={`w-[7px] rounded-sm ${r.ok ? 'bg-emerald-400' : 'bg-amber-300'}`}
                      style={{ height: `${Math.max(12, r.sc)}%` }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </section>

        <p className="text-[13px] text-slate-500 dark:text-[#8b849e] px-1 pb-2">
          Puanlar kendi ilerlemenizi görmeniz içindir; tıbbi bir ölçüm değildir. Unutkanlık endişeniz varsa bir nöroloğa başvurun.
        </p>
      </div>
    </div>
  )
}

function Stat({ num, label }: { num: number; label: string }) {
  return (
    <div className="zn-card text-center py-3">
      <div className="text-[28px] font-bold tabular-nums text-slate-900 dark:text-[#ece8f7] leading-none">{num}</div>
      <div className="text-[12px] text-slate-500 dark:text-[#8b849e] mt-1">{label}</div>
    </div>
  )
}
