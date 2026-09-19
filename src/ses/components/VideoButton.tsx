// "Videoyu izle": YouTube baglantisini telefonun tarayicisinda/YouTube'da acar.
// Capacitor, uygulama disi adresleri sistem tarayicisinda acar (target=_blank).
import type { Video } from '../lib/content'

export default function VideoButton({ video, compact }: { video?: Video; compact?: boolean }) {
  if (!video) return null
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 font-semibold active:scale-[0.98] transition ${compact ? 'px-4 py-3 text-[16px]' : 'px-4 py-4 text-[18px]'}`}
    >
      <span className="text-[26px]">🎬</span>
      <span className="flex-1 min-w-0">
        <span className="block">Videoyu izle{video.lang === 'en' ? ' (İngilizce)' : ''}</span>
        <span className="block text-[14px] font-normal text-rose-600/80 dark:text-rose-200/80 truncate">{video.title}</span>
      </span>
      <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}
