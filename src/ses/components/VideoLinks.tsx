// YouTube baglanti satirlari. Gomulu oynatici yok: dokununca telefonun
// YouTube uygulamasinda / tarayicisinda acilir. Hem "Izle" sekmesi hem de
// egzersiz ekranindaki YouTube sekmesi ayni satirlari kullanir.
import { searchFor, searchUrl, videosFor, type LibVideo } from '../lib/library'

function Ok() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400 dark:text-[#cdbdb3] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function VideoSatiri({ v }: { v: LibVideo }) {
  return (
    <a
      href={v.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-[#4a3a30] last:border-0 active:opacity-70"
    >
      <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-[#2a1a1d] grid place-items-center text-[18px] flex-shrink-0">▶</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-semibold text-slate-900 dark:text-[#f5ece4] leading-snug">
          {v.shorts && <span className="inline-block align-middle mr-1.5 px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-[#3a1f24] text-rose-700 dark:text-rose-300 text-[11px] font-bold uppercase tracking-wide">Shorts</span>}
          {v.title}
        </span>
        <span className="block text-[13px] text-slate-600 dark:text-[#cdbdb3] mt-0.5">
          {[v.by, v.shorts ? '~1 dk' : v.short ? 'kısa' : null, v.lang === 'en' ? 'İngilizce' : v.lang === 'fr' ? 'Fransızca' : null].filter(Boolean).join(' · ')}
        </span>
      </span>
      <Ok />
    </a>
  )
}

// Arama baglantisi: tek tek videolar kaldirilsa bile bu her zaman calisir
export function AramaSatiri({ q }: { q: string }) {
  return (
    <a
      href={searchUrl(q)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-[#4a3a30] last:border-0 active:opacity-70"
    >
      <span className="w-10 h-10 rounded-xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[17px] flex-shrink-0">🔎</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-semibold text-slate-900 dark:text-[#f5ece4] leading-snug">YouTube'da ara</span>
        <span className="block text-[13px] text-slate-600 dark:text-[#cdbdb3] mt-0.5">"{q}" · güncel sonuçlar</span>
      </span>
      <Ok />
    </a>
  )
}

// Bir egzersizin YouTube baglantilari + arama satiri
export default function VideoLinks({ id, yalnizKisa = false }: { id: string; yalnizKisa?: boolean }) {
  const tum = videosFor(id)
  const videolar = yalnizKisa ? tum.filter((v) => v.short) : tum
  const q = searchFor(id)
  if (videolar.length === 0 && !q) return <p className="text-[15px] text-slate-700 dark:text-[#e2d5cd] py-2">Bu egzersiz için derlenmiş video yok.</p>
  return (
    <div>
      {videolar.map((v) => (
        <VideoSatiri key={v.url} v={v} />
      ))}
      {q && <AramaSatiri q={q} />}
    </div>
  )
}
