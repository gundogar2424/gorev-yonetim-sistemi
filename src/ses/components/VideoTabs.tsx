// Egzersiz ekranindaki video karti: iki sekme.
//  1) "Kendi videomuz" — uygulamanin icindeki klip (internet gerekmez)
//  2) "YouTube" — o egzersizle ilgili dis videolar (baglanti; internet gerekir)
// Varsayilan hep kendi videomuzdur; YouTube ancak dokununca acilir.
import { useState } from 'react'
import ClipPlayer from './ClipPlayer'
import VideoLinks from './VideoLinks'
import { searchFor, videosFor } from '../lib/library'

export default function VideoTabs({ id, clip, title }: { id: string; clip?: string; title?: string }) {
  const [sekme, setSekme] = useState<'bizim' | 'youtube'>(clip ? 'bizim' : 'youtube')
  const sayi = videosFor(id).length
  const varYoutube = sayi > 0 || !!searchFor(id)
  if (!clip && !varYoutube) return null

  return (
    <section className="ses-card space-y-3">
      {title && <h3 className="ses-label">{title}</h3>}
      {clip && varYoutube && (
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-[#352820]">
          {(
            [
              ['bizim', 'Kendi videomuz'],
              ['youtube', sayi > 0 ? `YouTube (${sayi})` : 'YouTube']
            ] as const
          ).map(([v, etiket]) => (
            <button
              key={v}
              type="button"
              onClick={() => setSekme(v)}
              className={`min-h-[44px] rounded-xl text-[15px] font-semibold transition ${sekme === v ? 'bg-white dark:bg-[#4a3a30] text-slate-900 dark:text-[#f5ece4] shadow-sm' : 'text-slate-600 dark:text-[#cdbdb3]'}`}
            >
              {etiket}
            </button>
          ))}
        </div>
      )}
      {clip && sekme === 'bizim' ? (
        <ClipPlayer src={clip} />
      ) : (
        <>
          {!clip && <p className="text-[14px] text-slate-600 dark:text-[#cdbdb3]">Bu egzersizin kendi videosu henüz hazır değil; şimdilik dış kaynaklar:</p>}
          <VideoLinks id={id} />
          <p className="text-[13px] text-slate-600 dark:text-[#cdbdb3]">Dış kaynak · YouTube'da açılır, internet gerekir.</p>
        </>
      )}
    </section>
  )
}
