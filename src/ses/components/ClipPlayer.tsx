// Uygulamanin icine gomulu kisa gosterim videosu (public/ses-video/*.mp4).
// Internet gerektirmez. Dokununca oynar; bitince basa doner.
import { useRef, useState } from 'react'

export default function ClipPlayer({ src, title }: { src: string; title?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [aspect, setAspect] = useState('16 / 9') // gercek oran yuklenince guncellenir
  function toggle() {
    const v = ref.current
    if (!v) return
    if (v.paused) void v.play().catch(() => {})
    else v.pause()
  }
  return (
    <div className="space-y-2">
      <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: aspect, maxHeight: '70vh' }}>
        <video
          ref={ref}
          src={src}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          preload="metadata"
          loop
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            if (v.videoWidth && v.videoHeight) setAspect(`${v.videoWidth} / ${v.videoHeight}`)
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={toggle}
        />
        {!playing && (
          <button type="button" onClick={toggle} aria-label="Videoyu oynat" className="absolute inset-0 grid place-items-center">
            <span className="w-20 h-20 rounded-full bg-ses-600 text-white grid place-items-center shadow-raised">
              <svg viewBox="0 0 24 24" className="w-10 h-10 ml-1" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      {title && <p className="text-[14px] text-slate-700 dark:text-[#e2d5cd]">{title}</p>}
    </div>
  )
}
