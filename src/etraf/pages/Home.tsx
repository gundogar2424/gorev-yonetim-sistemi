import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PlaceCard from '../components/PlaceCard'
import PlaceSheet from '../components/PlaceSheet'
import { CATEGORIES } from '../lib/categories'
import { formatDistance, getCurrentPosition } from '../lib/geo'
import { applyFilters, scan, sortPlaces, subtypeCounts, type Filters } from '../lib/scan'
import { getLastScan, getSettings, RADIUS_OPTIONS, saveLastScan, saveSettings } from '../lib/store'
import type { Place, ScanResult, SortId } from '../lib/types'

const SORTS: { id: SortId; label: string }[] = [
  { id: 'mesafe', label: '📍 Yakınlık' },
  { id: 'puan', label: '★ Google puanı' },
  { id: 'hype', label: '🔥 Popülerlik' },
  { id: 'cesit', label: '🗂️ Çeşit' },
  { id: 'ad', label: 'A-Z' }
]

const PAGE = 60

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 h-9 px-3.5 rounded-full text-[14px] font-medium whitespace-nowrap transition ${
        active
          ? 'bg-et-600 text-white'
          : 'bg-white dark:bg-[#24201e] text-slate-700 dark:text-[#d9d0c9] border border-slate-200 dark:border-[#332d29]'
      }`}
    >
      {children}
    </button>
  )
}

function timeAgo(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60000)
  if (min < 1) return 'az önce'
  if (min < 60) return `${min} dk önce`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} sa önce`
  return `${Math.round(h / 24)} gün önce`
}

export default function Home() {
  const [settings, setSettings] = useState(getSettings)
  const [result, setResult] = useState<ScanResult | null>(getLastScan)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Place | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const [filters, setFilters] = useState<Filters>({ category: 'hepsi', subtype: null, openOnly: false, minRating: 0, query: '' })

  const setF = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setLimit(PAGE)
  }
  const setSort = (sort: SortId) => {
    setSettings(saveSettings({ sort }))
    setLimit(PAGE)
  }

  async function run() {
    setError(null)
    try {
      setBusy('Konumun alınıyor…')
      const here = await getCurrentPosition()
      setBusy(settings.googleKey ? 'Etraf taranıyor (OpenStreetMap + Google)…' : 'Etraf taranıyor…')
      const r = await scan(here, settings.radiusM, settings.googleKey.trim())
      setResult(r)
      saveLastScan(r)
      setLimit(PAGE)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const places = result?.places ?? []
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of places) m[p.category] = (m[p.category] ?? 0) + 1
    return m
  }, [places])
  const inCategory = useMemo(
    () => (filters.category === 'hepsi' ? places : places.filter((p) => p.category === filters.category)),
    [places, filters.category]
  )
  const subtypes = useMemo(() => subtypeCounts(inCategory).slice(0, 14), [inCategory])
  const shown = useMemo(() => sortPlaces(applyFilters(places, filters), settings.sort), [places, filters, settings.sort])
  const hasGoogle = places.some((p) => p.rating != null)
  const hasOpenInfo = places.some((p) => p.openNow != null)

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#faf7f5]/90 dark:bg-[#141211]/90 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.02em] text-slate-900 dark:text-[#f5eee9]">Etrafımda</h1>
            <p className="text-[13px] text-slate-500 dark:text-[#a59b94] truncate">
              {result
                ? `${places.length} yer · ${formatDistance(result.radiusM)} çevre · ${timeAgo(result.at)}`
                : 'Yeme-içme, kültür, gezi… ne varsa'}
            </p>
          </div>
          <Link
            to="/ayarlar"
            className="w-11 h-11 rounded-full bg-white dark:bg-[#24201e] border border-slate-200 dark:border-[#332d29] flex items-center justify-center text-[20px]"
            aria-label="Ayarlar"
          >
            ⚙️
          </Link>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={run}
            disabled={!!busy}
            className="flex-1 h-14 rounded-2xl bg-et-600 disabled:opacity-70 text-white text-[17px] font-bold shadow-raised active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span className="text-[15px] font-semibold truncate">{busy}</span>
              </>
            ) : (
              <>📍 {result ? 'Yeniden tara' : 'Etrafımda ne var?'}</>
            )}
          </button>
          <select
            value={settings.radiusM}
            onChange={(e) => setSettings(saveSettings({ radiusM: Number(e.target.value) }))}
            className="h-14 px-3 rounded-2xl bg-white dark:bg-[#24201e] border border-slate-200 dark:border-[#332d29] text-slate-800 dark:text-[#eae2dc] font-semibold"
            aria-label="Tarama çapı"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {formatDistance(r)}
              </option>
            ))}
          </select>
        </div>

        {places.length > 0 && (
          <>
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar -mx-4 px-4">
              <Chip active={filters.category === 'hepsi'} onClick={() => setF({ category: 'hepsi', subtype: null })}>
                Tümü {places.length}
              </Chip>
              {CATEGORIES.filter((c) => catCounts[c.id]).map((c) => (
                <Chip key={c.id} active={filters.category === c.id} onClick={() => setF({ category: c.id, subtype: null })}>
                  {c.emoji} {c.label} {catCounts[c.id]}
                </Chip>
              ))}
            </div>
            <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar -mx-4 px-4 items-center">
              <span className="flex-shrink-0 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Sırala</span>
              {SORTS.map((s) => (
                <Chip key={s.id} active={settings.sort === s.id} onClick={() => setSort(s.id)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </>
        )}
      </header>

      <main className="px-4 pb-8 flex-1">
        {error && (
          <div className="mt-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-[#2c1a1a] text-rose-700 dark:text-rose-300 text-[14px]">
            {error}
          </div>
        )}
        {result?.warnings.map((w) => (
          <div key={w} className="mt-2 p-3 rounded-2xl bg-amber-50 dark:bg-[#2a2317] text-amber-800 dark:text-amber-300 text-[13px]">
            ⚠️ {w}
          </div>
        ))}

        {!result && !busy && (
          <div className="mt-8 text-center text-slate-500 dark:text-[#a59b94] px-4">
            <div className="text-[56px]">🧭</div>
            <p className="mt-2 text-[16px] font-medium text-slate-700 dark:text-[#d9d0c9]">Tek tuşla çevrendeki her şey</p>
            <p className="mt-1 text-[14px]">
              Restoranlar, kafeler, müzeler, tiyatrolar, parklar… Yakınlığa, Google puanına, çeşide ya da ne kadar popüler
              olduğuna göre sırala.
            </p>
            {!settings.googleKey && (
              <p className="mt-4 text-[13px]">
                Google puanlarını da görmek için{' '}
                <Link to="/ayarlar" className="text-et-600 dark:text-et-300 font-semibold underline">
                  Ayarlar'dan Google anahtarı
                </Link>{' '}
                ekleyebilirsin (isteğe bağlı).
              </p>
            )}
          </div>
        )}

        {places.length > 0 && (
          <>
            {subtypes.length > 1 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                {subtypes.map(([s, n]) => (
                  <button
                    key={s}
                    onClick={() => setF({ subtype: filters.subtype === s ? null : s })}
                    className={`flex-shrink-0 h-8 px-3 rounded-full text-[13px] whitespace-nowrap ${
                      filters.subtype === s
                        ? 'bg-et-100 text-et-800 dark:bg-[#3a241c] dark:text-et-200 font-semibold'
                        : 'bg-slate-100 dark:bg-[#211d1b] text-slate-600 dark:text-[#b8aea7]'
                    }`}
                  >
                    {s} {n}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-2 items-center">
              <input
                value={filters.query}
                onChange={(e) => setF({ query: e.target.value })}
                placeholder="Ara: kebap, müze, kahve…"
                className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-white dark:bg-[#1f1b19] border border-slate-200 dark:border-[#2f2926] text-slate-900 dark:text-[#f2ebe6] placeholder:text-slate-400"
              />
              {hasGoogle && (
                <select
                  value={filters.minRating}
                  onChange={(e) => setF({ minRating: Number(e.target.value) })}
                  className="h-10 px-2 rounded-xl bg-white dark:bg-[#1f1b19] border border-slate-200 dark:border-[#2f2926] text-[14px] text-slate-700 dark:text-[#d9d0c9]"
                  aria-label="En düşük puan"
                >
                  <option value={0}>★ Hepsi</option>
                  <option value={4}>★ 4+</option>
                  <option value={4.5}>★ 4,5+</option>
                </select>
              )}
              {hasOpenInfo && (
                <button
                  onClick={() => setF({ openOnly: !filters.openOnly })}
                  className={`h-10 px-3 rounded-xl text-[14px] font-medium ${
                    filters.openOnly
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-[#1f1b19] border border-slate-200 dark:border-[#2f2926] text-slate-700 dark:text-[#d9d0c9]'
                  }`}
                >
                  Açık
                </button>
              )}
            </div>

            {settings.sort === 'puan' && !hasGoogle && (
              <p className="mt-2 text-[13px] text-slate-500 dark:text-[#a59b94]">
                Google puanı için Ayarlar'dan Google anahtarı ekle; şimdilik yakınlığa göre sıralı.
              </p>
            )}

            <p className="mt-3 mb-2 text-[13px] text-slate-500 dark:text-[#a59b94]">{shown.length} sonuç</p>
            <div className="flex flex-col gap-2">
              {shown.slice(0, limit).map((p, i, arr) => (
                <Fragment key={p.id}>
                  {settings.sort === 'cesit' && (i === 0 || arr[i - 1].subtype !== p.subtype) && (
                    <h4 className="mt-3 first:mt-0 text-[13px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#a59b94]">
                      {p.subtype}
                    </h4>
                  )}
                  <PlaceCard place={p} onOpen={() => setOpen(p)} />
                </Fragment>
              ))}
            </div>
            {shown.length > limit && (
              <button
                onClick={() => setLimit((l) => l + PAGE)}
                className="mt-3 w-full h-12 rounded-xl bg-slate-100 dark:bg-[#24201e] text-slate-700 dark:text-[#d9d0c9] font-semibold"
              >
                Daha fazla göster ({shown.length - limit})
              </button>
            )}
            <p className="mt-6 text-center text-[11px] text-slate-400 dark:text-[#6f6660]">
              Harita verisi © OpenStreetMap katkıcıları{result?.googleUsed ? ' · Puanlar: Google' : ''}
            </p>
          </>
        )}

        {result && places.length === 0 && !busy && (
          <p className="mt-8 text-center text-slate-500 dark:text-[#a59b94]">
            Bu çevrede kayıtlı yer bulunamadı. Çapı büyütüp yeniden dene.
          </p>
        )}
      </main>

      {open && <PlaceSheet place={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
