import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import MiniChart from '../components/MiniChart'
import {
  dietDb,
  listMeasurements,
  addMeasurement,
  deleteMeasurement,
  updateMeasurement,
  listVitals,
  addVital,
  deleteVital,
  readDietSettings,
  getStepsRow,
  setActivityDay
} from '../db'
import { analyzeMealSugar, quickMealSugarNote } from '../ai'
import { buildHealthContext } from '../lib/context'
import { todayStr } from '../streak'
import { buildMeasurementsReport } from '../lib/report'
import { buildMeasurementsImage, buildLatestMeasurementImage, buildVitalReportImage, buildLastDayVitalImage } from '../lib/reportImage'
import { shareTextSmart, shareImageSmart } from '../lib/share'
import type { Measurement } from '../types'

type Tab = 'olcu' | 'saglik'

// Olcu metrikleri (grafik secimi icin)
const METRICS: { key: keyof Measurement; label: string; unit: string; color: string }[] = [
  { key: 'weight', label: 'Kilo', unit: 'kg', color: '#059669' },
  { key: 'arm', label: 'Kol', unit: 'cm', color: '#14b8a6' },
  { key: 'chest', label: 'Göğüs', unit: 'cm', color: '#ec4899' },
  { key: 'fold', label: 'Bel kıvrımı', unit: 'cm', color: '#ef4444' },
  { key: 'navel', label: 'Göbek deliği', unit: 'cm', color: '#f59e0b' },
  { key: 'hip', label: 'Kalça', unit: 'cm', color: '#8b5cf6' },
  { key: 'leg', label: 'Bacak', unit: 'cm', color: '#64748b' }
]

const RANGES = [
  { days: 7, label: '7 gün' },
  { days: 30, label: '30 gün' },
  { days: 90, label: '90 gün' },
  { days: 0, label: 'Tümü' }
]

function withinRange(dateStr: string, days: number): boolean {
  if (days === 0) return true
  const d = new Date(dateStr + 'T00:00:00').getTime()
  return d >= Date.now() - days * 86_400_000
}

// Tarihi kisa goster (gg.aa)
function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${d}.${m}`
}

export default function Track() {
  // URL'de ?tab=saglik varsa dogrudan Seker & Tansiyon sekmesiyle ac
  const location = useLocation()
  const initialTab: Tab = new URLSearchParams(location.search).get('tab') === 'saglik' ? 'saglik' : 'olcu'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [range, setRange] = useState(30)

  return (
    <div>
      <DietHeader title="Takip" subtitle="Ölçü, kilo, şeker, tansiyon" />

      <div className="p-3 space-y-4">
        {/* Sekme secici */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab('olcu')}
            className={`btn py-2.5 ${tab === 'olcu' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            📏 Ölçü & Kilo
          </button>
          <button
            onClick={() => setTab('saglik')}
            className={`btn py-2.5 ${tab === 'saglik' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            🩺 Şeker & Tansiyon
          </button>
        </div>

        {/* Tarih araligi */}
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`flex-1 text-xs font-semibold rounded-lg py-1.5 ${
                range === r.days ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {tab === 'olcu' ? <MeasurePanel range={range} /> : <VitalPanel range={range} />}

        {/* Günlük aktivite (Samsung Health vb.'den elle) — her iki sekmede de görünür */}
        <ActivityPanel />

        {/* Yemek–seker baglanti analizi (yalnizca saglik sekmesinde) */}
        {tab === 'saglik' && <SugarMealInsight />}

        {/* Diyetisyene ölçüm raporu gönder (kilo/ölçü + şeker/tansiyon) */}
        <SendMeasurements />
      </div>
    </div>
  )
}

// Gunluk aktivite girisi (Samsung Health / akilli saatten elle): adim, etkin sure,
// aktivite kalorisi, yakilan toplam kalori, mesafe. Sağlık bağlamına + raporlara girer.
function ActivityPanel() {
  const today = todayStr()
  const row = useLiveQuery(() => getStepsRow(today), [today], undefined)
  const [open, setOpen] = useState(false)
  const [steps, setSteps] = useState('')
  const [amin, setAmin] = useState('')
  const [akcal, setAkcal] = useState('')
  const [bkcal, setBkcal] = useState('')
  const [dist, setDist] = useState('')
  const [msg, setMsg] = useState('')
  const [loaded, setLoaded] = useState(false)

  // Kayitli degerleri forma yukle (bir kez, panel acilinca)
  function edit() {
    setSteps(row?.count ? String(row.count) : '')
    setAmin(row?.activeMin ? String(row.activeMin) : '')
    setAkcal(row?.activeKcal ? String(row.activeKcal) : '')
    setBkcal(row?.burnedKcal ? String(row.burnedKcal) : '')
    setDist(row?.distanceKm ? String(row.distanceKm) : '')
    setLoaded(true)
    setOpen(true)
  }

  async function save() {
    const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : undefined)
    await setActivityDay(today, {
      count: num(steps) ?? 0,
      activeMin: num(amin),
      activeKcal: num(akcal),
      burnedKcal: num(bkcal),
      distanceKm: num(dist)
    })
    setMsg('Kaydedildi 👍')
    setOpen(false)
    setTimeout(() => setMsg(''), 2500)
  }

  const has = !!(row?.count || row?.activeMin || row?.activeKcal || row?.burnedKcal || row?.distanceKm)

  return (
    <section className="card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">🏃 Günlük Aktivite</h3>
        {!open && (
          <button onClick={edit} className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-3 py-1">
            {has ? '✏️ Düzenle' : '＋ Gir'}
          </button>
        )}
      </div>

      {!open ? (
        has ? (
          <p className="text-xs text-slate-500">
            Bugün:
            {row?.count ? ` ${row.count.toLocaleString('tr-TR')} adım` : ''}
            {row?.activeMin ? ` · ${row.activeMin} dk etkin` : ''}
            {row?.activeKcal ? ` · ${row.activeKcal} kcal aktivite` : ''}
            {row?.burnedKcal ? ` · ${row.burnedKcal} kcal toplam` : ''}
            {row?.distanceKm ? ` · ${row.distanceKm} km` : ''}
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Akıllı saatinden (Samsung Health vb.) bugünkü değerleri gir; koç ve raporlar bunları kullanır.
          </p>
        )
      ) : (
        <div className="space-y-2">
          {!loaded && null}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-slate-500">
              👟 Adım
              <input type="number" inputMode="numeric" className="num-input" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="16307" />
            </label>
            <label className="text-[11px] text-slate-500">
              ⏱️ Etkin süre (dk)
              <input type="number" inputMode="numeric" className="num-input" value={amin} onChange={(e) => setAmin(e.target.value)} placeholder="170" />
            </label>
            <label className="text-[11px] text-slate-500">
              🔥 Aktivite kalorisi
              <input type="number" inputMode="numeric" className="num-input" value={akcal} onChange={(e) => setAkcal(e.target.value)} placeholder="760" />
            </label>
            <label className="text-[11px] text-slate-500">
              🔋 Yakılan toplam kcal
              <input type="number" inputMode="numeric" className="num-input" value={bkcal} onChange={(e) => setBkcal(e.target.value)} placeholder="2802" />
            </label>
            <label className="text-[11px] text-slate-500 col-span-2">
              📍 Mesafe (km)
              <input type="number" inputMode="decimal" className="num-input" value={dist} onChange={(e) => setDist(e.target.value)} placeholder="12.08" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setOpen(false)} className="btn bg-slate-200 text-slate-700 py-2">
              Vazgeç
            </button>
            <button onClick={save} className="btn-primary py-2">
              Kaydet
            </button>
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-emerald-700 font-semibold">{msg}</p>}
    </section>
  )
}

// Yemek–seker baglantisi: ogunler ile sonrasindaki olcumleri eslestirip
// yapay zekadan kisisel oruntu analizi ister; diyetisyene gonderilebilir.
function SugarMealInsight() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const hasKey = !!settings?.apiKey

  async function analyze() {
    if (!hasKey) return
    setBusy(true)
    setError('')
    setText('')
    try {
      const [vitals, entries] = await Promise.all([listVitals(), dietDb.entries.toArray()])
      const sugars = vitals.filter((v) => v.kind === 'seker' && typeof v.sugar === 'number')
      if (sugars.length < 3) {
        setError('Analiz için en az 3 şeker ölçümü gerekli. Ölçtükçe buradan analiz alabilirsin.')
        setBusy(false)
        return
      }
      // Her olcumu, ayni gun 10 dk - 3.5 saat oncesindeki yenen ogunlerle eslestir
      const lines: string[] = []
      for (const v of [...sugars].sort((a, b) => a.createdAt - b.createdAt)) {
        const t = new Date(v.dateStr + 'T' + (v.time || '12:00') + ':00').getTime()
        const meals = entries.filter(
          (e) =>
            e.decision === 'ate' &&
            e.dateStr === v.dateStr &&
            t - e.createdAt > 10 * 60_000 &&
            t - e.createdAt < 3.5 * 3_600_000
        )
        const before = meals.map((m) => `${m.foodName} (~${m.estimatedCalories} kcal)`).join(' + ')
        lines.push(
          `${v.dateStr} ${v.time} — Şeker ${v.sugar} mg/dL${v.sugarContext ? ` (${v.sugarContext})` : ''}${
            before ? ` ← öncesinde: ${before}` : ' (öncesinde kayıtlı öğün yok)'
          }`
        )
      }
      const result = await analyzeMealSugar({
        apiKey: settings!.apiKey!,
        pairsText: lines.join('\n'),
        model: settings?.model,
        userName: settings?.userName,
        goal: settings?.goal,
        medications: settings?.medications,
        dietitianNotes: settings?.dietitianNotes,
        health: await buildHealthContext(settings)
      })
      setText(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analiz başarısız.')
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    const res = await shareTextSmart(`🩸 Yemek–Şeker Bağlantı Analizi\n\n${text}\n\n— Diyet Koçu uygulamasından gönderildi`)
    if (res === 'shared') setMsg('Paylaşım menüsü açıldı.')
    else if (res === 'copied') setMsg('Panoya kopyalandı.')
    else if (res !== 'cancelled') setMsg('Gönderilemedi.')
    setTimeout(() => setMsg(''), 3500)
  }

  return (
    <section className="card p-3 space-y-2 bg-rose-50 border-rose-100">
      <h3 className="font-bold text-rose-800 text-sm uppercase tracking-wide">🩸 Yemek–Şeker Bağlantısı</h3>
      <p className="text-xs text-slate-500">
        Şeker ölçümlerini önceki öğünlerle eşleştirir: hangi yemek şekerini yükseltiyor, hangisi iyi geliyor.
      </p>
      {!hasKey ? (
        <p className="text-xs text-slate-500">Bu analiz için Ayarlar’dan API anahtarı ekle.</p>
      ) : (
        <button onClick={analyze} disabled={busy} className="btn bg-rose-600 text-white w-full">
          {busy ? 'Analiz ediliyor…' : '🧠 Bağlantıyı Analiz Et'}
        </button>
      )}
      <p className="text-[11px] text-slate-400">Yapay zeka kullanır (tek seferlik). Tıbbi teşhis değildir.</p>
      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
      {text && (
        <div className="space-y-2">
          <p className="text-sm text-slate-800 bg-white rounded-xl p-3 leading-snug whitespace-pre-wrap">{text}</p>
          <button onClick={send} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 w-full">
            📤 Diyetisyene gönder
          </button>
          {msg && <p className="text-xs text-rose-700 font-semibold">{msg}</p>}
        </div>
      )}
    </section>
  )
}

// Ölçümleri (yemeklerden ayrı) diyetisyene rapor olarak gönderir
function SendMeasurements() {
  const [days, setDays] = useState(30)
  const [msg, setMsg] = useState('')

  async function sendText() {
    const settings = await readDietSettings()
    const text = await buildMeasurementsReport(days, settings.userName)
    const res = await shareTextSmart(text)
    if (res === 'shared') setMsg('Paylaşım menüsü açıldı — WhatsApp’ı seç.')
    else if (res === 'copied') setMsg('Rapor panoya kopyalandı, WhatsApp’a yapıştır.')
    else if (res === 'cancelled') setMsg('')
    else setMsg('Gönderilemedi.')
    setTimeout(() => setMsg(''), 4000)
  }

  // Sadece son ölçüleri gönder (kilo dahil, her ölçünün en güncel değeri) —
  // okunaklı GÖRSEL kart olarak. Yazılı istenirse aşağıdaki dönem butonları var.
  async function sendLatest() {
    setMsg('Görsel hazırlanıyor…')
    try {
      const settings = await readDietSettings()
      const blob = await buildLatestMeasurementImage(settings.userName)
      const res = await shareImageSmart(blob, 'son-olcum.png')
      if (res === 'shared') setMsg('Paylaşım menüsü açıldı — WhatsApp’ı seç.')
      else if (res === 'copied') setMsg('Görsel indirildi, diyetisyenine gönderebilirsin.')
      else if (res === 'cancelled') setMsg('')
      else setMsg('Gönderilemedi.')
    } catch {
      setMsg('Görsel oluşturulamadı.')
    }
    setTimeout(() => setMsg(''), 4000)
  }

  async function sendImage() {
    setMsg('Görsel rapor hazırlanıyor…')
    try {
      const settings = await readDietSettings()
      const blob = await buildMeasurementsImage(days, settings.userName)
      const res = await shareImageSmart(blob, `olcum-rapor-${days || 'tum'}gun.png`)
      if (res === 'shared') setMsg('Paylaşım menüsü açıldı — WhatsApp’ı seç.')
      else if (res === 'copied') setMsg('Görsel indirildi, diyetisyenine gönderebilirsin.')
      else if (res === 'cancelled') setMsg('')
      else setMsg('Görsel gönderilemedi.')
    } catch {
      setMsg('Görsel rapor oluşturulamadı.')
    }
    setTimeout(() => setMsg(''), 4000)
  }

  // SADECE şeker ya da SADECE tansiyon raporunu ayrı gönder (seçili dönem)
  async function sendVital(kind: 'seker' | 'tansiyon') {
    setMsg('Görsel hazırlanıyor…')
    try {
      const settings = await readDietSettings()
      const blob = await buildVitalReportImage(kind, days, settings.userName)
      const res = await shareImageSmart(blob, `${kind === 'seker' ? 'seker' : 'tansiyon'}-rapor-${days || 'tum'}gun.png`)
      if (res === 'shared') setMsg('Paylaşım menüsü açıldı — WhatsApp’ı seç.')
      else if (res === 'copied') setMsg('Görsel indirildi, diyetisyenine gönderebilirsin.')
      else if (res === 'cancelled') setMsg('')
      else setMsg('Görsel gönderilemedi.')
    } catch {
      setMsg('Görsel oluşturulamadı.')
    }
    setTimeout(() => setMsg(''), 4000)
  }

  // SADECE SON GÜNÜN şekeri (öğünlerle) ya da tansiyonu — ayrı ayrı gönder
  async function sendVitalDay(kind: 'seker' | 'tansiyon') {
    setMsg('Görsel hazırlanıyor…')
    try {
      const settings = await readDietSettings()
      const blob = await buildLastDayVitalImage(kind, settings.userName)
      const res = await shareImageSmart(blob, `${kind === 'seker' ? 'seker' : 'tansiyon'}-songun.png`)
      if (res === 'shared') setMsg('Paylaşım menüsü açıldı — WhatsApp’ı seç.')
      else if (res === 'copied') setMsg('Görsel indirildi, diyetisyenine gönderebilirsin.')
      else if (res === 'cancelled') setMsg('')
      else setMsg('Görsel gönderilemedi.')
    } catch {
      setMsg('Görsel oluşturulamadı.')
    }
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <section className="card p-3 space-y-2">
      <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">📤 Ölçümleri Diyetisyene Gönder</h3>

      {/* Hizli: sadece EN SON olcum (donem secmeye gerek yok) */}
      <button onClick={sendLatest} className="btn-primary w-full whitespace-nowrap">
        📍 Sadece Son Ölçümü Gönder
      </button>

      <p className="text-xs text-slate-500 pt-1">
        Ya da dönem seçip tümünü gönder (kilo, ölçü, şeker, tansiyon):
      </p>
      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`flex-1 text-xs font-semibold rounded-lg py-1.5 ${
              days === r.days ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={sendText} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 whitespace-nowrap">
          ✍️ Yazılı Gönder
        </button>
        <button onClick={sendImage} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 whitespace-nowrap">
          📸 Resimli Gönder
        </button>
      </div>

      <p className="text-xs text-slate-500 pt-1">Ya da tek tek gönder (seçili dönem):</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => sendVital('seker')} className="btn bg-rose-50 text-rose-700 border border-rose-100 whitespace-nowrap">
          🩸 Sadece Şeker
        </button>
        <button onClick={() => sendVital('tansiyon')} className="btn bg-sky-50 text-sky-700 border border-sky-100 whitespace-nowrap">
          🩺 Sadece Tansiyon
        </button>
      </div>

      <p className="text-xs text-slate-500 pt-1">Ya da yalnızca SON GÜN (şeker öğünlerle birlikte):</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => sendVitalDay('seker')} className="btn bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">
          🩸 Son Günün Şekeri
        </button>
        <button onClick={() => sendVitalDay('tansiyon')} className="btn bg-sky-100 text-sky-800 border border-sky-200 whitespace-nowrap">
          🩺 Son Günün Tansiyonu
        </button>
      </div>
      {msg && <p className="text-xs text-emerald-700 font-semibold">{msg}</p>}
    </section>
  )
}

// ---------------- Ölçü & Kilo paneli ----------------
function MeasurePanel({ range }: { range: number }) {
  const all = useLiveQuery(() => listMeasurements(), [], [])
  const rows = (all ?? []).filter((m) => withinRange(m.dateStr, range))
  const [metric, setMetric] = useState<keyof Measurement>('weight')
  const activeMetric = METRICS.find((m) => m.key === metric)!

  const points = rows
    .filter((m) => typeof m[metric] === 'number')
    .map((m) => ({ label: shortDate(m.dateStr), value: m[metric] as number }))

  return (
    <div className="space-y-4">
      {/* Grafik */}
      <section className="card p-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                metric === m.key ? 'text-white' : 'bg-slate-100 text-slate-600'
              }`}
              style={metric === m.key ? { backgroundColor: m.color } : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>
        <MiniChart points={points} color={activeMetric.color} unit={activeMetric.unit} />
      </section>

      <MeasureForm />

      {/* Liste */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Kayıtlar</h3>
        {rows.length === 0 && <p className="text-sm text-slate-400 px-1">Bu aralıkta kayıt yok.</p>}
        {[...rows].reverse().map((m) => (
          <MeasureRow key={m.id} m={m} />
        ))}
      </section>
    </div>
  )
}

// Tek bir olcum kaydi: goster + DUZENLE (yanlis girileni duzelt) + sil.
function MeasureRow({ m }: { m: Measurement }) {
  const [editing, setEditing] = useState(false)
  const [vals, setVals] = useState<Record<string, string>>({})

  function startEdit() {
    const init: Record<string, string> = {}
    for (const x of METRICS) {
      const v = m[x.key]
      if (typeof v === 'number') init[x.key as string] = String(v)
    }
    setVals(init)
    setEditing(true)
  }

  async function saveEdit() {
    const patch: Partial<Measurement> = {}
    for (const x of METRICS) {
      const raw = (vals[x.key as string] ?? '').trim().replace(',', '.')
      const n = Number(raw)
      // Bos ya da gecersiz -> alan silinir (undefined); gecerli sayi -> yaz
      patch[x.key] = raw === '' || isNaN(n) ? undefined : (n as never)
    }
    await updateMeasurement(m.id!, patch)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="card p-3 space-y-2">
        <p className="font-semibold text-slate-700 text-sm">{m.dateStr} — düzelt</p>
        <div className="grid grid-cols-2 gap-2">
          {METRICS.map((x) => (
            <label key={x.key} className="text-xs text-slate-500">
              {x.label} ({x.unit})
              <input
                type="number"
                inputMode="decimal"
                className="field-input mt-0.5"
                value={vals[x.key as string] ?? ''}
                onChange={(e) => setVals((s) => ({ ...s, [x.key as string]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setEditing(false)} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 py-2">
            Vazgeç
          </button>
          <button onClick={saveEdit} className="btn-primary py-2">
            Kaydet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-3 flex items-center justify-between">
      <div className="text-sm">
        <p className="font-semibold text-slate-700">{m.dateStr}</p>
        <p className="text-slate-500 text-xs">
          {METRICS.filter((x) => typeof m[x.key] === 'number')
            .map((x) => `${x.label}: ${m[x.key]}${x.unit}`)
            .join(' · ') || '—'}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={startEdit} className="text-slate-400 hover:text-brand-600 px-1" title="Düzelt">
          ✏️
        </button>
        <button onClick={() => deleteMeasurement(m.id!)} className="text-slate-300 hover:text-rose-500 px-1" title="Sil">
          🗑️
        </button>
      </div>
    </div>
  )
}

function MeasureForm() {
  const [date, setDate] = useState(todayStr())
  const [vals, setVals] = useState<Record<string, string>>({})

  function set(k: string, v: string) {
    setVals((s) => ({ ...s, [k]: v }))
  }

  async function save() {
    const m: Omit<Measurement, 'id' | 'createdAt'> = { dateStr: date }
    let any = false
    for (const x of METRICS) {
      const raw = vals[x.key]?.replace(',', '.')
      if (raw && !isNaN(Number(raw))) {
        ;(m as unknown as Record<string, number>)[x.key] = Number(raw)
        any = true
      }
    }
    if (!any) {
      alert('En az bir ölçü gir.')
      return
    }
    await addMeasurement(m)
    setVals({})
  }

  return (
    <section className="card p-3 space-y-3">
      <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Yeni Ölçü Ekle</h3>
      <div>
        <label className="field-label">Tarih</label>
        <input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {METRICS.map((x) => (
          <div key={x.key}>
            <label className="field-label">
              {x.label} ({x.unit})
            </label>
            <input
              type="number"
              inputMode="decimal"
              className="field-input"
              placeholder="—"
              value={vals[x.key] ?? ''}
              onChange={(e) => set(x.key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <button onClick={save} className="btn-primary w-full">
        Kaydet
      </button>
    </section>
  )
}

// ---------------- Şeker & Tansiyon paneli ----------------
function VitalPanel({ range }: { range: number }) {
  const all = useLiveQuery(() => listVitals(), [], [])
  const rows = (all ?? []).filter((v) => withinRange(v.dateStr, range))

  // Aclik ve tok sekerini AYRI grafiklerde goster (karisinca yaniltici oluyor)
  const isTok = (v: { sugarContext?: string }) => (v.sugarContext ?? '').toLowerCase().startsWith('tok')
  const sugarAcPoints = rows
    .filter((v) => v.kind === 'seker' && typeof v.sugar === 'number' && !isTok(v))
    .map((v) => ({ label: shortDate(v.dateStr), value: v.sugar as number }))
  const sugarTokPoints = rows
    .filter((v) => v.kind === 'seker' && typeof v.sugar === 'number' && isTok(v))
    .map((v) => ({ label: shortDate(v.dateStr), value: v.sugar as number }))
  const sysPoints = rows
    .filter((v) => v.kind === 'tansiyon' && typeof v.systolic === 'number')
    .map((v) => ({ label: shortDate(v.dateStr), value: v.systolic as number }))
  const diaPoints = rows
    .filter((v) => v.kind === 'tansiyon' && typeof v.diastolic === 'number')
    .map((v) => ({ label: shortDate(v.dateStr), value: v.diastolic as number }))
  const pulsePoints = rows
    .filter((v) => v.kind === 'tansiyon' && typeof v.pulse === 'number')
    .map((v) => ({ label: shortDate(v.dateStr), value: v.pulse as number }))

  return (
    <div className="space-y-4">
      <Link
        to="/checkup"
        className="card p-3 flex items-center gap-3 bg-gradient-to-br from-teal-50 to-emerald-50 border-emerald-100 active:scale-[0.99] transition"
      >
        <span className="text-2xl">🩺</span>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">Sağlık Check-up</p>
          <p className="text-xs text-slate-500">Şeker, tansiyon, tahlil ve kilonu bir arada hekim gibi yorumlasın; sağlık sorularını sor.</p>
        </div>
        <span className="text-emerald-600 text-xl">›</span>
      </Link>

      <section className="card p-3 space-y-2">
        <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wide">🩸 Açlık Şekeri (mg/dL)</h3>
        {sugarAcPoints.length ? (
          <MiniChart points={sugarAcPoints} color="#d97706" unit="mg/dL" />
        ) : (
          <p className="text-xs text-slate-400">Açlık ölçümü yok.</p>
        )}
      </section>
      <section className="card p-3 space-y-2">
        <h3 className="text-xs font-bold text-sky-600 uppercase tracking-wide">🩸 Tok Şekeri · yemek sonrası (mg/dL)</h3>
        {sugarTokPoints.length ? (
          <MiniChart points={sugarTokPoints} color="#0284c7" unit="mg/dL" />
        ) : (
          <p className="text-xs text-slate-400">Tok ölçümü yok.</p>
        )}
      </section>
      <section className="card p-3 space-y-2">
        <h3 className="text-xs font-bold text-sky-600 uppercase tracking-wide">💓 Büyük Tansiyon (sistolik)</h3>
        <MiniChart points={sysPoints} color="#0ea5e9" unit="" />
      </section>
      <section className="card p-3 space-y-2">
        <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">🫀 Küçük Tansiyon (diastolik)</h3>
        <MiniChart points={diaPoints} color="#6366f1" unit="" />
      </section>
      <section className="card p-3 space-y-2">
        <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wide">❤️ Nabız</h3>
        <MiniChart points={pulsePoints} color="#f43f5e" unit="" />
      </section>

      <VitalForm />

      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">Kayıtlar</h3>
        {rows.length === 0 && <p className="text-sm text-slate-400 px-1">Bu aralıkta kayıt yok.</p>}
        {[...rows].reverse().map((v) => (
          <div key={v.id} className="card p-3 flex items-center justify-between">
            <div className="text-sm">
              <p className="font-semibold text-slate-700">
                {v.kind === 'seker' ? '🩸 Şeker' : '💓 Tansiyon'} · {v.dateStr} {v.time}
              </p>
              <p className="text-slate-600 text-sm flex items-center gap-1.5 mt-0.5">
                {v.kind === 'seker' ? (
                  <>
                    <span className="font-bold">{v.sugar} mg/dL</span>
                    {v.sugarContext && (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isTok(v) ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isTok(v) ? '🍽️ Tok' : '🕐 Açlık'}
                      </span>
                    )}
                  </>
                ) : (
                  <span>{`${v.systolic}/${v.diastolic}${v.pulse ? ` · nabız ${v.pulse}` : ''}`}</span>
                )}
              </p>
            </div>
            <button onClick={() => deleteVital(v.id!)} className="text-slate-300 hover:text-rose-500 px-1">
              🗑️
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}

function VitalForm() {
  const [kind, setKind] = useState<'seker' | 'tansiyon'>('seker')
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5))
  const [sugar, setSugar] = useState('')
  const [sugarContext, setSugarContext] = useState('aç')
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')
  const [pulse, setPulse] = useState('')
  const [note, setNote] = useState('') // anlik tok-seker notu
  const [noteBusy, setNoteBusy] = useState(false)

  // Tok seker girildiginde, hemen oncesindeki ogunle iliskisini aninda yorumla
  async function instantNote(sugarVal: number, dateStr: string, timeStr: string, ctx: string) {
    setNote('')
    const settings = await readDietSettings()
    if (!settings?.apiKey) return
    const t = new Date(dateStr + 'T' + (timeStr || '12:00') + ':00').getTime()
    const entries = await dietDb.entries.toArray()
    const meals = entries
      .filter((e) => e.decision === 'ate' && e.dateStr === dateStr && t - e.createdAt > 10 * 60_000 && t - e.createdAt < 3.5 * 3_600_000)
      .sort((a, b) => a.createdAt - b.createdAt)
    if (!meals.length) return // eslesecek ogun yoksa not verme
    const mealText = meals.map((m) => `${m.foodName} (~${m.estimatedCalories} kcal)`).join(' + ')
    const minutesAfter = Math.round((t - meals[meals.length - 1].createdAt) / 60_000)
    setNoteBusy(true)
    try {
      const res = await quickMealSugarNote({
        apiKey: settings.apiKey,
        sugar: sugarVal,
        context: ctx,
        time: timeStr,
        meal: mealText,
        minutesAfter,
        model: settings.model,
        health: await buildHealthContext(settings)
      })
      setNote(res)
    } catch {
      /* not verilemezse sessiz gec */
    } finally {
      setNoteBusy(false)
    }
  }

  async function save() {
    const base = { kind, dateStr: date, time }
    if (kind === 'seker') {
      if (!sugar) {
        alert('Şeker değeri gir.')
        return
      }
      const sugarVal = Number(sugar.replace(',', '.'))
      await addVital({ ...base, sugar: sugarVal, sugarContext })
      setSugar('')
      // Tok olcumde ogunle iliskisini aninda yorumla (aclikta ogun oncesi olduğundan atla)
      if (sugarContext.toLowerCase().startsWith('tok')) void instantNote(sugarVal, date, time, sugarContext)
    } else {
      if (!sys || !dia) {
        alert('Büyük ve küçük tansiyonu gir.')
        return
      }
      await addVital({
        ...base,
        systolic: Number(sys),
        diastolic: Number(dia),
        pulse: pulse ? Number(pulse) : undefined
      })
      setSys('')
      setDia('')
      setPulse('')
    }
  }

  return (
    <section className="card p-3 space-y-3">
      <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Yeni Ölçüm Ekle</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setKind('seker')}
          className={`btn py-2 ${kind === 'seker' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          🩸 Şeker
        </button>
        <button
          onClick={() => setKind('tansiyon')}
          className={`btn py-2 ${kind === 'tansiyon' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          💓 Tansiyon
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="field-label">Tarih</label>
          <input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Saat</label>
          <input type="time" className="field-input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      {kind === 'seker' ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="field-label">Şeker (mg/dL)</label>
            <input
              type="number"
              inputMode="numeric"
              className="field-input"
              value={sugar}
              onChange={(e) => setSugar(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Durum</label>
            <select className="field-input" value={sugarContext} onChange={(e) => setSugarContext(e.target.value)}>
              <option value="aç">Aç (açlık)</option>
              <option value="tok">Tok (yemekten sonra)</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="field-label">Büyük</label>
            <input type="number" inputMode="numeric" className="field-input" value={sys} onChange={(e) => setSys(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Küçük</label>
            <input type="number" inputMode="numeric" className="field-input" value={dia} onChange={(e) => setDia(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Nabız</label>
            <input type="number" inputMode="numeric" className="field-input" value={pulse} onChange={(e) => setPulse(e.target.value)} />
          </div>
        </div>
      )}

      <button onClick={save} className="btn-primary w-full">
        Kaydet
      </button>

      {/* Anlik tok-seker notu (yediğin öğünle ilişkisi) */}
      {noteBusy && <p className="text-xs text-rose-600 font-semibold">🩸 Bu ölçümü son öğününle karşılaştırıyorum…</p>}
      {note && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
          <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wide mb-1">🩸 Öğün–Şeker Notu</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-snug">{note}</p>
        </div>
      )}
    </section>
  )
}
