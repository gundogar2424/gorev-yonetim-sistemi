import { useEffect } from 'react'
import { CATEGORY_BY_ID } from '../lib/categories'
import { formatDistance, walkMinutes } from '../lib/geo'
import { directionsUrl, instagramUrl, mapsUrl, tiktokUrl, websiteUrl, wikipediaUrl } from '../lib/links'
import type { Place } from '../lib/types'
import { HypeBar, Stars } from './PlaceCard'

function LinkBtn({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-center gap-2 h-12 rounded-xl text-[15px] font-semibold active:scale-[0.98] transition ${
        primary
          ? 'bg-et-600 text-white col-span-2'
          : 'bg-slate-100 dark:bg-[#2a2421] text-slate-800 dark:text-[#eae2dc]'
      }`}
    >
      {children}
    </a>
  )
}

export default function PlaceSheet({ place, onClose }: { place: Place; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cat = CATEGORY_BY_ID[place.category]
  const web = websiteUrl(place)
  const wiki = wikipediaUrl(place)

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-xl rounded-t-3xl bg-white dark:bg-[#1c1817] p-5 pt-3 max-h-[88vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-[#3a332f]" />
        <div className="flex items-start gap-3">
          <div className="text-[34px] leading-none">{cat.emoji}</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[21px] font-bold leading-tight text-slate-900 dark:text-[#f5eee9]">{place.name}</h2>
            <p className="text-[14px] text-slate-500 dark:text-[#a59b94] mt-0.5">
              {place.subtype} · {cat.label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#2a2421] text-slate-600 dark:text-[#cfc5bd] text-[18px]"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="rounded-xl bg-slate-50 dark:bg-[#24201e] py-2.5">
            <div className="text-[17px] font-bold text-slate-900 dark:text-[#f2ebe6] tabular-nums">{formatDistance(place.distanceM)}</div>
            <div className="text-[12px] text-slate-500 dark:text-[#a59b94]">🚶 ~{walkMinutes(place.distanceM)} dk</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-[#24201e] py-2.5">
            <div className="text-[17px] font-bold text-slate-900 dark:text-[#f2ebe6]">
              {place.rating != null ? <Stars rating={place.rating} /> : '—'}
            </div>
            <div className="text-[12px] text-slate-500 dark:text-[#a59b94]">
              {place.ratingCount != null ? `${place.ratingCount.toLocaleString('tr-TR')} yorum` : 'Google puanı yok'}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-[#24201e] py-2.5">
            <div className="text-[17px] font-bold text-slate-900 dark:text-[#f2ebe6] tabular-nums">{place.hype}</div>
            <div className="text-[12px] text-slate-500 dark:text-[#a59b94]">popülerlik</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-slate-600 dark:text-[#cfc5bd]">
          <HypeBar value={place.hype} />
          {place.priceLevel ? <span>Fiyat: {'₺'.repeat(place.priceLevel)}</span> : null}
          {place.openNow === true && <span className="text-emerald-600 dark:text-emerald-400 font-medium">Şu an açık</span>}
          {place.openNow === false && <span className="text-rose-500 font-medium">Şu an kapalı</span>}
        </div>
        {place.address && <p className="mt-2 text-[14px] text-slate-600 dark:text-[#cfc5bd]">📍 {place.address}</p>}
        {place.openingHours && (
          <p className="mt-1 text-[13px] text-slate-500 dark:text-[#a59b94] break-words">🕒 {place.openingHours}</p>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <LinkBtn href={directionsUrl(place)} primary>
            🧭 Yol tarifi
          </LinkBtn>
          <LinkBtn href={mapsUrl(place)}>🗺️ Haritada aç</LinkBtn>
          <LinkBtn href={instagramUrl(place)}>📸 Instagram{place.instagram ? '' : "'da ara"}</LinkBtn>
          <LinkBtn href={tiktokUrl(place)}>🎵 TikTok'ta ara</LinkBtn>
          {web && <LinkBtn href={web}>🌐 Web sitesi</LinkBtn>}
          {place.phone && <LinkBtn href={`tel:${place.phone.replace(/[^\d+]/g, '')}`}>📞 Ara</LinkBtn>}
          {wiki && <LinkBtn href={wiki}>📖 Vikipedi</LinkBtn>}
        </div>

        <p className="mt-4 text-[12px] text-slate-400 dark:text-[#857b74]">
          Kaynak: {place.sources.map((s) => (s === 'google' ? 'Google' : 'OpenStreetMap')).join(' + ')}. Popülerlik
          puanı tahminidir (yorum sayısı + sosyal medya/Vikipedi varlığı).
        </p>
      </div>
    </div>
  )
}
