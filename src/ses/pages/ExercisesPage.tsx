import { Link } from 'react-router-dom'
import SesHeader from '../SesHeader'
import { EXERCISES, GROUP_LABEL, type Group } from '../lib/content'
import { readSettings, repsFor } from '../lib/store'
import Icon from '../components/Icon'

export default function ExercisesPage() {
  const ayar = readSettings()
  const groups: Group[] = ['isinma', 'ana', 'sogutma']
  return (
    <div>
      <SesHeader title="Egzersizler" subtitle="Dokun: nasıl yapılır, neden yapılır" />
      <div className="px-4 space-y-5">
        <Link to="/videolar" className="ses-card flex items-center gap-3 active:bg-sesui-soft transition">
          <Icon name="video" size={20} className="text-sesui-muted dark:text-sesui-dmuted" />
          <span className="flex-1 min-w-0">
            <span className="block text-[16px] font-semibold text-sesui-text dark:text-sesui-dtext leading-tight">Tüm videolar</span>
            <span className="block text-[13px] text-sesui-muted dark:text-sesui-dmuted mt-0.5">Egzersizlerin nasıl yapıldığını izle</span>
          </span>
          <Icon name="chevron" size={18} className="text-sesui-line dark:text-sesui-dmuted" />
        </Link>
        {groups.map((g) => (
          <section key={g}>
            <h3 className="ses-label px-1 mb-2">{GROUP_LABEL[g]}</h3>
            <div className="space-y-2">
              {EXERCISES.filter((e) => e.group === g).map((e, i) => {
                const kapali = ayar.disabled.includes(e.id)
                const n = repsFor(e.reps, ayar)
                return (
                  <Link key={e.id} to={`/egzersiz/${e.id}`} className={`ses-card flex items-center gap-3 active:bg-sesui-soft transition ${kapali ? 'opacity-50' : ''}`}>
                    <span className="ses-index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[16px] font-semibold text-sesui-text dark:text-sesui-dtext leading-tight">{e.name}</span>
                      <span className="flex items-center gap-1.5 text-[13px] text-sesui-muted dark:text-sesui-dmuted mt-0.5">
                        {kapali ? 'Kapalı (Ayarlar)' : e.mode === 'mpt' ? `${n} deneme` : e.mode === 'sure' ? `${n} × ${e.hold} sn` : `${n} tekrar × ${e.hold} sn`}
                        {e.clip && <Icon name="video" size={13} className="text-sesui-muted/70 dark:text-sesui-dmuted" />}
                      </span>
                    </span>
                    <Icon name="chevron" size={18} className="text-sesui-line dark:text-sesui-dmuted" />
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
        <p className="text-[13px] leading-relaxed text-sesui-muted dark:text-sesui-dmuted px-0.5 pb-2">
          Hangi egzersizlerin sana uygun olduğunu hekimin/terapistin belirler; uygun olmayanları Ayarlar'dan kapatabilirsin.
        </p>
      </div>
    </div>
  )
}
