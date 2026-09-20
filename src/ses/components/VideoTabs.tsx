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
        <div className="ses-seg grid-cols-2">
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
              className={`ses-seg-btn ${sekme === v ? 'ses-seg-on' : ''}`}
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
          {!clip && <p className="text-[14px] text-sesui-muted dark:text-sesui-dmuted">Bu egzersizin kendi videosu henüz hazır değil; şimdilik dış kaynaklar:</p>}
          <VideoLinks id={id} />
          <p className="text-[13px] text-sesui-muted dark:text-sesui-dmuted">Dış kaynak · YouTube'da açılır, internet gerekir.</p>
        </>
      )}
    </section>
  )
}
