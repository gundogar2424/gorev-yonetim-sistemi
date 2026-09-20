import { useNavigate, useParams } from 'react-router-dom'
import SesHeader from '../SesHeader'
import { findExercise, GROUP_LABEL } from '../lib/content'
import { readSettings, repsFor, saveSettings } from '../lib/store'
import { useState } from 'react'
import VideoTabs from '../components/VideoTabs'

export default function ExerciseDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const e = findExercise(id)
  const [ayar, setAyar] = useState(readSettings())
  if (!e) {
    return (
      <div>
        <SesHeader title="Egzersiz" back />
        <p className="px-5 text-slate-700">Bulunamadı.</p>
      </div>
    )
  }
  const kapali = ayar.disabled.includes(e.id)
  const n = repsFor(e.reps, ayar)
  return (
    <div>
      <SesHeader title={e.name} subtitle={GROUP_LABEL[e.group]} back compact />
      <div className="px-4 space-y-5 pb-6">
        <section className="ses-card">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[28px]">{e.emoji}</span>
            <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">{e.short}</p>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="ses-pill">{e.mode === 'mpt' ? `${n} deneme` : e.mode === 'sure' ? `${n} set × ${e.hold} sn` : `${n} tekrar × ${e.hold} sn`}</span>
            <span className="ses-pill">ara: {e.rest} sn</span>
          </div>
        </section>

        <section className="ses-card">
          <h3 className="ses-label mb-2">Neden yapılır?</h3>
          <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">{e.why}</p>
        </section>

        <section className="ses-card">
          <h3 className="ses-label mb-2">Nasıl yapılır?</h3>
          <ol className="space-y-2">
            {e.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[16px] text-slate-700 dark:text-[#d8c8bf]">
                <span className="w-7 h-7 rounded-full bg-ses-600 text-white grid place-items-center text-[14px] font-bold flex-shrink-0">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 rounded-2xl bg-ses-50 dark:bg-[#352820] p-3 text-center">
            <div className="text-[13px] text-ses-700 dark:text-ses-300 font-semibold uppercase tracking-[0.08em]">Söylenecek</div>
            <div className="text-[22px] font-bold text-slate-900 dark:text-[#f5ece4]">{Array.isArray(e.cue) ? e.cue.join(' · ') : e.cue}</div>
          </div>
        </section>

        {e.caution && (
          <section className="ses-card bg-amber-50/70 dark:bg-[#2b2418]">
            <h3 className="ses-label mb-1">⚠️ Dikkat</h3>
            <p className="text-[16px] text-slate-700 dark:text-[#d8c8bf]">{e.caution}</p>
          </section>
        )}

        <VideoTabs id={e.id} clip={e.clip} title="Nasıl yapılır (video)" />
        <button className="ses-btn-primary w-full min-h-[58px] text-[18px]" onClick={() => navigate(`/seans?tek=${e.id}`)}>
          ▶ Yalnızca bunu yap
        </button>
        <button className="ses-btn-ghost w-full" onClick={() => setAyar(saveSettings({ disabled: kapali ? ayar.disabled.filter((x) => x !== e.id) : [...ayar.disabled, e.id] }))}>
          {kapali ? 'Seansa geri ekle' : 'Seanstan çıkar'}
        </button>
      </div>
    </div>
  )
}
