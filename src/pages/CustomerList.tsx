import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Customer } from '../types'
import { telLink, whatsappLink, todaysBirthdays, calcAge } from '../lib/contact'
import Header from '../components/Header'

export default function CustomerList() {
  const navigate = useNavigate()
  const customers = useLiveQuery(() => db.customers.orderBy('companyTitle').toArray(), [], [])
  const cities = useLiveQuery(() => db.cities.toArray(), [], [])

  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')

  const birthdays = useMemo(() => todaysBirthdays(customers ?? []), [customers])

  const districtOptions = useMemo(() => {
    if (!city) return []
    return cities?.find((c) => c.name === city)?.districts ?? []
  }, [city, cities])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return (customers ?? []).filter((c) => {
      if (city && c.city !== city) return false
      if (district && c.district !== district) return false
      if (!q) return true
      return (
        c.companyTitle.toLocaleLowerCase('tr-TR').includes(q) ||
        c.contactName.toLocaleLowerCase('tr-TR').includes(q) ||
        c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      )
    })
  }, [customers, search, city, district])

  return (
    <div>
      <Header
        title="Müşteriler"
        subtitle={`${customers?.length ?? 0} kayıt`}
        right={
          <button
            onClick={() => navigate('/yeni')}
            className="bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 text-2xl leading-none flex items-center justify-center"
            aria-label="Yeni müşteri"
          >
            +
          </button>
        }
      />

      <div className="p-3 space-y-3">
        {/* Dogum gunu uyarisi */}
        {birthdays.length > 0 && (
          <div className="card p-3 bg-amber-50 border-amber-200">
            <p className="font-semibold text-amber-800 text-sm mb-1">🎂 Bugün doğum günü olanlar</p>
            <ul className="text-sm text-amber-900 space-y-0.5">
              {birthdays.map((b) => {
                const age = calcAge(b.birthDate)
                return (
                  <li key={b.id} className="flex items-center justify-between gap-2">
                    <span>
                      {b.contactName || b.companyTitle}
                      {age != null && <span className="text-amber-700"> ({age})</span>}
                    </span>
                    <a href={whatsappLink(b.phone, `İyi ki doğdunuz! 🎉`)} className="text-green-700 underline">
                      Kutla
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Arama */}
        <input
          className="field-input"
          placeholder="Firma, isim veya telefon ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputMode="search"
        />

        {/* Il / Ilce filtre */}
        <div className="grid grid-cols-2 gap-2">
          <select
            className="field-input"
            value={city}
            onChange={(e) => {
              setCity(e.target.value)
              setDistrict('')
            }}
          >
            <option value="">Tüm iller</option>
            {cities?.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="field-input"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            disabled={!city}
          >
            <option value="">Tüm ilçeler</option>
            {districtOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-16">
            <p className="text-4xl mb-2">📭</p>
            <p>Kayıt bulunamadı.</p>
            <button onClick={() => navigate('/yeni')} className="btn-primary mt-4">
              İlk müşteriyi ekle
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((c) => (
              <CustomerCard key={c.id} c={c} onClick={() => navigate(`/duzenle/${c.id}`)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function CustomerCard({ c, onClick }: { c: Customer; onClick: () => void }) {
  return (
    <li className="card p-3 flex items-center gap-3">
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        {c.photo ? (
          <img src={c.photo} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold shrink-0">
            {(c.companyTitle || '?').slice(0, 1).toLocaleUpperCase('tr-TR')}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 truncate">{c.companyTitle}</p>
          <p className="text-sm text-slate-500 truncate">
            {c.contactName}
            {c.role ? ` · ${c.role}` : ''}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {[c.district, c.city].filter(Boolean).join(', ')}
          </p>
        </div>
      </button>

      {c.phone && (
        <div className="flex gap-1 shrink-0">
          <a
            href={telLink(c.phone)}
            className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-lg"
            aria-label="Ara"
            onClick={(e) => e.stopPropagation()}
          >
            📞
          </a>
          <a
            href={whatsappLink(c.phone)}
            target="_blank"
            rel="noreferrer"
            className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-lg"
            aria-label="WhatsApp"
            onClick={(e) => e.stopPropagation()}
          >
            💬
          </a>
        </div>
      )}
    </li>
  )
}
