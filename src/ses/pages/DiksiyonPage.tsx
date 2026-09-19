import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SesHeader from '../SesHeader'
import { DEXERCISES, DGROUP_LABEL, DTEMPO_LABEL, type DExercise, type DGroup, type DTempo } from '../lib/diksiyon'
import { activeDExercises, dSecFor, estimateDMinutes, readSettings, saveSettings, sessionsToday } from '../lib/store'
import VideoButton from '../components/VideoButton'

export default function DiksiyonPage() {
  const navigate = useNavigate()
  const [ayar, setAyar] = useState(readSettings())
  const [acik, setAcik] = useState<string | null>(null)
  const groups: DGroup[] = ['nefes', 'sesli', 'unsuz', 'tekerleme', 'kalem', 'vurgu']
  const n = activeDExercises(ayar).length
  const bugun = sessionsToday('diksiyon')

  function toggle(e: DExercise) {
    const kapali = ayar.dDisabled.includes(e.id)
    setAyar(saveSettings({ dDisabled: kapali ? ayar.dDisabled.filter((x) => x !== e.id) : [...ayar.dDisabled, e.id] }))
  }

  return (
    <div>
      <SesHeader title="Diksiyon" subtitle="Net, anlaşılır ve akıcı konuşma" />
      <div className="px-4 space-y-5 pb-6">
        <section className="ses-card">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[32px]">🗣️</div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[21px] font-bold text-slate-900 dark:text-[#f5ece4] leading-tight">Diksiyon seansı</h2>
              <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">
                {n} egzersiz · yaklaşık {estimateDMinutes(ayar)} dk{bugun > 0 ? ` · bugün ${bugun} seans ✔` : ''}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-[15px] text-slate-700 dark:text-[#d8c8bf]">Okuma temposu</span>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(['yavas', 'orta', 'hizli'] as DTempo[]).map((v) => (
                <button key={v} onClick={() => setAyar(saveSettings({ dTempo: v }))} className={`min-h-[52px] rounded-2xl text-[17px] font-semibold transition ${ayar.dTempo === v ? 'bg-ses-600 text-white' : 'bg-slate-100 dark:bg-[#352820] text-slate-700 dark:text-[#f5ece4]'}`}>
                  {DTEMPO_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
          <button className="ses-btn-primary w-full mt-3 text-[21px] min-h-[68px]" onClick={() => navigate('/diksiyon-seans')} disabled={n === 0}>
            ▶ Seansa başla
          </button>
        </section>

        <button className="ses-btn-soft w-full" onClick={() => navigate('/videolar')}>
          🎬 Tüm videolar
        </button>
        <p className="text-[15px] text-slate-700 dark:text-[#d8c8bf] px-1">
          Egzersize dokun: açıklama ve "yalnızca bunu yap". Onay kutusu seansa dahil olup olmadığını belirler.
        </p>

        {groups.map((g) => (
          <section key={g}>
            <h3 className="ses-label px-1 mb-2">{DGROUP_LABEL[g]}</h3>
            <div className="space-y-2">
              {DEXERCISES.filter((e) => e.group === g).map((e) => {
                const kapali = ayar.dDisabled.includes(e.id)
                const acikMi = acik === e.id
                return (
                  <div key={e.id} className={`ses-card ${kapali ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggle(e)}
                        aria-label={kapali ? 'Seansa ekle' : 'Seanstan çıkar'}
                        className={`w-9 h-9 rounded-xl flex-shrink-0 grid place-items-center border-2 transition ${kapali ? 'border-slate-300 dark:border-[#4a3a30]' : 'bg-ses-600 border-ses-600 text-white'}`}
                      >
                        {!kapali && (
                          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3}>
                            <path d="M5 12l5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <button className="flex-1 min-w-0 text-left" onClick={() => setAcik(acikMi ? null : e.id)}>
                        <span className="block text-[19px] font-semibold text-slate-900 dark:text-[#f5ece4] leading-tight">
                          {e.emoji} {e.name}
                        </span>
                        <span className="block text-[15px] text-slate-700 dark:text-[#d8c8bf] mt-0.5">
                          {e.reps} × {dSecFor(e.sec, ayar)} sn · {e.short}
                        </span>
                      </button>
                    </div>
                    {acikMi && (
                      <div className="mt-3 space-y-3 ses-pop">
                        <p className="text-[16px] text-slate-700 dark:text-[#e2d5cd]">
                          <b>Neden:</b> {e.why}
                        </p>
                        <ol className="space-y-1.5">
                          {e.steps.map((s, i) => (
                            <li key={i} className="flex gap-2 text-[16px] text-slate-700 dark:text-[#d8c8bf]">
                              <span className="w-6 h-6 rounded-full bg-ses-600 text-white grid place-items-center text-[14px] font-bold flex-shrink-0">{i + 1}</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ol>
                        <div className="rounded-2xl bg-ses-50 dark:bg-[#352820] p-3 text-[17px] text-slate-800 dark:text-[#f5ece4] space-y-1">
                          {e.lines.slice(0, 3).map((l, i) => (
                            <div key={i}>{l}</div>
                          ))}
                          {e.lines.length > 3 && <div className="text-[15px] text-slate-700 dark:text-[#d8c8bf]">… ve {e.lines.length - 3} satır daha</div>}
                        </div>
                        {e.tip && <p className="text-[15px] text-amber-800 dark:text-amber-200">⚠️ {e.tip}</p>}
                        <VideoButton video={e.video} compact />
                        <button className="ses-btn-soft w-full" onClick={() => navigate(`/diksiyon-seans?tek=${e.id}`)}>
                          ▶ Yalnızca bunu yap
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
