// Videolar sayfasi: uygulamaya gomulu kendi gosterim kliplerimiz.
// Internetsiz oynar; harici (YouTube) video kullanilmaz.
import SesHeader from '../SesHeader'
import ClipPlayer from '../components/ClipPlayer'
import { EXERCISES } from '../lib/content'
import { DEXERCISES } from '../lib/diksiyon'

export default function VideosPage() {
  const all = [...EXERCISES, ...DEXERCISES]
  const bizim = all.filter((e) => e.clip)
  const eksik = all.filter((e) => !e.clip)

  return (
    <div>
      <SesHeader title="Videolar" subtitle={`${bizim.length} / ${all.length} egzersizin videosu hazır`} back />
      <div className="px-4 space-y-4 pb-8">
        <p className="text-[15px] text-slate-700 dark:text-[#e2d5cd] px-1">Videolar uygulamanın içindedir; internet gerekmez.</p>
        {bizim.length > 0 ? (
          <div className="space-y-3">
            {bizim.map((e) => (
              <div key={e.id} className="ses-card space-y-2">
                <div className="text-[17px] font-semibold text-slate-900 dark:text-[#f5ece4]">
                  {e.emoji} {e.name}
                </div>
                <ClipPlayer src={e.clip!} />
              </div>
            ))}
          </div>
        ) : (
          <p className="ses-card text-[15px] text-slate-700 dark:text-[#e2d5cd]">Henüz video eklenmedi.</p>
        )}
        {eksik.length > 0 && (
          <section className="ses-card">
            <h3 className="ses-label mb-2">Videosu henüz hazır olmayanlar</h3>
            <p className="text-[15px] text-slate-700 dark:text-[#e2d5cd]">
              {eksik.map((e) => e.name).join(', ')}. Bu egzersizlerde ekrandaki adım adım tarifi izle.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
