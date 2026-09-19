// Gomulu YouTube videosu: once kapak resmi + oynat dugmesi (veri harcamaz),
// dokununca uygulamanin icinde oynar. Internet gerekir; kapak yuklenemezse
// duz bir kart gosterilir. Altinda "YouTube'da ac" baglantisi (VideoButton).
import { useState } from 'react'
import type { Video } from '../lib/content'
import VideoButton from './VideoButton'

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export default function VideoEmbed({ video }: { video?: Video }) {
  const [play, setPlay] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  if (!video) return null
  const id = youtubeId(video.url)
  if (!id) return <VideoButton video={video} compact />
  return (
    <div className="space-y-2">
      <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '16 / 9' }}>
        {play ? (
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&hl=tr&cc_lang_pref=tr`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button type="button" onClick={() => setPlay(true)} className="absolute inset-0 w-full h-full group" aria-label="Videoyu oynat">
            {imgOk && <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setImgOk(false)} />}
            <span className="absolute inset-0 bg-black/25" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="w-20 h-20 rounded-full bg-ses-600 text-white grid place-items-center shadow-raised group-active:scale-95 transition">
                <svg viewBox="0 0 24 24" className="w-10 h-10 ml-1" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
            <span className="absolute left-3 right-3 bottom-3 text-left text-white text-[15px] font-semibold drop-shadow">
              🎬 Nasıl yapılır: {video.title}
              {video.lang === 'en' ? ' (İngilizce)' : ''}
            </span>
          </button>
        )}
      </div>
      <VideoButton video={video} compact />
    </div>
  )
}
