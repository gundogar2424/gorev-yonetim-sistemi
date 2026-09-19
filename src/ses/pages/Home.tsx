import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SesHeader from '../SesHeader'
import { DISCLAIMER, tipOfDay } from '../lib/content'
import { activeDExercises, activeExercises, bestMpt, estimateDMinutes, estimateMinutes, readSessions, readSettings, saveSettings, sessionKind, sessionsToday, streakDays, weekGoal } from '../lib/store'
import { fmtMinutes, fmtShort } from '../lib/date'

function selam(): string {
  const h = new Date().getHours()
  if (h < 6) return 'İyi geceler'
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

export default function Home() {
  const navigate = useNavigate()
  const [ayar, setAyar] = useState(readSettings())
  const seri = streakDays()
  const bugun = sessionsToday()
  const son = readSessions().slice(-3).reverse()
  const best = bestMpt()
  const dk = estimateMinutes(ayar)
  const n = activeExercises(ayar).length
  const dn = activeDExercises(ayar).length
  const ddk = estimateDMinutes(ayar)
  const tip = tipOfDay(Math.floor(Date.now() / 86400000))
  const hafta = weekGoal(ayar.dailyGoal)
  const bugunOk = bugun >= ayar.dailyGoal

  if (!ayar.accepted) {
    return (
      <div>
        <SesHeader title="Hoş geldin" subtitle="Ses Egzersizi · başlamadan önce" />
        <div className="px-4 space-y-4">
          <section className="ses-card space-y-3">
            <h2 className="text-[20px] font-bold text-slate-900 dark:text-[#f5ece4]">⚠️ Lütfen oku</h2>
            <ul className="space-y-2">
              {DISCLAIMER.map((m, i) => (
                <li key={i} className="flex gap-2 text-[15px] text-slate-700 dark:text-[#d8c8bf]">
                  <span className="text-ses-600">•</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
            <button className="ses-btn-primary w-full min-h-[62px] text-[19px]" onClick={() => setAyar(saveSettings({ accepted: true }))}>
              Anladım, başlayalım
            </button>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div>
      <SesHeader title={`${selam()}${ayar.name ? `, ${ayar.name}` : ''}`} subtitle="Ses Egzersizi · ses tellerini güçlendir" />

      <div className="px-4 space-y-4">
        {/* Seri */}
        <div className="rounded-3xl p-4 flex items-center gap-4 bg-gradient-to-br from-ses-600 to-ses-800 text-white shadow-raised">
          <div className="w-14 h-14 rounded-2xl bg-white/15 grid place-items-center text-[30px]">🔥</div>
          <div className="flex-1">
            <div className="text-[22px] font-bold leading-tight">{seri === 0 ? 'Bugün başla' : `${seri} gündür üst üste`}</div>
            <div className="text-[14px] text-white/80">
              {bugun > 0 ? `Bugün ${bugun} seans yaptın ✔` : seri === 0 ? 'Kısa ve düzenli seanslar en iyisi' : 'Bugün de bir seans yap'}
            </div>
          </div>
        </div>

        {/* Gunluk hedef */}
        <section className="ses-card">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-slate-900 dark:text-[#f5ece4]">🎯 Bugünün hedefi</h2>
            <span className={`ses-pill ${bugunOk ? '!bg-emerald-50 !text-emerald-700 dark:!bg-[#1f2e22] dark:!text-emerald-300' : ''}`}>
              {Math.min(bugun, ayar.dailyGoal)} / {ayar.dailyGoal} seans{bugunOk ? ' ✔' : ''}
            </span>
          </div>
          <div className="flex gap-2 mt-3">
            {Array.from({ length: ayar.dailyGoal }).map((_, i) => (
              <div key={i} className={`flex-1 h-3 rounded-full ${i < bugun ? 'bg-ses-600' : 'bg-slate-200 dark:bg-[#4a3a30]'}`} />
            ))}
          </div>
          <p className="text-[13px] text-slate-500 dark:text-[#a3908a] mt-2">
            {bugunOk ? 'Bugünlük tamam. Yarın yine görüşürüz.' : ayar.dailyGoal === 2 ? (bugun === 0 ? 'Sabah bir seans, akşam bir seans: araştırmalarda etkili bulunan doz.' : 'Bir seans daha kaldı (akşam için ideal).') : `${ayar.dailyGoal - bugun} seans kaldı.`}
          </p>
          <div className="flex items-end justify-between gap-1.5 mt-3">
            {hafta.map((g) => (
              <div key={g.key} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full grid place-items-center text-[13px] font-bold ${g.ok ? 'bg-ses-600 text-white' : g.count > 0 ? 'bg-ses-100 text-ses-700 dark:bg-[#4a3a30] dark:text-ses-300' : 'bg-slate-100 dark:bg-[#352820] text-slate-400 dark:text-[#a3908a]'}`}>
                  {g.ok ? '✓' : g.count > 0 ? g.count : '·'}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-[#a3908a]">{g.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Seans */}
        <section className="ses-card">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[30px]">🎤</div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[19px] font-bold text-slate-900 dark:text-[#f5ece4] leading-tight">Rehberli seans</h2>
              <p className="text-[14px] text-slate-500 dark:text-[#a3908a]">
                {n} egzersiz · yaklaşık {dk} dk · sayaç ve tekrar sayacı seni yönlendirir
              </p>
            </div>
          </div>
          <button className="ses-btn-primary w-full mt-3 text-[19px] min-h-[62px]" onClick={() => navigate('/seans')}>
            ▶ Seansa başla
          </button>
          <button className="w-full text-[14px] text-slate-500 dark:text-[#a3908a] underline pt-3" onClick={() => navigate('/egzersizler')}>
            Egzersizleri önce incele
          </button>
        </section>

        {/* Diksiyon */}
        <section className="ses-card">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[30px]">🗣️</div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[19px] font-bold text-slate-900 dark:text-[#f5ece4] leading-tight">Diksiyon seansı</h2>
              <p className="text-[14px] text-slate-500 dark:text-[#a3908a]">
                {dn} egzersiz · yaklaşık {ddk} dk · nefes, harfler, tekerlemeler, vurgu
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className="ses-btn-primary text-[17px]" onClick={() => navigate('/diksiyon-seans')}>
              ▶ Başla
            </button>
            <button className="ses-btn-soft text-[17px]" onClick={() => navigate('/diksiyon')}>
              Egzersizler
            </button>
          </div>
        </section>

        {/* Olcum */}
        <section className="ses-card flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[30px]">⏱️</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-bold text-slate-900 dark:text-[#f5ece4] leading-tight">Ses ölçümü</h2>
            <p className="text-[14px] text-slate-500 dark:text-[#a3908a]">{best > 0 ? `Rekorun: ${best.toFixed(1).replace('.', ',')} sn` : 'En uzun "A" tutma süreni ölç'}</p>
          </div>
          <button className="ses-btn-soft min-h-[48px] px-4" onClick={() => navigate('/olcum')}>
            Ölç
          </button>
        </section>

        {/* Ipucu */}
        <section className="ses-card bg-amber-50/70 dark:bg-[#2b2418]">
          <h3 className="ses-label mb-1">Günün ipucu</h3>
          <p className="text-[15px] text-slate-700 dark:text-[#d8c8bf]">{tip}</p>
        </section>

        {/* Son seanslar */}
        {son.length > 0 && (
          <section className="ses-card">
            <div className="flex items-center justify-between mb-1">
              <h3 className="ses-label">Son seanslar</h3>
              <button className="text-[14px] text-ses-700 font-semibold" onClick={() => navigate('/ilerleme')}>
                Tümü
              </button>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-[#4a3a30]">
              {son.map((s) => (
                <li key={s.id} className="py-2 flex items-center justify-between text-[15px]">
                  <span className="text-slate-500 dark:text-[#a3908a]">{fmtShort(s.t)}</span>
                  <span className="text-slate-800 dark:text-[#f5ece4]">
                    {sessionKind(s) === 'diksiyon' ? '🗣️ ' : '🎤 '}
                    {s.done.length} egzersiz · {fmtMinutes(s.ms)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[12px] text-slate-400 dark:text-[#a3908a] px-1 pb-2">
          Ağrı, yanma ya da ses kısıklığında artış olursa dur ve hekimine haber ver. Bu uygulama tıbbi tedavinin yerini tutmaz.
        </p>
      </div>
    </div>
  )
}
