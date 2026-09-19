// Tum egzersiz videolari tek sayfada (YouTube; telefonun tarayicisinda acilir).
import SesHeader from '../SesHeader'
import VideoEmbed from '../components/VideoEmbed'
import { allVideos, EXERCISES } from '../lib/content'
import { allDVideos, DEXERCISES } from '../lib/diksiyon'

export default function VideosPage() {
  const ses = allVideos()
  const dik = allDVideos()
  const yok = [...EXERCISES.filter((e) => !e.video).map((e) => e.name), ...DEXERCISES.filter((e) => !e.video).map((e) => e.name)]
  return (
    <div>
      <SesHeader title="Videolar" subtitle="Egzersizler nasıl yapılır (YouTube)" back />
      <div className="px-4 space-y-5 pb-8">
        <p className="text-[16px] text-slate-700 dark:text-[#e2d5cd] px-1">
          Dokununca video telefonun tarayıcısında ya da YouTube uygulamasında açılır. İngilizce videolar işaretlidir; altyazı için YouTube'da ⚙️ › Altyazılar › Türkçe (otomatik çeviri) seçilebilir.
        </p>
        <section>
          <h3 className="ses-label px-1 mb-2">Ses teli egzersizleri</h3>
          <div className="space-y-2">
            {ses.map(({ video, exercises }) => (
              <div key={video.url} className="ses-card space-y-2">
                <div className="text-[15px] text-slate-700 dark:text-[#e2d5cd]">{exercises.join(' · ')}</div>
                <VideoEmbed video={video} />
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3 className="ses-label px-1 mb-2">Diksiyon</h3>
          <div className="space-y-2">
            {dik.map(({ video, exercises }) => (
              <div key={video.url} className="ses-card space-y-2">
                <div className="text-[15px] text-slate-700 dark:text-[#e2d5cd]">{exercises.join(' · ')}</div>
                <VideoEmbed video={video} />
              </div>
            ))}
          </div>
        </section>
        {yok.length > 0 && (
          <p className="text-[15px] text-slate-600 dark:text-[#cdbdb3] px-1">
            Gösterim videosu bulunamayanlar (adım adım tarif geçerli): {yok.join(', ')}.
          </p>
        )}
      </div>
    </div>
  )
}
