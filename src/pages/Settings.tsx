import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings, saveSettings, clearIgnoredPhones, removeIgnoredPhone } from '../db'
import { getCurrentPosition } from '../lib/geo'
import { exportBackup, downloadBackup, restoreBackup, parseBackupFile } from '../lib/backup'
import Header from '../components/Header'

export default function Settings() {
  const settings = useLiveQuery(() => getSettings(), [], undefined)
  const cities = useLiveQuery(() => db.cities.orderBy('name').toArray(), [], [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [gpsBusy, setGpsBusy] = useState(false)

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(''), 4000)
  }

  async function captureStart() {
    setGpsBusy(true)
    try {
      const gps = await getCurrentPosition()
      await saveSettings({ startGps: gps })
      flash('Başlangıç konumu kaydedildi.')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Konum alınamadı.')
    } finally {
      setGpsBusy(false)
    }
  }

  async function doBackup() {
    const backup = await exportBackup()
    downloadBackup(backup)
    flash(`${backup.customers.length} müşteri yedeklendi (fotoğraflar dahil).`)
  }

  async function onRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const backup = parseBackupFile(text)
      const mode = confirm(
        `Yedekte ${backup.customers.length} müşteri var.\n\nTAMAM = mevcut verinin yerine koy (sil & geri yükle)\nİPTAL = mevcut verinin üstüne ekle (birleştir)`
      )
        ? 'replace'
        : 'merge'
      const res = await restoreBackup(backup, mode)
      flash(`${res.customers} müşteri geri yüklendi (${mode === 'replace' ? 'değiştirildi' : 'birleştirildi'}).`)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Geri yükleme başarısız.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <Header title="Ayarlar" />

      <div className="p-3 space-y-4">
        {msg && <p className="card p-3 bg-brand-50 text-brand-800 text-sm border-brand-100">{msg}</p>}

        {/* Baslangic konumu */}
        <section className="card p-3 space-y-3">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Başlangıç Konumu</h2>
          <p className="text-xs text-slate-500">Rota planlaması bu noktadan başlar (ev veya ofis).</p>
          <div>
            <label className="field-label">İsim</label>
            <input
              className="field-input"
              value={settings?.startName ?? ''}
              onChange={(e) => saveSettings({ startName: e.target.value })}
              placeholder="örn. Ofis"
            />
          </div>
          <div>
            <label className="field-label">Adres (isteğe bağlı)</label>
            <input
              className="field-input"
              value={settings?.startAddress ?? ''}
              onChange={(e) => saveSettings({ startAddress: e.target.value })}
            />
          </div>
          <button onClick={captureStart} disabled={gpsBusy} className="btn-ghost w-full">
            {gpsBusy ? 'Alınıyor…' : '📍 Şu Anki Konumu Başlangıç Yap'}
          </button>
          {settings?.startGps && (
            <p className="text-xs text-slate-500">
              Kayıtlı: {settings.startGps.lat.toFixed(5)}, {settings.startGps.lng.toFixed(5)}
            </p>
          )}
        </section>

        {/* Yedekleme */}
        <section className="card p-3 space-y-3">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Yedekleme</h2>
          <p className="text-xs text-slate-500">
            Tüm müşteriler, fotoğraflar ve ayarlar tek bir dosyaya indirilir. Bu dosyayı saklayın; istediğinizde
            geri yükleyebilirsiniz.
          </p>
          <button onClick={doBackup} className="btn-primary w-full">
            ⬇️ Yedeği İndir
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost w-full">
            ⬆️ Yedekten Geri Yükle
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onRestoreFile} />
        </section>

        {/* Engellenen numaralar */}
        <BlockedManager onFlash={flash} />

        {/* Il / Ilce yonetimi */}
        <CityManager cities={cities ?? []} onFlash={flash} />

        <p className="text-center text-xs text-slate-400 pt-2">Saha CRM · Verileriniz yalnızca bu cihazda saklanır.</p>
      </div>
    </div>
  )
}

function BlockedManager({ onFlash }: { onFlash: (m: string) => void }) {
  const blocked = useLiveQuery(() => db.ignoredPhones.toArray(), [], [])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const list = useMemo(() => {
    const arr = [...(blocked ?? [])].sort((a, b) =>
      (a.name || a.phone).localeCompare(b.name || b.phone, 'tr')
    )
    const q = search.trim().toLocaleLowerCase('tr-TR')
    if (!q) return arr
    return arr.filter(
      (b) => (b.name ?? '').toLocaleLowerCase('tr-TR').includes(q) || b.phone.includes(q)
    )
  }, [blocked, search])

  const total = blocked?.length ?? 0

  return (
    <section className="card p-3 space-y-3">
      <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
        Engellenen Numaralar
      </h2>
      <p className="text-xs text-slate-500">
        Sildiğin müşterilerin numaraları buraya eklenir; rehberi tekrar içe aktardığında{' '}
        <b>geri gelmezler</b>. Şu an <b>{total}</b> numara engelli. Bir numaranın <b>“Geri al”</b>{' '}
        düğmesine basarsan, o kişi bir sonraki rehber aktarımında tekrar eklenebilir.
      </p>

      {total > 0 && (
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost w-full">
          {open ? 'Listeyi gizle' : `Listeyi göster (${total})`}
        </button>
      )}

      {open && total > 0 && (
        <div className="space-y-2">
          <input
            className="field-input"
            placeholder="Engellenenlerde ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="max-h-80 overflow-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {list.map((b) => (
              <li key={b.phone} className="flex items-center gap-3 p-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-800 truncate">
                    {b.name || b.phone}
                  </span>
                  {b.name && <span className="block text-xs text-slate-500">{b.phone}</span>}
                </span>
                <button
                  onClick={async () => {
                    await removeIgnoredPhone(b.phone)
                    onFlash('Numaranın engeli kaldırıldı.')
                  }}
                  className="text-brand-700 text-sm font-medium px-2 shrink-0"
                >
                  Geri al
                </button>
              </li>
            ))}
            {list.length === 0 && (
              <li className="p-3 text-center text-xs text-slate-400">Eşleşen numara yok.</li>
            )}
          </ul>
          <button
            onClick={async () => {
              if (!confirm(`${total} numaranın tamamının engeli kaldırılsın mı?`)) return
              await clearIgnoredPhones()
              onFlash('Tüm engeller kaldırıldı.')
              setOpen(false)
            }}
            className="text-red-500 text-sm w-full py-1"
          >
            Tümünün engelini kaldır
          </button>
        </div>
      )}
    </section>
  )
}

function CityManager({
  cities,
  onFlash
}: {
  cities: { id?: number; name: string; districts: string[] }[]
  onFlash: (m: string) => void
}) {
  const [newCity, setNewCity] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [newDistrict, setNewDistrict] = useState('')

  async function addCity() {
    const name = newCity.trim()
    if (!name) return
    const exists = await db.cities.where('name').equals(name).first()
    if (exists) {
      onFlash('Bu il zaten var.')
      return
    }
    await db.cities.add({ name, districts: [] })
    setNewCity('')
  }

  async function removeCity(id: number) {
    if (!confirm('Bu ili ve ilçelerini silmek istediğinize emin misiniz?')) return
    await db.cities.delete(id)
  }

  async function addDistrict(cityId: number, current: string[]) {
    const d = newDistrict.trim()
    if (!d || current.includes(d)) return
    await db.cities.update(cityId, { districts: [...current, d].sort((a, b) => a.localeCompare(b, 'tr')) })
    setNewDistrict('')
  }

  async function removeDistrict(cityId: number, current: string[], d: string) {
    await db.cities.update(cityId, { districts: current.filter((x) => x !== d) })
  }

  return (
    <section className="card p-3 space-y-3">
      <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">İl / İlçe Yönetimi</h2>

      <div className="flex gap-2">
        <input
          className="field-input"
          placeholder="Yeni il adı"
          value={newCity}
          onChange={(e) => setNewCity(e.target.value)}
        />
        <button onClick={addCity} className="btn-primary px-4">
          Ekle
        </button>
      </div>

      <div className="max-h-96 overflow-auto divide-y divide-slate-100">
        {cities.map((c) => (
          <div key={c.id} className="py-2">
            <div className="flex items-center justify-between">
              <button
                className="font-medium text-slate-700 flex-1 text-left"
                onClick={() => {
                  setOpenId(openId === c.id ? null : c.id!)
                  setNewDistrict('')
                }}
              >
                {c.name} <span className="text-xs text-slate-400">({c.districts.length})</span>
              </button>
              <button onClick={() => removeCity(c.id!)} className="text-red-500 text-sm px-2">
                Sil
              </button>
            </div>

            {openId === c.id && (
              <div className="mt-2 pl-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {c.districts.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 bg-slate-100 rounded-full px-2.5 py-1 text-xs">
                      {d}
                      <button onClick={() => removeDistrict(c.id!, c.districts, d)} className="text-red-500">
                        ✕
                      </button>
                    </span>
                  ))}
                  {c.districts.length === 0 && <span className="text-xs text-slate-400">İlçe yok</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    className="field-input"
                    placeholder="Yeni ilçe"
                    value={newDistrict}
                    onChange={(e) => setNewDistrict(e.target.value)}
                  />
                  <button onClick={() => addDistrict(c.id!, c.districts)} className="btn-ghost px-3">
                    Ekle
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
