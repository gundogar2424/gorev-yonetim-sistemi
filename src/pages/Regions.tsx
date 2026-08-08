import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Customer } from '../types'
import Header from '../components/Header'
import CustomerCard from '../components/CustomerCard'
import { offlineReverseGeocode } from '../lib/offlineGeo'
import { matchToSeed } from '../lib/reverseGeocode'

// Bölge ekrani: yalnizca konumu olan musteriler, Il -> Ilce gruplu.
export default function Regions() {
  const navigate = useNavigate()
  const customers = useLiveQuery(() => db.customers.toArray(), [], [])
  const cities = useLiveQuery(() => db.cities.toArray(), [], [])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [resolving, setResolving] = useState(false)
  const [resolveMsg, setResolveMsg] = useState('')

  // GPS'i olup il/ilce'si eksik musteri sayisi (cozumlenebilecekler)
  const pending = useMemo(
    () => (customers ?? []).filter((c) => c.gps && (!c.city || !c.district)).length,
    [customers]
  )

  // Tum eksik konumlari CEVRIMDISI (internetsiz) coz: koordinattan il/ilce doldur.
  async function resolveAll() {
    const targets = (customers ?? []).filter((c) => c.gps && (!c.city || !c.district))
    if (targets.length === 0) {
      setResolveMsg('Çözümlenecek konum yok. Tüm konumlu müşterilerin il/ilçesi zaten dolu.')
      return
    }
    setResolving(true)
    let ilDolan = 0
    let ilceDolan = 0
    let bulunamayan = 0
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i]
      try {
        const geo = await offlineReverseGeocode(c.gps!)
        const match = geo ? matchToSeed(geo, cities ?? []) : null
        if (!match) {
          bulunamayan++
        } else {
          const cityChanged = c.city !== match.city
          // Konum belirleyicidir: il koordinattan alinir.
          let newDistrict = c.district
          if (match.district) newDistrict = match.district
          else if (cityChanged) newDistrict = '' // eski ilce artik gecersiz (il degisti)
          const patch: Partial<Customer> = {}
          if (cityChanged) {
            patch.city = match.city
            ilDolan++
          }
          if (newDistrict !== c.district) {
            patch.district = newDistrict
            if (newDistrict) ilceDolan++
          }
          if (Object.keys(patch).length > 0 && c.id != null) {
            await db.customers.update(c.id, patch)
          }
        }
      } catch {
        bulunamayan++
      }
      if (i % 100 === 0) setResolveMsg(`Çözümleniyor… ${i}/${targets.length}`)
    }
    setResolving(false)
    setResolveMsg(
      `✓ Bitti. ${ilDolan} müşteriye il, ${ilceDolan} müşteriye ilçe eklendi.` +
        (bulunamayan ? ` ${bulunamayan} konum çözülemedi (Türkiye dışında olabilir).` : '')
    )
  }

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
        {/* Konumdan il/ilce cozumleme (cevrimdisi calisir) */}
        {(pending > 0 || resolveMsg) && (
          <div className="card p-3 space-y-2">
            {pending > 0 && (
              <p className="text-sm text-slate-600">
                {pending} müşterinin konumu var ama il/ilçesi eksik. Tek dokunuşla
                koordinatlarından bulunabilir (internet gerekmez).
              </p>
            )}
            <button onClick={resolveAll} disabled={resolving} className="btn-primary w-full">
              {resolving ? 'Çözümleniyor…' : '📍 Konumlardan il/ilçe bul'}
            </button>
            {resolveMsg && (
              <p
                className={`text-xs ${resolveMsg.startsWith('✓') ? 'text-green-700' : 'text-amber-700'}`}
              >
                {resolveMsg}
              </p>
            )}
          </div>
        )}

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
