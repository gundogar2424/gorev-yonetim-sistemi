// Videolar sayfasi: once KENDI kisa gosterim kliplerimiz (uygulamaya gomulu,
// internetsiz), sonra henuz kendi videosu olmayan egzersizler icin gecici
// YouTube baglantilari.
import SesHeader from '../SesHeader'
import VideoEmbed from '../components/VideoEmbed'
import ClipPlayer from '../components/ClipPlayer'
import { EXERCISES } from '../lib/content'
import { DEXERCISES } from '../lib/diksiyon'

export default function VideosPage() {
  const all = [...EXERCISES, ...DEXERCISES]
  const bizim = all.filter((e) => e.clip)
  // Kendi videosu olmayanlar, YouTube baglantisina gore gruplanir
  const yt = new Map<string, { url: string; title: string; lang: string; exercises: string[] }>()
  for (const e of all) {
    if (e.clip || !e.video) continue
    const cur = yt.get(e.video.url) ?? { ...e.video, exercises: [] }
    cur.exercises.push(e.name)
    yt.set(e.video.url, cur)
  }
  const eksik = all.filter((e) => !e.clip && !e.video).map((e) => e.name)

  return (
    <div>
      <SesHeader title="Videolar" subtitle="Egzersizler nasıl yapılır" back />
      <div className="px-4 space-y-5 pb-8">
        <section>
          <h3 className="ses-label px-1 mb-2">Kendi videolarımız ({bizim.length} / {all.length})</h3>
          {bizim.length > 0 ? (
            <div className="space-y-3">
              {bizim.map((e) => (
                <div key={e.id} className="ses-card space-y-2">
                  <div className="text-[16px] font-semibold text-slate-900 dark:text-[#f5ece4]">
                    {e.emoji} {e.name}
                  </div>
                  <ClipPlayer src={e.clip!} />
                </div>
              ))}
            </div>
          ) : (
            <p className="ses-card text-[14px] text-slate-700 dark:text-[#e2d5cd]">Henüz kendi videomuz yok.</p>
          )}
          <p className="text-[14px] text-slate-600 dark:text-[#cdbdb3] px-1 mt-2">
            Bu videolar uygulamanın içindedir, internetsiz oynar. Yeni video ekledikçe aşağıdaki YouTube bağlantıları o egzersizden kalkar.
          </p>
        </section>

        {yt.size > 0 && (
          <section>
            <h3 className="ses-label px-1 mb-2">Kendi videomuz gelene kadar (YouTube)</h3>
            <p className="text-[14px] text-slate-600 dark:text-[#cdbdb3] px-1 mb-2">
              İnternet gerekir. İngilizce ve Fransızca videolar işaretlidir; altyazı için YouTube'da ⚙️ › Altyazılar › Türkçe (otomatik çeviri) seçilebilir.
            </p>
            <div className="space-y-2">
              {[...yt.values()].map((v) => (
                <div key={v.url} className="ses-card space-y-2">
                  <div className="text-[14px] text-slate-700 dark:text-[#e2d5cd]">{v.exercises.join(' · ')}</div>
                  <VideoEmbed video={{ url: v.url, title: v.title, lang: v.lang as 'tr' | 'en' | 'fr' }} />
                </div>
              ))}
            </div>
          </section>
        )}

        {eksik.length > 0 && (
          <p className="text-[14px] text-slate-600 dark:text-[#cdbdb3] px-1">Videosu olmayanlar (adım adım tarif geçerli): {eksik.join(', ')}.</p>
        )}
      </div>
    </div>
  )
}
