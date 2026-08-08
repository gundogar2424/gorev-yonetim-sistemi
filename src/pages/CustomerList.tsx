import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addIgnoredPhones } from '../db'
import { whatsappLink, todaysBirthdays, calcAge } from '../lib/contact'
import type { Customer } from '../types'
import Header from '../components/Header'
import CustomerCard from '../components/CustomerCard'

// Gelismis filtre: alan + kosul
type FieldType = 'text' | 'number' | 'geo'
const ADV_FIELDS: { key: keyof Customer; label: string; type: FieldType }[] = [
  { key: 'companyTitle', label: 'Firma adı', type: 'text' },
  { key: 'contactName', label: 'Yetkili adı', type: 'text' },
  { key: 'phone', label: 'Telefon', type: 'text' },
  { key: 'city', label: 'İl', type: 'text' },
  { key: 'district', label: 'İlçe', type: 'text' },
  { key: 'sector', label: 'Sektör', type: 'text' },
  { key: 'role', label: 'Görev', type: 'text' },
  { key: 'notes', label: 'Notlar', type: 'text' },
  { key: 'areaM2', label: 'm² alanı', type: 'number' },
  { key: 'employeeCount', label: 'Çalışan sayısı', type: 'number' },
  { key: 'riskScore', label: 'Risk puanı', type: 'number' },
  { key: 'gps', label: 'Konum (GPS)', type: 'geo' }
]
type OpKey = 'contains' | 'ncontains' | 'eq' | 'gt' | 'lt' | 'empty' | 'notempty'
const OPS_TEXT: { key: OpKey; label: string }[] = [
  { key: 'contains', label: 'İçeren' },
  { key: 'ncontains', label: 'İçermeyen' },
  { key: 'eq', label: 'Eşittir' },
  { key: 'empty', label: 'Boş' },
  { key: 'notempty', label: 'Dolu' }
]
const OPS_NUM: { key: OpKey; label: string }[] = [
  { key: 'eq', label: 'Eşittir' },
  { key: 'gt', label: 'Büyüktür' },
  { key: 'lt', label: 'Küçüktür' },
  { key: 'empty', label: 'Boş' },
  { key: 'notempty', label: 'Dolu' }
]
const OPS_GEO: { key: OpKey; label: string }[] = [
  { key: 'notempty', label: 'Var (konum kayıtlı)' },
  { key: 'empty', label: 'Yok (konum yok)' }
]
function opsFor(type: FieldType) {
  return type === 'number' ? OPS_NUM : type === 'geo' ? OPS_GEO : OPS_TEXT
}

export default function CustomerList() {
  const navigate = useNavigate()
  const customers = useLiveQuery(() => db.customers.orderBy('companyTitle').toArray(), [], [])
  const cities = useLiveQuery(() => db.cities.toArray(), [], [])

  const [search, setSearch] = useState('')
  const [matchMode, setMatchMode] = useState<'contains' | 'excludes'>('contains')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')

  // Gelismis filtre
  const [advOpen, setAdvOpen] = useState(false)
  const [advField, setAdvField] = useState<keyof Customer | ''>('')
  const [advOp, setAdvOp] = useState<OpKey>('contains')
  const [advValue, setAdvValue] = useState('')

  const advFieldDef = useMemo(() => ADV_FIELDS.find((f) => f.key === advField), [advField])
  const advNeedsValue = advOp !== 'empty' && advOp !== 'notempty'

  // Toplu secim/silme modu
  const [selectMode, setSelectMode] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)

  const birthdays = useMemo(() => todaysBirthdays(customers ?? []), [customers])

  const districtOptions = useMemo(() => {
    if (!city) return []
    return cities?.find((c) => c.name === city)?.districts ?? []
  }, [city, cities])

  // Gelismis filtre kosulu bir musteriye uyuyor mu?
  function matchAdvanced(c: Customer): boolean {
    if (!advField || !advFieldDef) return true
    const type = advFieldDef.type
    const raw = c[advField]
    const isEmpty = type === 'geo' ? !c.gps : raw === undefined || raw === null || String(raw).trim() === ''
    if (advOp === 'empty') return isEmpty
    if (advOp === 'notempty') return !isEmpty
    if (type === 'number') {
      const v = parseFloat(advValue.replace(',', '.'))
      if (isNaN(v)) return true // deger girilmediyse suz
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw))
      if (isNaN(num)) return false
      if (advOp === 'eq') return num === v
      if (advOp === 'gt') return num > v
      if (advOp === 'lt') return num < v
      return true
    }
    // metin
    const s = String(raw ?? '').toLocaleLowerCase('tr-TR')
    const v = advValue.trim().toLocaleLowerCase('tr-TR')
    if (!v) return true
    if (advOp === 'contains') return s.includes(v)
    if (advOp === 'ncontains') return !s.includes(v)
    if (advOp === 'eq') return s === v
    return true
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return (customers ?? []).filter((c) => {
      if (city && c.city !== city) return false
      if (district && c.district !== district) return false
      if (!matchAdvanced(c)) return false
      if (!q) return true
      const hit =
        c.companyTitle.toLocaleLowerCase('tr-TR').includes(q) ||
        c.contactName.toLocaleLowerCase('tr-TR').includes(q) ||
        c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      // "içermeyen" modunda: kelimeyi taşımayanları göster
      return matchMode === 'excludes' ? !hit : hit
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, search, matchMode, city, district, advField, advOp, advValue])

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
      const items = picked
        .filter((c) => c.phone?.trim())
        .map((c) => ({ phone: c.phone.trim(), name: c.companyTitle || c.contactName }))
      await addIgnoredPhones(items)
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

        {/* Iceren / Icermeyen anahtari (kelime yazilinca gorunur) */}
        {search.trim() && (
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setMatchMode('contains')}
              className={`flex-1 rounded-xl px-3 py-2 border ${
                matchMode === 'contains'
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              İçeren
            </button>
            <button
              onClick={() => setMatchMode('excludes')}
              className={`flex-1 rounded-xl px-3 py-2 border ${
                matchMode === 'excludes'
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              İçermeyen
            </button>
          </div>
        )}

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

        {/* Gelismis filtre */}
        <div>
          <button
            onClick={() => setAdvOpen((o) => !o)}
            className="text-sm text-brand-700 font-medium flex items-center gap-1"
          >
            ⚙️ Gelişmiş filtre {advField ? '(açık)' : ''} {advOpen ? '▾' : '▸'}
          </button>
          {advOpen && (
            <div className="card p-3 mt-2 space-y-2 bg-slate-50">
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="field-input"
                  value={advField}
                  onChange={(e) => {
                    const key = e.target.value as keyof Customer | ''
                    setAdvField(key)
                    const def = ADV_FIELDS.find((f) => f.key === key)
                    setAdvOp(def ? opsFor(def.type)[0].key : 'contains')
                    setAdvValue('')
                  }}
                >
                  <option value="">Alan seç…</option>
                  {ADV_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  className="field-input"
                  value={advOp}
                  onChange={(e) => setAdvOp(e.target.value as OpKey)}
                  disabled={!advFieldDef}
                >
                  {(advFieldDef ? opsFor(advFieldDef.type) : OPS_TEXT).map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {advFieldDef && advNeedsValue && (
                <input
                  className="field-input"
                  inputMode={advFieldDef.type === 'number' ? 'numeric' : 'text'}
                  placeholder={advFieldDef.type === 'number' ? 'Sayı gir…' : 'Değer gir…'}
                  value={advValue}
                  onChange={(e) => setAdvValue(e.target.value)}
                />
              )}
              {advField && (
                <button
                  onClick={() => {
                    setAdvField('')
                    setAdvValue('')
                  }}
                  className="text-sm text-red-500"
                >
                  Filtreyi temizle
                </button>
              )}
            </div>
          )}
        </div>

        {(search.trim() || city || district || advField) && (
          <p className="text-xs text-slate-500">{filtered.length} kayıt görünüyor</p>
        )}

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
