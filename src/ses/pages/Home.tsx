import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SesHeader from '../SesHeader'
import { DISCLAIMER, PROGRAM_DESC, PROGRAM_LABEL, PROGRAM_SHORT, tipOfDay, type Program } from '../lib/content'
import { activeDExercises, activeExercises, applyProgram, bestMpt, estimateDMinutes, estimateMinutes, readSessions, readSettings, saveSettings, sessionKind, sessionsToday, streakDays, weekGoal } from '../lib/store'
import { fmtMinutes, fmtShort } from '../lib/date'
import Icon from '../components/Icon'

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
          <section className="ses-card">
            <div className="flex items-center gap-2 text-ses-700 dark:text-ses-300">
              <Icon name="alert" size={18} />
              <h2 className="ses-label !text-ses-700 dark:!text-ses-300">Lütfen oku</h2>
            </div>
            <ul className="mt-3 space-y-3">
              {DISCLAIMER.map((m, i) => (
                <li key={i} className="ses-row text-[15px] leading-relaxed text-sesui-body dark:text-sesui-dbody">
                  {m}
                </li>
              ))}
            </ul>
          </section>
          <button className="ses-btn-primary w-full" onClick={() => setAyar(saveSettings({ accepted: true }))}>
            Anladım, başlayalım
          </button>
        </div>
      </div>
    )
  }

  if (!ayar.program) {
    return (
      <div>
        <SesHeader title="Programını seç" subtitle="Durumuna en uygun egzersiz seti" />
        <div className="px-4 space-y-4 pb-6">
          <p className="text-[15px] text-sesui-body dark:text-sesui-dbody px-1">
            Araştırmalar iki farklı tabloya farklı egzersizler önerir. Seçimin egzersiz listesini ayarlar; istediğin zaman Ayarlar'dan değiştirebilir ya da tek tek düzenleyebilirsin. Emin değilsen hekimine/terapistine sor.
          </p>
          {(['felc', 'presbifoni', 'genel'] as Program[]).map((p) => (
            <button key={p} onClick={() => setAyar(applyProgram(p))} className="ses-card w-full text-left flex items-center gap-3 active:bg-sesui-soft transition">
              <span className="flex-1 min-w-0">
                <span className="block text-[17px] font-semibold text-sesui-text dark:text-sesui-dtext">{PROGRAM_LABEL[p]}</span>
                <span className="block text-[14px] text-sesui-muted dark:text-sesui-dmuted mt-0.5 leading-relaxed">{PROGRAM_DESC[p]}</span>
              </span>
              <Icon name="chevron" size={18} className="text-sesui-line dark:text-[#5a504a]" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <SesHeader title={`${selam()}${ayar.name ? `, ${ayar.name}` : ''}`} subtitle={PROGRAM_SHORT[ayar.program]} />

      <div className="px-4 space-y-6 pb-2">
        {/* Bugun: hedef, seri ve hafta seridi tek kartta */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-0.5">
            <h2 className="ses-label">Bugün</h2>
            {seri > 0 && (
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ses-700 dark:text-ses-300">
                <Icon name="flame" size={14} />
                {seri} gün üst üste
              </span>
            )}
          </div>
          <div className="ses-card">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[34px] font-semibold leading-none tabular-nums text-sesui-text dark:text-sesui-dtext">
                  {bugun}
                  <span className="text-[20px] font-normal text-sesui-muted/70 dark:text-[#6f645d]"> / {ayar.dailyGoal}</span>
                </div>
                <div className="text-[13px] text-sesui-muted dark:text-sesui-dmuted mt-1">seans</div>
              </div>
              {bugunOk && (
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
                  <Icon name="check" size={15} />
                  Tamam
                </span>
              )}
            </div>
            <div className="flex gap-1.5 mt-3">
              {Array.from({ length: ayar.dailyGoal }).map((_, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full ${i < bugun ? 'bg-ses-600' : 'bg-sesui-line dark:bg-[#2f2823]'}`} />
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-sesui-muted dark:text-sesui-dmuted mt-2.5">
              {bugunOk ? 'Bugünlük tamam. Yarın yine görüşürüz.' : ayar.dailyGoal === 2 ? (bugun === 0 ? 'Sabah bir seans, akşam bir seans: araştırmalarda etkili bulunan doz.' : 'Bir seans daha kaldı (akşam için ideal).') : `${ayar.dailyGoal - bugun} seans kaldı.`}
            </p>
            <div className="ses-row flex items-end justify-between gap-1">
              {hafta.map((g) => (
                <div key={g.key} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full h-8 flex items-end justify-center">
                    <div
                      className={`w-full rounded-[3px] ${g.ok ? 'bg-ses-600' : g.count > 0 ? 'bg-ses-300 dark:bg-ses-700' : 'bg-sesui-line dark:bg-sesui-dline'}`}
                      style={{ height: g.count > 0 ? `${Math.min(100, 45 + g.count * 28)}%` : '3px' }}
                    />
                  </div>
                  <span className="text-[11px] text-sesui-muted dark:text-sesui-dmuted">{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Seanslar */}
        <section className="space-y-2">
          <h2 className="ses-label px-0.5">Seans</h2>
          <div className="ses-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[17px] font-semibold text-sesui-text dark:text-sesui-dtext leading-tight">Rehberli ses seansı</h3>
                <p className="text-[13px] text-sesui-muted dark:text-sesui-dmuted mt-0.5">
                  {n} egzersiz · yaklaşık {dk} dk
                </p>
              </div>
              <Icon name="mic" size={20} className="text-sesui-line dark:text-[#5a504a] mt-0.5" />
            </div>
            <button className="ses-btn-primary w-full mt-3" onClick={() => navigate('/seans')}>
              <Icon name="play" size={16} />
              Seansa başla
            </button>
            <div className="ses-row grid grid-cols-2 gap-2">
              <button className="ses-btn-ghost min-h-[44px] text-[14px]" onClick={() => navigate('/seans?tek=pipet')}>
                <Icon name="straw" size={16} />
                Pipet molası
              </button>
              <button className="ses-btn-ghost min-h-[44px] text-[14px]" onClick={() => navigate('/videolar')}>
                <Icon name="video" size={16} />
                Videolar
              </button>
            </div>
          </div>

          <button className="ses-card w-full text-left flex items-center gap-3 active:bg-sesui-soft transition" onClick={() => navigate('/diksiyon-seans')}>
            <Icon name="speech" size={20} className="text-sesui-muted/70 dark:text-sesui-dmuted" />
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-semibold text-sesui-text dark:text-sesui-dtext leading-tight">Diksiyon seansı</span>
              <span className="block text-[13px] text-sesui-muted dark:text-sesui-dmuted mt-0.5">
                {dn} egzersiz · yaklaşık {ddk} dk
              </span>
            </span>
            <Icon name="chevron" size={18} className="text-sesui-line dark:text-[#5a504a]" />
          </button>

          <button className="ses-card w-full text-left flex items-center gap-3 active:bg-sesui-soft transition" onClick={() => navigate('/olcum')}>
            <Icon name="clock" size={20} className="text-sesui-muted/70 dark:text-sesui-dmuted" />
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-semibold text-sesui-text dark:text-sesui-dtext leading-tight">Ses ölçümü</span>
              <span className="block text-[13px] text-sesui-muted dark:text-sesui-dmuted mt-0.5">{best > 0 ? `En iyi: ${best.toFixed(1).replace('.', ',')} sn` : 'En uzun "A" tutma süreni ölç'}</span>
            </span>
            <Icon name="chevron" size={18} className="text-sesui-line dark:text-[#5a504a]" />
          </button>
        </section>

        {/* Ipucu */}
        <section className="space-y-2">
          <h2 className="ses-label px-0.5">Günün ipucu</h2>
          <div className="ses-card flex gap-3">
            <Icon name="info" size={18} className="text-ses-600 dark:text-ses-300 mt-0.5" />
            <p className="text-[15px] leading-relaxed text-sesui-body dark:text-sesui-dbody">{tip}</p>
          </div>
        </section>

        {/* Son seanslar */}
        {son.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="ses-label">Son seanslar</h2>
              <button className="text-[13px] font-medium text-ses-700 dark:text-ses-300 inline-flex items-center gap-1" onClick={() => navigate('/ilerleme')}>
                Tümü
                <Icon name="chevron" size={14} />
              </button>
            </div>
            <div className="ses-card">
              {son.map((s) => (
                <div key={s.id} className="ses-row flex items-center gap-3">
                  <Icon name={sessionKind(s) === 'diksiyon' ? 'speech' : 'mic'} size={16} className="text-sesui-muted/70 dark:text-sesui-dmuted" />
                  <span className="flex-1 text-[15px] text-sesui-text dark:text-[#e4dbd4]">{s.done.length} egzersiz</span>
                  <span className="text-[13px] tabular-nums text-sesui-muted dark:text-sesui-dmuted">
                    {fmtShort(s.t)} · {fmtMinutes(s.ms)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-[13px] leading-relaxed text-sesui-muted dark:text-sesui-dmuted px-0.5 pb-2">
          Ağrı, yanma ya da ses kısıklığında artış olursa dur ve hekimine haber ver. Bu uygulama tıbbi tedavinin yerini tutmaz.
        </p>
      </div>
    </div>
  )
}
