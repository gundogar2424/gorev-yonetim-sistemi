import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings, addIgnoredPhones } from '../db'
import type { Customer, GpsPoint, Ownership, PaymentType } from '../types'
import { fileToResizedDataUrl } from '../lib/image'
import { getCurrentPosition } from '../lib/geo'
import { resolveLocationAsync, isShortMapsLink } from '../lib/location'
import { extractCoordsFromImage } from '../lib/aiLocation'
import { reverseGeocode, matchToSeed } from '../lib/reverseGeocode'
import Header from '../components/Header'

const emptyCustomer: Customer = {
  companyTitle: '',
  contactName: '',
  role: '',
  phone: '',
  city: '',
  district: '',
  sector: '',
  ownership: 'bilinmiyor',
  paymentType: 'diger',
  createdAt: 0,
  updatedAt: 0
}

const ownershipOptions: { value: Ownership; label: string }[] = [
  { value: 'mulk', label: 'Mülk sahibi' },
  { value: 'kira', label: 'Kiracı' },
  { value: 'bilinmiyor', label: 'Bilinmiyor' }
]

const paymentOptions: { value: PaymentType; label: string }[] = [
  { value: 'nakit', label: 'Nakit' },
  { value: 'kredi-karti', label: 'Kredi Kartı' },
  { value: 'cek', label: 'Çek' },
  { value: 'havale', label: 'Havale/EFT' },
  { value: 'diger', label: 'Diğer' }
]

export default function CustomerForm() {
  const { id } = useParams()
  const editing = id != null
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const shotRef = useRef<HTMLInputElement>(null)

  const cities = useLiveQuery(() => db.cities.toArray(), [], [])
  // Daha once girilen sektorler (yazarken oneri olarak cikar)
  const sectorOptions = useLiveQuery(async () => {
    const all = await db.customers.toArray()
    const set = new Set<string>()
    for (const c of all) {
      const s = c.sector?.trim()
      if (s) set.add(s)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [], [])
  const [form, setForm] = useState<Customer>(emptyCustomer)
  const [loaded, setLoaded] = useState(!editing)
  const [gpsBusy, setGpsBusy] = useState(false)
  const [error, setError] = useState('')
  const [locInput, setLocInput] = useState('')
  const [locMsg, setLocMsg] = useState('')
  const [locBusy, setLocBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoMsg, setGeoMsg] = useState('')

  useEffect(() => {
    if (!editing) return
    db.customers.get(Number(id)).then((c) => {
      if (c) setForm(c)
      else setError('Kayıt bulunamadı.')
      setLoaded(true)
    })
  }, [id, editing])

  const districtOptions = useMemo(() => {
    return cities?.find((c) => c.name === form.city)?.districts ?? []
  }, [cities, form.city])

  function update<K extends keyof Customer>(key: K, value: Customer[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      update('photo', dataUrl)
    } catch {
      setError('Fotoğraf işlenemedi.')
    }
  }

  async function captureGps() {
    setGpsBusy(true)
    setError('')
    try {
      const gps = await getCurrentPosition()
      update('gps', gps)
      applyGeo(gps)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konum alınamadı.')
    } finally {
      setGpsBusy(false)
    }
  }

  async function applyPastedLocation() {
    setLocMsg('')
    setLocBusy(true)
    if (isShortMapsLink(locInput)) setLocMsg('Kısa link çözülüyor…')
    try {
      const res = await resolveLocationAsync(locInput)
      if (res.status === 'ok' && res.point) {
        update('gps', res.point)
        applyGeo(res.point)
        setLocInput('')
        setLocMsg('✓ Konum alındı.')
      } else if (res.status === 'short-link') {
        setLocMsg(
          'Kısa link otomatik çözülemedi. Lütfen Haritalar’da konuma parmağını basılı tutup ' +
            '“dropped pin” oluştur, çıkan koordinatları (örn. 41.0082, 28.9784) kopyalayıp yapıştır.' +
            (res.note ? `\n\n[teşhis: ${res.note}]` : '')
        )
      } else {
        setLocMsg('Konum bulunamadı. Koordinat (41.0082, 28.9784) veya tam harita bağlantısı yapıştırın.')
      }
    } finally {
      setLocBusy(false)
    }
  }

  // Koordinattan il/ilce'yi otomatik doldur (bos olan alanlar icin).
  async function applyGeo(gps: GpsPoint): Promise<'ok' | 'nomatch' | 'fail'> {
    try {
      const geo = await reverseGeocode(gps)
      if (!geo) return 'fail'
      const match = matchToSeed(geo, cities ?? [])
      if (!match) return 'nomatch'
      const cityDistricts = (cities ?? []).find((c) => c.name === match.city)?.districts ?? []
      // Konum belirleyicidir: il/ilce'yi konumdan ALIR (uzerine yazar).
      setForm((f) => {
        // ilce eslesmediyse: eski ilce yeni ilin bir ilcesiyse koru, degilse temizle
        const keepOld = cityDistricts.includes(f.district) ? f.district : ''
        return {
          ...f,
          city: match.city,
          district: match.district || keepOld
        }
      })
      return 'ok'
    } catch {
      return 'fail'
    }
  }

  // Manuel: kayitli GPS'ten il/ilce bul (sonucu ekranda goster)
  async function findRegion() {
    if (!form.gps) {
      setGeoMsg('Önce konum ekle (📍 Konumu Al ya da Konum Yapıştır).')
      return
    }
    setGeoBusy(true)
    setGeoMsg('Konumdan il/ilçe aranıyor…')
    const r = await applyGeo(form.gps)
    setGeoMsg(
      r === 'ok'
        ? '✓ İl/ilçe konumdan dolduruldu.'
        : r === 'nomatch'
          ? 'Bu konumun ili listede yok. Aşağıdan elle seçebilir ya da Ayarlar’dan ili ekleyebilirsin.'
          : 'Harita servisine ulaşılamadı (internet?). Aşağıdan elle seçebilirsin.'
    )
    setGeoBusy(false)
  }

  // Ekran goruntusunden konum: goruntudeki yazili koordinati yapay zeka okur
  async function onScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (shotRef.current) shotRef.current.value = '' // ayni dosya tekrar secilebilsin
    if (!file) return
    setLocMsg('')
    setAiBusy(true)
    try {
      const settings = await getSettings()
      if (!settings.anthropicApiKey) {
        setLocMsg('Bunun için Ayarlar → Yapay Zeka bölümünden bir API anahtarı girmelisin.')
        return
      }
      setLocMsg('Görüntü okunuyor…')
      // Metin okunabilsin diye yuksek cozunurluk (fazla kucultme)
      const dataUrl = await fileToResizedDataUrl(file, 1568, 0.92)
      const point = await extractCoordsFromImage(dataUrl, settings.anthropicApiKey)
      if (point) {
        update('gps', point)
        applyGeo(point)
        setLocMsg(`✓ Konum alındı (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}).`)
      } else {
        setLocMsg('Görüntüde yazılı bir koordinat bulunamadı. Haritalar’da iğneyi bırakıp, ' +
          'koordinat sayıları ekranda görünürken ekran görüntüsü al.')
      }
    } catch (err) {
      setLocMsg(err instanceof Error ? err.message : 'Görüntü okunamadı.')
    } finally {
      setAiBusy(false)
    }
  }

  async function save() {
    if (!form.companyTitle.trim() && !form.contactName.trim()) {
      setError('En az firma ünvanı veya yetkili adı girin.')
      return
    }
    const now = Date.now()
    if (editing) {
      await db.customers.update(Number(id), { ...form, updatedAt: now })
    } else {
      await db.customers.add({ ...form, createdAt: now, updatedAt: now })
    }
    navigate('/')
  }

  async function remove() {
    if (!editing) return
    if (!confirm('Bu müşteriyi silmek istediğinize emin misiniz?')) return
    // Numarayi engelle: rehber tekrar aktarilinca geri gelmesin
    if (form.phone?.trim()) await addIgnoredPhones([form.phone.trim()])
    await db.customers.delete(Number(id))
    navigate('/')
  }

  if (!loaded) return <div className="p-8 text-center text-slate-400">Yükleniyor…</div>

  return (
    <div>
      <Header
        title={editing ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}
        right={
          <button onClick={() => navigate(-1)} className="text-white/90 text-sm">
            Vazgeç
          </button>
        }
      />

      <div className="p-3 space-y-4">
        {error && <p className="card p-3 bg-red-50 text-red-700 text-sm border-red-200">{error}</p>}

        {/* Fotograf */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center"
          >
            {form.photo ? (
              <img src={form.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl text-slate-400">📷</span>
            )}
          </button>
          {form.photo && (
            <button onClick={() => update('photo', undefined)} className="text-xs text-red-600">
              Fotoğrafı kaldır
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhoto}
          />
        </div>

        <Section title="Kimlik">
          <Field label="Firma Ünvanı">
            <input className="field-input" value={form.companyTitle} onChange={(e) => update('companyTitle', e.target.value)} />
          </Field>
          <Field label="Yetkili Adı Soyadı">
            <input className="field-input" value={form.contactName} onChange={(e) => update('contactName', e.target.value)} />
          </Field>
          <Field label="Görevi">
            <input className="field-input" value={form.role} onChange={(e) => update('role', e.target.value)} placeholder="örn. Satın Alma Müdürü" />
          </Field>
          <Field label="Telefon Numarası">
            <input className="field-input" value={form.phone} onChange={(e) => update('phone', e.target.value)} inputMode="tel" placeholder="05XX XXX XX XX" />
          </Field>
        </Section>

        <Section title="Adres">
          <div className="grid grid-cols-2 gap-2">
            <Field label="İl">
              <select
                className="field-input"
                value={form.city}
                onChange={(e) => {
                  update('city', e.target.value)
                  update('district', '')
                }}
              >
                <option value="">Seçin</option>
                {cities?.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="İlçe">
              <select className="field-input" value={form.district} onChange={(e) => update('district', e.target.value)} disabled={!form.city}>
                <option value="">Seçin</option>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Kayitli konumdan il/ilce doldur (geri bildirimli) */}
          <div>
            <button
              onClick={findRegion}
              disabled={geoBusy || !form.gps}
              className="btn-ghost w-full"
            >
              {geoBusy ? 'Aranıyor…' : '📍 Konumdan İl/İlçe Bul'}
            </button>
            {geoMsg && (
              <p
                className={`text-xs mt-1 ${geoMsg.startsWith('✓') ? 'text-green-700' : 'text-amber-700'}`}
              >
                {geoMsg}
              </p>
            )}
          </div>

          <Field label="GPS Konumu">
            <div className="flex items-center gap-2">
              <button onClick={captureGps} disabled={gpsBusy} className="btn-ghost flex-1">
                {gpsBusy ? 'Alınıyor…' : '📍 Konumu Al'}
              </button>
              {form.gps && (
                <button onClick={() => update('gps', undefined)} className="btn-danger px-3" aria-label="Konumu sil">
                  ✕
                </button>
              )}
            </div>
            {form.gps && (
              <p className="text-xs text-slate-500 mt-1">
                {form.gps.lat.toFixed(5)}, {form.gps.lng.toFixed(5)}{' '}
                <a
                  className="text-brand-700 underline"
                  href={`https://www.google.com/maps?q=${form.gps.lat},${form.gps.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Haritada gör
                </a>
              </p>
            )}
          </Field>

          <Field label="Konum Yapıştır (Google Haritalar)">
            <div className="flex items-center gap-2">
              <input
                className="field-input"
                value={locInput}
                onChange={(e) => setLocInput(e.target.value)}
                placeholder="41.0082, 28.9784 veya harita bağlantısı"
                inputMode="text"
              />
              <button onClick={applyPastedLocation} disabled={!locInput.trim() || locBusy} className="btn-ghost px-4">
                {locBusy ? '…' : 'Uygula'}
              </button>
            </div>
            {locMsg && (
              <p
                className={`text-xs mt-1 whitespace-pre-line break-words ${
                  locMsg.startsWith('✓') ? 'text-green-700' : 'text-amber-700'
                }`}
              >
                {locMsg}
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              İpucu: Koordinat çıkmıyorsa, işletme adının olduğu bir yere basmışsındır. Haritalar’da
              biraz <b>yakınlaş</b> ve binanın <b>boş bir noktasına parmağını basılı tut</b> →
              kırmızı bir iğne düşer ve altta koordinatlar çıkar → dokununca kopyalanır → buraya yapıştır.
            </p>
          </Field>

          <Field label="Ekran Görüntüsünden Konum (yapay zeka)">
            <button onClick={() => shotRef.current?.click()} disabled={aiBusy} className="btn-ghost w-full">
              {aiBusy ? 'Okunuyor…' : '📷 Ekran Görüntüsü Seç'}
            </button>
            <input
              ref={shotRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onScreenshot}
            />
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Haritalar’da konumu aç, <b>koordinat sayıları ekranda görünürken</b> ekran görüntüsü al;
              sonra buradan o görüntüyü seç. Yapay zeka koordinatı okuyup yazar. (Ayarlar’dan API anahtarı gerekir.)
            </p>
          </Field>
        </Section>

        <Section title="Ticari Bilgiler">
          <Field label="Sektör">
            <input
              className="field-input"
              list="sektor-list"
              value={form.sector}
              onChange={(e) => update('sector', e.target.value)}
              placeholder="Yaz ya da önceki sektörlerden seç"
            />
            <datalist id="sektor-list">
              {(sectorOptions ?? []).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="m² Alanı">
              <input className="field-input" type="number" inputMode="numeric" value={form.areaM2 ?? ''} onChange={(e) => update('areaM2', e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="Çalışan Sayısı">
              <input className="field-input" type="number" inputMode="numeric" value={form.employeeCount ?? ''} onChange={(e) => update('employeeCount', e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
          </div>
          <Field label={`Risk Puanı: ${form.riskScore ?? '-'} / 10`}>
            <input
              type="range"
              min={1}
              max={10}
              value={form.riskScore ?? 5}
              onChange={(e) => update('riskScore', Number(e.target.value))}
              className="w-full accent-brand-700"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Mülkiyet Durumu">
              <select className="field-input" value={form.ownership} onChange={(e) => update('ownership', e.target.value as Ownership)}>
                {ownershipOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ödeme Şekli">
              <select className="field-input" value={form.paymentType} onChange={(e) => update('paymentType', e.target.value as PaymentType)}>
                {paymentOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Vade">
            <input className="field-input" value={form.term ?? ''} onChange={(e) => update('term', e.target.value)} placeholder="örn. 60 gün" />
          </Field>
        </Section>

        <Section title="Diğer">
          <Field label="Makine Parkuru">
            <textarea className="field-input" rows={2} value={form.machinePark ?? ''} onChange={(e) => update('machinePark', e.target.value)} />
          </Field>
          <Field label="Yetkili Doğum Tarihi">
            <input className="field-input" type="date" value={form.birthDate ?? ''} onChange={(e) => update('birthDate', e.target.value)} />
          </Field>
          <Field label="Özel Notlar">
            <textarea className="field-input" rows={3} value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)} />
          </Field>
        </Section>

        <div className="flex gap-2 pt-2">
          <button onClick={save} className="btn-primary flex-1">
            💾 Kaydet
          </button>
          {editing && (
            <button onClick={remove} className="btn-danger px-4">
              🗑️ Sil
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-3 space-y-3">
      <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}
