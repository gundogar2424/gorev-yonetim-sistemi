import { Link } from 'react-router-dom'
import SesHeader from '../SesHeader'
import { EXERCISES, GROUP_LABEL, type Group } from '../lib/content'
import { readSettings, repsFor } from '../lib/store'

export default function ExercisesPage() {
  const ayar = readSettings()
  const groups: Group[] = ['isinma', 'ana', 'sogutma']
  return (
    <div>
      <SesHeader title="Egzersizler" subtitle="Dokun: nasıl yapılır, neden yapılır" />
      <div className="px-4 space-y-5">
        {groups.map((g) => (
          <section key={g}>
            <h3 className="ses-label px-1 mb-2">{GROUP_LABEL[g]}</h3>
            <div className="space-y-2">
              {EXERCISES.filter((e) => e.group === g).map((e) => {
                const kapali = ayar.disabled.includes(e.id)
                const n = repsFor(e.reps, ayar)
                return (
                  <Link key={e.id} to={`/egzersiz/${e.id}`} className={`ses-card flex items-center gap-3 active:scale-[0.99] transition ${kapali ? 'opacity-55' : ''}`}>
                    <span className="w-12 h-12 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[28px] flex-shrink-0">{e.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[19px] font-semibold text-slate-900 dark:text-[#f5ece4] leading-tight">{e.name}</span>
                      <span className="block text-[15px] text-slate-700 dark:text-[#d8c8bf] mt-0.5">
                        {kapali ? 'Kapalı (Ayarlar)' : e.mode === 'mpt' ? `${n} deneme` : e.mode === 'sure' ? `${n} × ${e.hold} sn` : `${n} tekrar × ${e.hold} sn`}
                      </span>
                    </span>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-300 dark:text-[#cdbdb3]" fill="none" stroke="currentColor" strokeWidth={2.2}>
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
        <p className="text-[15px] text-slate-700 dark:text-[#d8c8bf] px-1 pb-2">
          Hangi egzersizlerin sana uygun olduğunu hekimin/terapistin belirler; uygun olmayanları Ayarlar'dan kapatabilirsin.
        </p>
      </div>
    </div>
  )
}
