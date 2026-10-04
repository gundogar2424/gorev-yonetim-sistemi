import { CATEGORY_BY_ID } from '../lib/categories'
import { formatDistance, walkMinutes } from '../lib/geo'
import { hypeLabel } from '../lib/scan'
import type { Place } from '../lib/types'

export function Stars({ rating, count }: { rating?: number; count?: number }) {
  if (rating == null) return null
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
      ★ {rating.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      {count != null && (
        <span className="font-normal text-slate-400 dark:text-[#8a817b]">({compact(count)})</span>
      )}
    </span>
  )
}

export function HypeBar({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Popülerlik ${value}/100 (tahmini)`}>
      <span className="text-[12px]">🔥</span>
      <span className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-[#332d29] overflow-hidden">
        <span className="block h-full rounded-full bg-et-500" style={{ width: `${Math.max(4, value)}%` }} />
      </span>
      <span className="text-[12px] text-slate-500 dark:text-[#a59b94]">{hypeLabel(value)}</span>
    </span>
  )
}

export function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}B`
  return String(n)
}

export default function PlaceCard({ place, onOpen }: { place: Place; onOpen: () => void }) {
  const cat = CATEGORY_BY_ID[place.category]
  return (
    <button
      onClick={onOpen}
      className="w-full text-left flex gap-3 items-start p-3.5 rounded-2xl bg-white dark:bg-[#1f1b19] border border-slate-200/70 dark:border-[#2f2926] active:scale-[0.99] transition"
    >
      <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-et-50 dark:bg-[#2c211d] flex items-center justify-center text-[22px]">
        {cat.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="font-semibold text-[16px] text-slate-900 dark:text-[#f2ebe6] truncate flex-1">{place.name}</h3>
          <span className="flex-shrink-0 text-[13px] font-semibold text-et-600 dark:text-et-300 tabular-nums">
            {formatDistance(place.distanceM)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[13px] text-slate-500 dark:text-[#a59b94]">
          <span className="truncate">{place.subtype}</span>
          {place.priceLevel ? <span className="text-slate-400">· {'₺'.repeat(place.priceLevel)}</span> : null}
          <span className="text-slate-400">· 🚶 {walkMinutes(place.distanceM)} dk</span>
        </div>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
          <Stars rating={place.rating} count={place.ratingCount} />
          <HypeBar value={place.hype} />
          {place.openNow === true && <span className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">Açık</span>}
          {place.openNow === false && <span className="text-[12px] font-medium text-rose-500">Kapalı</span>}
        </div>
      </div>
    </button>
  )
}
