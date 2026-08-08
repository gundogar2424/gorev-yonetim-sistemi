import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addIgnoredPhones } from '../db'
import { whatsappLink, todaysBirthdays, calcAge } from '../lib/contact'
import Header from '../components/Header'
import CustomerCard from '../components/CustomerCard'

export default function CustomerList() {
  const navigate = useNavigate()
  const customers = useLiveQuery(() => db.customers.orderBy('companyTitle').toArray(), [], [])
  const cities = useLiveQuery(() => db.cities.toArray(), [], [])

  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')

  // Toplu secim/silme modu
  const [selectMode, setSelectMode] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)

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

  function toggleSel(id: number) {
    setSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function selectAllVisible() {
    const ids = filtered.map((c) => c.id!).filter((x) => x != null)
    const allSel = ids.every((id) => sel.has(id))
    setSel((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (allSel) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }
  function exitSelect() {
    setSelectMode(false)
    setSel(new Set())
  }
  async function deleteSelected() {
    if (sel.size === 0) return
    if (
      !confirm(
        `${sel.size} müşteri silinecek. Bu numaralar bir daha rehberden içe aktarılınca ` +
          `geri gelmeyecek. Devam edilsin mi?`
      )
    )
      return
    setBusy(true)
    try {
      const ids = Array.from(sel)
      const picked = (customers ?? []).filter((c) => c.id != null && sel.has(c.id))
      const phones = picked.map((c) => c.phone?.trim()).filter((p): p is string => !!p)
      await addIgnoredPhones(phones)
      await db.customers.bulkDelete(ids)
      exitSelect()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Header
        title="Müşteriler"
        subtitle={selectMode ? `${sel.size} seçili` : `${customers?.length ?? 0} kayıt`}
        right={
          selectMode ? (
            <button
              onClick={exitSelect}
              className="bg-white/20 hover:bg-white/30 rounded-full px-3 h-10 text-sm flex items-center justify-center"
            >
              İptal
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectMode(true)}
                className="bg-white/20 hover:bg-white/30 rounded-full px-3 h-10 text-sm flex items-center justify-center"
                aria-label="Seç"
              >
                Seç
              </button>
              <button
                onClick={() => navigate('/yeni')}
                className="bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 text-2xl leading-none flex items-center justify-center"
                aria-label="Yeni müşteri"
              >
                +
              </button>
            </div>
          )
        }
      />

      <div className="p-3 space-y-3">
        {/* Dogum gunu uyarisi */}
        {!selectMode && birthdays.length > 0 && (
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

        {selectMode && filtered.length > 0 && (
          <button onClick={selectAllVisible} className="text-brand-700 font-medium text-sm">
            {filtered.every((c) => sel.has(c.id!)) ? 'Görünenlerin seçimini kaldır' : 'Görünenlerin tümünü seç'}
          </button>
        )}

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-16">
            <p className="text-4xl mb-2">📭</p>
            <p>Kayıt bulunamadı.</p>
            {!selectMode && (
              <button onClick={() => navigate('/yeni')} className="btn-primary mt-4">
                İlk müşteriyi ekle
              </button>
            )}
          </div>
        ) : selectMode ? (
          <ul className="space-y-2" style={{ paddingBottom: '5rem' }}>
            {filtered.map((c) => (
              <li
                key={c.id}
                className="card p-3 flex items-center gap-3"
                onClick={() => toggleSel(c.id!)}
              >
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-brand-700 shrink-0"
                  checked={sel.has(c.id!)}
                  onChange={() => toggleSel(c.id!)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 truncate">
                    {c.companyTitle || c.contactName || c.phone}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {c.contactName && c.companyTitle ? c.contactName + ' · ' : ''}
                    {c.phone}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-2">
            {filtered.map((c) => (
              <CustomerCard key={c.id} c={c} onClick={() => navigate(`/duzenle/${c.id}`)} />
            ))}
          </ul>
        )}
      </div>

      {/* Toplu silme cubugu (secim modunda, alt gezinmenin ustunde) */}
      {selectMode && (
        <div
          className="fixed inset-x-0 max-w-xl mx-auto p-3 z-10"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={deleteSelected}
            disabled={busy || sel.size === 0}
            className="w-full rounded-xl py-3 font-semibold text-white bg-red-600 disabled:bg-slate-300 shadow-lg"
          >
            {busy ? 'Siliniyor…' : `🗑️ ${sel.size} müşteriyi sil`}
          </button>
        </div>
      )}
    </div>
  )
}
