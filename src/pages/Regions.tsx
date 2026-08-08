import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Customer } from '../types'
import Header from '../components/Header'
import CustomerCard from '../components/CustomerCard'

// Bölge ekrani: yalnizca konumu olan musteriler, Il -> Ilce gruplu.
export default function Regions() {
  const navigate = useNavigate()
  const customers = useLiveQuery(() => db.customers.toArray(), [], [])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  // Konumu olan musteriler: il/ilce yazili VEYA GPS kayitli
  const located = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return (customers ?? []).filter((c) => {
      if (!(c.city || c.district || c.gps)) return false
      if (!q) return true
      return (
        c.companyTitle.toLocaleLowerCase('tr-TR').includes(q) ||
        c.contactName.toLocaleLowerCase('tr-TR').includes(q) ||
        c.phone.includes(q)
      )
    })
  }, [customers, search])

  const groups = useMemo(() => {
    const byCity = new Map<string, Map<string, Customer[]>>()
    for (const c of located) {
      const cityKey = c.city?.trim() || 'İl belirsiz'
      const distKey = c.district?.trim() || 'İlçe belirsiz'
      if (!byCity.has(cityKey)) byCity.set(cityKey, new Map())
      const dm = byCity.get(cityKey)!
      if (!dm.has(distKey)) dm.set(distKey, [])
      dm.get(distKey)!.push(c)
    }
    return Array.from(byCity.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'tr'))
      .map(([city, dm]) => ({
        city,
        count: Array.from(dm.values()).reduce((n, arr) => n + arr.length, 0),
        districts: Array.from(dm.entries())
          .sort((a, b) => a[0].localeCompare(b[0], 'tr'))
          .map(([district, list]) => ({
            district,
            list: list.sort((x, y) => x.companyTitle.localeCompare(y.companyTitle, 'tr'))
          }))
      }))
  }, [located])

  function toggle(city: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(city)) next.delete(city)
      else next.add(city)
      return next
    })
  }

  return (
    <div>
      <Header title="Bölge" subtitle={`${located.length} konumlu müşteri`} />

      <div className="p-3 space-y-3">
        <input
          className="field-input"
          placeholder="Müşteri ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputMode="search"
        />

        {groups.length === 0 ? (
          <div className="text-center text-slate-400 py-16">
            <p className="text-4xl mb-2">🗺️</p>
            <p>Konumu olan müşteri yok.</p>
            <p className="text-xs mt-1">Bir müşteriye konum eklediğinde burada bölgesine göre görünür.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {groups.map((g) => {
              const isOpen = open.has(g.city)
              return (
                <li key={g.city} className="card overflow-hidden">
                  <button
                    onClick={() => toggle(g.city)}
                    className="w-full flex items-center justify-between px-3 py-3 text-left"
                  >
                    <span className="font-bold text-slate-800">
                      📍 {g.city}
                      <span className="ml-2 text-xs font-medium text-slate-400">({g.count})</span>
                    </span>
                    <span className="text-slate-400 text-lg">{isOpen ? '▾' : '▸'}</span>
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 space-y-3">
                      {g.districts.map((d) => (
                        <div key={d.district}>
                          <p className="section-title mb-1">
                            {d.district} <span className="text-slate-400">({d.list.length})</span>
                          </p>
                          <ul className="space-y-2">
                            {d.list.map((c) => (
                              <CustomerCard
                                key={c.id}
                                c={c}
                                onClick={() => navigate(`/duzenle/${c.id}`)}
                              />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
