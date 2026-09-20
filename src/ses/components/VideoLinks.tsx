// YouTube baglanti satirlari. Gomulu oynatici yok: dokununca telefonun
// YouTube uygulamasinda / tarayicisinda acilir. Hem "Izle" sekmesi hem de
// egzersiz ekranindaki YouTube sekmesi ayni satirlari kullanir.
import { searchFor, searchUrl, videosFor, type LibVideo } from '../lib/library'
import Icon from './Icon'

function Ok() {
  return <Icon name="external" size={15} className="text-sesui-muted/70 dark:text-sesui-dmuted" />
}

export function VideoSatiri({ v }: { v: LibVideo }) {
  return (
    <a
      href={v.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 border-b border-sesui-line dark:border-sesui-dline last:border-0 active:opacity-70"
    >
      <span className="w-8 h-8 rounded-lg border border-sesui-line dark:border-sesui-dline grid place-items-center text-sesui-muted dark:text-sesui-dmuted flex-shrink-0">
        <Icon name="play" size={12} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium text-sesui-text dark:text-sesui-dtext leading-snug">
          {v.shorts && <span className="inline-block align-middle mr-1.5 px-1.5 py-[1px] rounded border border-sesui-line dark:border-sesui-dline text-sesui-muted dark:text-sesui-dmuted text-[10px] font-semibold uppercase tracking-[0.08em]">Shorts</span>}
          {v.title}
        </span>
        <span className="block text-[13px] text-sesui-muted dark:text-sesui-dmuted mt-0.5">
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
      className="flex items-center gap-3 py-3 border-b border-sesui-line dark:border-sesui-dline last:border-0 active:opacity-70"
    >
      <span className="w-8 h-8 rounded-lg border border-sesui-line dark:border-sesui-dline grid place-items-center text-sesui-muted dark:text-sesui-dmuted flex-shrink-0">
        <Icon name="search" size={14} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-semibold text-sesui-text dark:text-sesui-dtext leading-snug">YouTube'da ara</span>
        <span className="block text-[12px] text-sesui-muted dark:text-sesui-dmuted mt-0.5">"{q}" · kısa videolar</span>
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
  if (videolar.length === 0 && !q) return <p className="text-[15px] text-sesui-body dark:text-sesui-dbody py-2">Bu egzersiz için derlenmiş video yok.</p>
  return (
    <div>
      {videolar.map((v) => (
        <VideoSatiri key={v.url} v={v} />
      ))}
      {q && <AramaSatiri q={q} />}
    </div>
  )
}
