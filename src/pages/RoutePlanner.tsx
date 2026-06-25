import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings } from '../db'
import { planRoute, googleMapsUrl } from '../lib/route'
import Header from '../components/Header'

export default function RoutePlanner() {
  const customers = useLiveQuery(() => db.customers.orderBy('companyTitle').toArray(), [], [])
  const settings = useLiveQuery(() => getSettings(), [], undefined)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')

  const withGps = useMemo(() => (customers ?? []).filter((c) => c.gps), [customers])
  const list = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    if (!q) return withGps
    return withGps.filter(
      (c) =>
        c.companyTitle.toLocaleLowerCase('tr-TR').includes(q) ||
        c.contactName.toLocaleLowerCase('tr-TR').includes(q) ||
        (c.city ?? '').toLocaleLowerCase('tr-TR').includes(q)
    )
  }, [withGps, search])

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedCustomers = useMemo(
    () => (customers ?? []).filter((c) => c.id != null && selected.has(c.id)),
    [customers, selected]
  )

  const route = useMemo(() => {
    if (!settings?.startGps || selectedCustomers.length === 0) return null
    return planRoute(settings.startGps, selectedCustomers)
  }, [settings, selectedCustomers])

  const noStart = !settings?.startGps

  return (
    <div>
      <Header title="Akıllı Rota" subtitle={`${selected.size} müşteri seçili`} />

      <div className="p-3 space-y-3">
        {noStart && (
          <div className="card p-3 bg-amber-50 border-amber-200 text-sm text-amber-800">
            Başlangıç konumunuz tanımlı değil.{' '}
            <Link to="/ayarlar" className="underline font-semibold">
              Ayarlar'dan
            </Link>{' '}
            ev/ofis konumunuzu belirleyin.
          </div>
        )}

        <div className="card p-3 text-sm text-slate-600">
          <span className="font-semibold">Başlangıç:</span> {settings?.startName ?? '—'}
          {settings?.startGps && (
            <span className="text-slate-400">
              {' '}
              ({settings.startGps.lat.toFixed(3)}, {settings.startGps.lng.toFixed(3)})
            </span>
          )}
        </div>

        <input
          className="field-input"
          placeholder="Müşteri ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {withGps.length === 0 ? (
          <p className="text-center text-slate-400 py-10 text-sm">
            Rota için GPS konumu kaydedilmiş müşteri yok. Müşteri düzenleyip “Konumu Al” ile ekleyin.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.id} className="card p-3 flex items-center gap-3">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-brand-700"
                  checked={selected.has(c.id!)}
                  onChange={() => toggle(c.id!)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 truncate">{c.companyTitle}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {[c.district, c.city].filter(Boolean).join(', ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Rota ozeti ve aksiyon */}
      {route && (
        <div className="fixed bottom-16 inset-x-0 max-w-xl mx-auto p-3 z-10">
          <div className="card p-3 shadow-lg space-y-2 bg-white">
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{route.stops.length} durak</span> · yaklaşık{' '}
              <span className="font-semibold">{route.totalKm.toFixed(1)} km</span>
            </p>
            <ol className="text-xs text-slate-500 list-decimal list-inside max-h-24 overflow-auto">
              {route.stops.map((s) => (
                <li key={s.customer.id} className="truncate">
                  {s.customer.companyTitle}{' '}
                  <span className="text-slate-400">(+{s.legKm.toFixed(1)} km)</span>
                </li>
              ))}
            </ol>
            <a href={googleMapsUrl(route)} target="_blank" rel="noreferrer" className="btn-primary w-full">
              🧭 Google Haritalar'da Aç
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
