import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import MiniChart from '../components/MiniChart'
import {
  listMeasurements,
  addMeasurement,
  deleteMeasurement,
  listVitals,
  addVital,
  deleteVital
} from '../db'
import { todayStr } from '../streak'
import type { Measurement } from '../types'

type Tab = 'olcu' | 'saglik'

// Olcu metrikleri (grafik secimi icin)
const METRICS: { key: keyof Measurement; label: string; unit: string; color: string }[] = [
  { key: 'weight', label: 'Kilo', unit: 'kg', color: '#059669' },
  { key: 'waist', label: 'Bel', unit: 'cm', color: '#0ea5e9' },
  { key: 'navel', label: 'Göbek', unit: 'cm', color: '#f59e0b' },
  { key: 'fold', label: 'Kıvrım', unit: 'cm', color: '#ef4444' },
  { key: 'hip', label: 'Kalça', unit: 'cm', color: '#8b5cf6' },
  { key: 'chest', label: 'Göğüs', unit: 'cm', color: '#ec4899' },
  { key: 'arm', label: 'Kol', unit: 'cm', color: '#14b8a6' },
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
      </div>
    </div>
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
          <div key={m.id} className="card p-3 flex items-center justify-between">
            <div className="text-sm">
              <p className="font-semibold text-slate-700">{m.dateStr}</p>
              <p className="text-slate-500 text-xs">
                {METRICS.filter((x) => typeof m[x.key] === 'number')
                  .map((x) => `${x.label}: ${m[x.key]}${x.unit}`)
                  .join(' · ') || '—'}
              </p>
            </div>
            <button onClick={() => deleteMeasurement(m.id!)} className="text-slate-300 hover:text-rose-500 px-1">
              🗑️
            </button>
          </div>
        ))}
      </section>
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

  const sugarPoints = rows
    .filter((v) => v.kind === 'seker' && typeof v.sugar === 'number')
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
      <section className="card p-3 space-y-2">
        <h3 className="text-xs font-bold text-rose-500 uppercase tracking-wide">🩸 Kan Şekeri (mg/dL)</h3>
        <MiniChart points={sugarPoints} color="#ef4444" unit="mg/dL" />
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
              <p className="text-slate-500 text-xs">
                {v.kind === 'seker'
                  ? `${v.sugar} mg/dL${v.sugarContext ? ` (${v.sugarContext})` : ''}`
                  : `${v.systolic}/${v.diastolic}${v.pulse ? ` · nabız ${v.pulse}` : ''}`}
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

  async function save() {
    const base = { kind, dateStr: date, time }
    if (kind === 'seker') {
      if (!sugar) {
        alert('Şeker değeri gir.')
        return
      }
      await addVital({ ...base, sugar: Number(sugar.replace(',', '.')), sugarContext })
      setSugar('')
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
    </section>
  )
}
