import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import EftHeader from '../EftHeader'
import { HUNGER_ISSUES, ISSUES, QUICK_FOODS, tipOfDay } from '../lib/content'
import { readRecentFoods, readSessions, readSettings, sessionsToday, streakDays } from '../lib/store'
import { dayNumber, fmtShort } from '../lib/date'
import { sudsColor } from '../components/SudsPicker'

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
  const seri = streakDays()
  const bugun = sessionsToday()
  const son = readSessions().slice(-3).reverse()
  const tip = tipOfDay(dayNumber())
  const hizli = ISSUES.slice(0, 6)
  const [yemek, setYemek] = useState('')
  const sonYemek = readRecentFoods()
  const yemekCipleri = [...sonYemek, ...QUICK_FOODS.filter((q) => !sonYemek.some((s) => s.toLocaleLowerCase('tr') === q))].slice(0, 6)
  function yemekGit(x: string) {
    if (!x.trim()) return
    navigate(`/seans?yemek=${encodeURIComponent(x.trim())}`)
  }

  return (
    <div>
      <EftHeader title={`${selam()}${ayar.name ? `, ${ayar.name}` : ''}`} subtitle="EFT Dokunma · birkaç dakikada rahatla" />

      <div className="px-4 space-y-4">
        {/* Seri */}
        <div className="eft-card flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-[#2b2a1a] grid place-items-center text-[30px]">🔥</div>
          <div className="flex-1">
            <div className="text-[22px] font-bold text-slate-900 dark:text-[#e8f2f1] leading-tight">
              {seri === 0 ? 'Bugün başla' : `${seri} gündür üst üste`}
            </div>
            <div className="text-[14px] text-slate-500 dark:text-[#7f9896]">
              {bugun > 0 ? `Bugün ${bugun} seans yaptın ✔` : seri === 0 ? 'Küçük ve düzenli adımlar en iyisi' : 'Bugün de bir seans yap'}
            </div>
          </div>
        </div>

        {/* Yemek istegi */}
        <section className="eft-card bg-amber-50/60 dark:bg-[#2b2a1a]">
          <h2 className="text-[19px] font-bold text-slate-900 dark:text-[#e8f2f1] mb-1">🍽️ Canın bir şey mi çekiyor?</h2>
          <p className="text-[14px] text-slate-500 dark:text-[#7f9896] mb-3">Yemeği yaz, ona özel telkinleri al; istersen vuruşlarla söndür.</p>
          <div className="flex gap-2">
            <input
              className="eft-input flex-1"
              placeholder="örn. çikolata"
              value={yemek}
              onChange={(e) => setYemek(e.target.value.slice(0, 40))}
              onKeyDown={(e) => e.key === 'Enter' && yemekGit(yemek)}
            />
            <button className="eft-btn-primary px-4" disabled={!yemek.trim()} onClick={() => yemekGit(yemek)} aria-label="Telkinleri göster">
              Telkin
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {yemekCipleri.map((f) => (
              <button key={f} className="eft-pill min-h-[36px] px-3 text-[14px]" onClick={() => yemekGit(f)}>
                {f}
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-amber-100 dark:border-[#3a3820]">
            <div className="eft-label mb-2">Açlığı bastır</div>
            <div className="grid grid-cols-2 gap-2">
              {HUNGER_ISSUES.map((h) => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/seans?konu=${h.id}&telkin=1`)}
                  className="flex items-center gap-2 rounded-2xl bg-white dark:bg-[#1e3231] p-2.5 text-left transition active:scale-[0.98]"
                >
                  <span className="text-[20px]">{h.emoji}</span>
                  <span className="text-[13px] font-semibold text-slate-800 dark:text-[#e8f2f1] leading-tight">{h.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Yeni seans */}
        <section className="eft-card">
          <h2 className="text-[19px] font-bold text-slate-900 dark:text-[#e8f2f1] mb-1">Şu an seni ne rahatsız ediyor?</h2>
          <p className="text-[14px] text-slate-500 dark:text-[#7f9896] mb-3">Bir konu seç, yoğunluğunu puanla, rehberle birlikte vur.</p>
          <div className="grid grid-cols-2 gap-2">
            {hizli.map((i) => (
              <button
                key={i.id}
                onClick={() => navigate(`/seans?konu=${i.id}`)}
                className="flex items-center gap-2.5 rounded-2xl bg-slate-50 dark:bg-[#1e3231] p-3 text-left transition active:scale-[0.98]"
              >
                <span className="text-[24px]">{i.emoji}</span>
                <span className="text-[15px] font-semibold text-slate-800 dark:text-[#e8f2f1] leading-tight">{i.name}</span>
              </button>
            ))}
          </div>
          <button className="eft-btn-primary w-full mt-3 text-[19px] min-h-[62px]" onClick={() => navigate('/seans')}>
            Seansa başla
          </button>
        </section>

        {/* Son seanslar */}
        {son.length > 0 && (
          <section className="eft-card">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-[17px] font-bold text-slate-900 dark:text-[#e8f2f1]">Son seanslar</h3>
              <Link to="/gecmis" className="text-[14px] font-semibold text-eft-700 dark:text-eft-300">
                Tümü ›
              </Link>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-[#2b4442]">
              {son.map((s) => (
                <li key={s.id} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-slate-800 dark:text-[#e8f2f1] truncate">{s.issue}</div>
                    <div className="text-[13px] text-slate-500 dark:text-[#7f9896]">{fmtShort(s.t)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[15px] font-bold tabular-nums">
                    <span style={{ color: sudsColor(s.before) }}>{s.before}</span>
                    <span className="text-slate-300 dark:text-[#5f7a78]">→</span>
                    <span style={{ color: sudsColor(s.after) }}>{s.after}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Ipucu */}
        <section className="eft-card bg-eft-50 dark:bg-[#1e3231]">
          <h3 className="eft-label mb-1.5">Günün ipucu</h3>
          <p className="text-[16px] leading-relaxed text-slate-800 dark:text-[#d5e6e4]">{tip}</p>
        </section>

        <div className="text-center pb-2">
          <Link to="/noktalar" className="text-eft-700 dark:text-eft-300 font-semibold text-[16px]">
            İlk kez mi? Nasıl yapılır ›
          </Link>
        </div>
      </div>
    </div>
  )
}
