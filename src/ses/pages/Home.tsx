import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SesHeader from '../SesHeader'
import { DISCLAIMER, PROGRAM_DESC, PROGRAM_LABEL, PROGRAM_SHORT, tipOfDay, type Program } from '../lib/content'
import { activeDExercises, activeExercises, applyProgram, bestMpt, estimateDMinutes, estimateMinutes, readSessions, readSettings, saveSettings, sessionKind, sessionsToday, streakDays, weekGoal } from '../lib/store'
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
        <div className="px-4 space-y-5">
          <section className="ses-card space-y-3">
            <h2 className="text-[22px] font-bold text-slate-900 dark:text-[#f5ece4]">⚠️ Lütfen oku</h2>
            <ul className="space-y-2">
              {DISCLAIMER.map((m, i) => (
                <li key={i} className="flex gap-2 text-[17px] text-slate-700 dark:text-[#d8c8bf]">
                  <span className="text-ses-600">•</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
            <button className="ses-btn-primary w-full min-h-[68px] text-[21px]" onClick={() => setAyar(saveSettings({ accepted: true }))}>
              Anladım, başlayalım
            </button>
          </section>
        </div>
      </div>
    )
  }

  if (!ayar.program) {
    return (
      <div>
        <SesHeader title="Programını seç" subtitle="Durumuna en uygun egzersiz seti" />
        <div className="px-4 space-y-4 pb-6">
          <p className="text-[16px] text-slate-700 dark:text-[#e2d5cd] px-1">
            Araştırmalar iki farklı tabloya farklı egzersizler önerir. Seçimin egzersiz listesini ayarlar; istediğin zaman Ayarlar'dan değiştirebilir ya da tek tek düzenleyebilirsin. Emin değilsen hekimine/terapistine sor.
          </p>
          {(['felc', 'presbifoni', 'genel'] as Program[]).map((p) => (
            <button key={p} onClick={() => setAyar(applyProgram(p))} className="ses-card w-full text-left active:scale-[0.99] transition">
              <span className="block text-[20px] font-bold text-slate-900 dark:text-[#f5ece4]">{PROGRAM_LABEL[p]}</span>
              <span className="block text-[16px] text-slate-700 dark:text-[#e2d5cd] mt-1">{PROGRAM_DESC[p]}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <SesHeader title={`${selam()}${ayar.name ? `, ${ayar.name}` : ''}`} subtitle={PROGRAM_SHORT[ayar.program]} />

      <div className="px-4 space-y-5">
        {/* Seri */}
        <div className="rounded-3xl p-4 flex items-center gap-4 bg-gradient-to-br from-ses-600 to-ses-800 text-white shadow-raised">
          <div className="w-14 h-14 rounded-2xl bg-white/15 grid place-items-center text-[32px]">🔥</div>
          <div className="flex-1">
            <div className="text-[24px] font-bold leading-tight">{seri === 0 ? 'Bugün başla' : `${seri} gündür üst üste`}</div>
            <div className="text-[16px] text-white/80">
              {bugun > 0 ? `Bugün ${bugun} seans yaptın ✔` : seri === 0 ? 'Kısa ve düzenli seanslar en iyisi' : 'Bugün de bir seans yap'}
            </div>
          </div>
        </div>

        {/* Gunluk hedef */}
        <section className="ses-card">
          <div className="flex items-center justify-between">
            <h2 className="text-[19px] font-bold text-slate-900 dark:text-[#f5ece4]">🎯 Bugünün hedefi</h2>
            <span className={`ses-pill ${bugunOk ? '!bg-emerald-50 !text-emerald-700 dark:!bg-[#1f2e22] dark:!text-emerald-300' : ''}`}>
              {Math.min(bugun, ayar.dailyGoal)} / {ayar.dailyGoal} seans{bugunOk ? ' ✔' : ''}
            </span>
          </div>
          <div className="flex gap-2 mt-3">
            {Array.from({ length: ayar.dailyGoal }).map((_, i) => (
              <div key={i} className={`flex-1 h-3 rounded-full ${i < bugun ? 'bg-ses-600' : 'bg-slate-200 dark:bg-[#4a3a30]'}`} />
            ))}
          </div>
          <p className="text-[15px] text-slate-700 dark:text-[#d8c8bf] mt-2">
            {bugunOk ? 'Bugünlük tamam. Yarın yine görüşürüz.' : ayar.dailyGoal === 2 ? (bugun === 0 ? 'Sabah bir seans, akşam bir seans: araştırmalarda etkili bulunan doz.' : 'Bir seans daha kaldı (akşam için ideal).') : `${ayar.dailyGoal - bugun} seans kaldı.`}
          </p>
          <div className="flex items-end justify-between gap-1.5 mt-3">
            {hafta.map((g) => (
              <div key={g.key} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full grid place-items-center text-[15px] font-bold ${g.ok ? 'bg-ses-600 text-white' : g.count > 0 ? 'bg-ses-100 text-ses-700 dark:bg-[#4a3a30] dark:text-ses-300' : 'bg-slate-100 dark:bg-[#352820] text-slate-600 dark:text-[#cdbdb3]'}`}>
                  {g.ok ? '✓' : g.count > 0 ? g.count : '·'}
                </div>
                <span className="text-[14px] text-slate-700 dark:text-[#d8c8bf]">{g.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Seans */}
        <section className="ses-card">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[32px]">🎤</div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[21px] font-bold text-slate-900 dark:text-[#f5ece4] leading-tight">Rehberli seans</h2>
              <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">
                {n} egzersiz · yaklaşık {dk} dk · sayaç ve tekrar sayacı seni yönlendirir
              </p>
            </div>
          </div>
          <button className="ses-btn-primary w-full mt-3 text-[21px] min-h-[68px]" onClick={() => navigate('/seans')}>
            ▶ Seansa başla
          </button>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button className="ses-btn-soft min-h-[54px] text-[17px]" onClick={() => navigate('/seans?tek=pipet')}>
              🥤 2 dk pipet molası
            </button>
            <button className="ses-btn-ghost min-h-[54px] text-[17px]" onClick={() => navigate('/egzersizler')}>
              Egzersizleri incele
            </button>
          </div>
          <p className="text-[14px] text-slate-600 dark:text-[#cdbdb3] mt-2">Pipet molası: gün içinde birkaç kez 1-3 dk; ses tellerini az güçle, dengeli çalıştırır (yarı kapalı ses yolu).</p>
        </section>

        {/* Diksiyon */}
        <section className="ses-card">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[32px]">🗣️</div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[21px] font-bold text-slate-900 dark:text-[#f5ece4] leading-tight">Diksiyon seansı</h2>
              <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">
                {dn} egzersiz · yaklaşık {ddk} dk · nefes, harfler, tekerlemeler, vurgu
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className="ses-btn-primary text-[19px]" onClick={() => navigate('/diksiyon-seans')}>
              ▶ Başla
            </button>
            <button className="ses-btn-soft text-[19px]" onClick={() => navigate('/diksiyon')}>
              Egzersizler
            </button>
          </div>
        </section>

        {/* Olcum */}
        <section className="ses-card flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[32px]">⏱️</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[19px] font-bold text-slate-900 dark:text-[#f5ece4] leading-tight">Ses ölçümü</h2>
            <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">{best > 0 ? `Rekorun: ${best.toFixed(1).replace('.', ',')} sn` : 'En uzun "A" tutma süreni ölç'}</p>
          </div>
          <button className="ses-btn-soft min-h-[54px] px-4" onClick={() => navigate('/olcum')}>
            Ölç
          </button>
        </section>

        {/* Ipucu */}
        <section className="ses-card bg-amber-50/70 dark:bg-[#2b2418]">
          <h3 className="ses-label mb-1">Günün ipucu</h3>
          <p className="text-[17px] text-slate-700 dark:text-[#d8c8bf]">{tip}</p>
        </section>

        {/* Son seanslar */}
        {son.length > 0 && (
          <section className="ses-card">
            <div className="flex items-center justify-between mb-1">
              <h3 className="ses-label">Son seanslar</h3>
              <button className="text-[16px] text-ses-700 font-semibold" onClick={() => navigate('/ilerleme')}>
                Tümü
              </button>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-[#4a3a30]">
              {son.map((s) => (
                <li key={s.id} className="py-2 flex items-center justify-between text-[17px]">
                  <span className="text-slate-700 dark:text-[#d8c8bf]">{fmtShort(s.t)}</span>
                  <span className="text-slate-800 dark:text-[#f5ece4]">
                    {sessionKind(s) === 'diksiyon' ? '🗣️ ' : '🎤 '}
                    {s.done.length} egzersiz · {fmtMinutes(s.ms)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[15px] text-slate-600 dark:text-[#cdbdb3] px-1 pb-2">
          Ağrı, yanma ya da ses kısıklığında artış olursa dur ve hekimine haber ver. Bu uygulama tıbbi tedavinin yerini tutmaz.
        </p>
      </div>
    </div>
  )
}
