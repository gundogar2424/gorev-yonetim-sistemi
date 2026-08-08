import { useMemo, useState } from 'react'
import { db, getIgnoredPhoneSet } from '../db'
import { toCustomer } from '../lib/importPaste'
import { fetchPhoneContacts, isContactsAvailable, type PhoneContact } from '../lib/contactsImport'

// Telefon rehberinden toplu musteri ekleme (yalnizca APK).
// Isim + telefon eklenir; konum/detaylar sonra tek tek doldurulur.
export default function ContactsImport() {
  const available = isContactsAvailable()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [contacts, setContacts] = useState<PhoneContact[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [nameTarget, setNameTarget] = useState<'firma' | 'yetkili'>('firma')
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState<{ eklendi: number; atlandi: number } | null>(null)

  async function loadContacts() {
    setBusy(true)
    setMsg('')
    setDone(null)
    try {
      const list = await fetchPhoneContacts()
      setContacts(list)
      setSelected(new Set(list.map((c) => c.id))) // varsayilan: tumu secili
      setOpen(true)
      if (list.length === 0) setMsg('Rehberde telefon numarali kisi bulunamadi.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Rehber okunamadi.')
    } finally {
      setBusy(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    if (!q || !contacts) return contacts ?? []
    return contacts.filter(
      (c) => c.name.toLocaleLowerCase('tr-TR').includes(q) || c.phone.includes(q)
    )
  }, [contacts, search])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    const allSelected = filtered.every((c) => selected.has(c.id))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const c of filtered) {
        if (allSelected) next.delete(c.id)
        else next.add(c.id)
      }
      return next
    })
  }

  async function importSelected() {
    if (!contacts) return
    setBusy(true)
    setMsg('')
    try {
      const chosen = contacts.filter((c) => selected.has(c.id))
      // Mevcut numaralarla cakisanlari atla (tekrar eklenmesin)
      const existing = new Set((await db.customers.toArray()).map((c) => c.phone).filter(Boolean))
      // Daha once silinip "engellenen" numaralari da atla (geri gelmesinler)
      const ignored = await getIgnoredPhoneSet()
      const now = Date.now()
      const records = []
      let atlandi = 0
      for (const c of chosen) {
        if (existing.has(c.phone) || ignored.has(c.phone)) {
          atlandi++
          continue
        }
        existing.add(c.phone)
        const partial =
          nameTarget === 'firma'
            ? { companyTitle: c.name, phone: c.phone }
            : { contactName: c.name, phone: c.phone }
        records.push(toCustomer(partial, now))
      }
      if (records.length) await db.customers.bulkAdd(records)
      setDone({ eklendi: records.length, atlandi })
      setOpen(false)
      setContacts(null)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ekleme basarisiz.')
    } finally {
      setBusy(false)
    }
  }

  if (!available) {
    return (
      <div className="card p-3 text-sm text-slate-500 bg-slate-50">
        📇 <b>Telefon Rehberinden Aktar</b> özelliği yalnızca telefona kurulan uygulamada (APK)
        çalışır. Web sürümünde bunun yerine aşağıdaki kopyala-yapıştır yöntemini kullanın.
      </div>
    )
  }

  return (
    <div className="card p-3 space-y-3">
      <div>
        <h2 className="font-bold text-slate-700 text-sm">📇 Telefon Rehberinden Aktar</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Rehberindeki kişileri isim + telefon olarak toplu ekle; konum ve diğer bilgileri sonra tek
          tek doldurursun.
        </p>
      </div>

      {done && (
        <div className="card p-3 bg-green-50 border-green-200 text-green-800 text-sm">
          ✅ {done.eklendi} kişi eklendi
          {done.atlandi > 0 && <> · {done.atlandi} kişi zaten kayıtlı olduğu için atlandı</>}.
        </div>
      )}

      {msg && <p className="text-sm text-amber-700">{msg}</p>}

      {!open && (
        <button onClick={loadContacts} disabled={busy} className="btn-primary w-full">
          {busy ? 'Rehber açılıyor…' : '📇 Rehberi Aç'}
        </button>
      )}

      {open && contacts && (
        <div className="space-y-2">
          {/* İsim nereye yazılsın? */}
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setNameTarget('firma')}
              className={`flex-1 rounded-xl px-3 py-2 border ${
                nameTarget === 'firma'
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              İsim → Firma adı
            </button>
            <button
              onClick={() => setNameTarget('yetkili')}
              className={`flex-1 rounded-xl px-3 py-2 border ${
                nameTarget === 'yetkili'
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              İsim → Yetkili adı
            </button>
          </div>

          <input
            className="field-input"
            placeholder="Kişi ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex items-center justify-between text-sm">
            <button onClick={toggleAllVisible} className="text-brand-700 font-medium">
              {filtered.every((c) => selected.has(c.id)) ? 'Tümünü kaldır' : 'Tümünü seç'}
            </button>
            <span className="text-slate-500">{selected.size} seçili</span>
          </div>

          <ul className="max-h-72 overflow-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {filtered.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-3 p-2.5">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-brand-600"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-800 truncate">{c.name}</span>
                    <span className="block text-xs text-slate-500">{c.phone}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="btn-ghost flex-1">
              Vazgeç
            </button>
            <button
              onClick={importSelected}
              disabled={busy || selected.size === 0}
              className="btn-primary flex-1"
            >
              {busy ? 'Ekleniyor…' : `✅ ${selected.size} kişiyi ekle`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
