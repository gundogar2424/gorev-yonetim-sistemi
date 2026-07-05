import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import {
  readDietSettings,
  listMeds,
  addMed,
  updateMed,
  deleteMed,
  listMedLogs,
  addMedLog,
  deleteMedLog
} from '../db'
import { applyNotifications } from '../lib/notify'
import { buildHealthContext } from '../lib/context'
import { medComment } from '../ai'
import { todayStr } from '../streak'
import type { MedDef } from '../types'

const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] // 0..6 (getDay)
const REL: { v: MedDef['relation']; l: string }[] = [
  { v: 'tok', l: 'Yemekten sonra (tok)' },
  { v: 'ac', l: 'Aç karnına' },
  { v: 'genel', l: 'Farketmez' }
]
const relShort = (r?: MedDef['relation']) => (r === 'tok' ? 'tok' : r === 'ac' ? 'aç' : '')

// Bir ilacin belli bir tarih araliginda PLANLANAN doz sayisi (gunler x doz saati)
function plannedDoses(m: MedDef, startMs: number, endMs: number): number {
  const perDay = (m.times || []).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).length
  if (!perDay) return 0
  const s = new Date(Math.max(startMs, m.createdAt))
  s.setHours(0, 0, 0, 0)
  const e = new Date(endMs)
  e.setHours(0, 0, 0, 0)
  let days = 0
  for (const d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (!m.days || !m.days.length || m.days.includes(dow)) days++
  }
  return days * perDay
}

const PERIODS = [
  { key: 7, label: 'Hafta' },
  { key: 30, label: 'Ay' },
  { key: 365, label: 'Yıl' }
]

export default function Meds() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const meds = useLiveQuery(() => listMeds(), [], []) ?? []
  const logs = useLiveQuery(() => listMedLogs(), [], []) ?? []
  const [editing, setEditing] = useState<MedDef | 'new' | null>(null)
  const [period, setPeriod] = useState(7)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const hasKey = !!settings?.apiKey
  const today = todayStr()
  const todayDow = new Date(today + 'T00:00:00').getDay()

  const active = meds.filter((m) => m.active !== false)

  // Bugün planlanan (bugüne denk gelen ilaçlar) ve alınanlar
  const todayLogs = logs.filter((l) => l.dateStr === today)
  const takenToday = (medId?: number) => todayLogs.filter((l) => l.medId === medId).length
  const scheduledToday = active.filter((m) => !m.days || !m.days.length || m.days.includes(todayDow))

  async function markTaken(m: MedDef) {
    await addMedLog(m.name, m.relation, { medId: m.id, kind: m.kind })
  }
  async function undoTaken(m: MedDef) {
    const mine = todayLogs.filter((l) => l.medId === m.id).sort((a, b) => b.createdAt - a.createdAt)
    if (mine[0]?.id != null) await deleteMedLog(mine[0].id)
  }

  // Rapor: her ilac icin planlanan vs alinan (secilen donem)
  const report = useMemo(() => {
    const endMs = Date.now()
    const startMs = endMs - (period - 1) * 86_400_000
    const startStr = todayStr(new Date(startMs))
    return active.map((m) => {
      const planned = plannedDoses(m, startMs, endMs)
      const taken = logs.filter((l) => l.medId === m.id && l.dateStr >= startStr).length
      const pct = planned > 0 ? Math.min(100, Math.round((taken / planned) * 100)) : taken > 0 ? 100 : 0
      return { m, planned, taken, pct }
    })
  }, [active, logs, period])

  async function askAi() {
    if (!hasKey) return
    setErr('')
    setBusy(true)
    try {
      const lines = report.map(
        (r) => `- ${r.m.name} (${r.m.kind === 'vitamin' ? 'vitamin' : 'ilaç'}${relShort(r.m.relation) ? ', ' + relShort(r.m.relation) : ''}): ${r.taken}/${r.planned} doz alınmış (%${r.pct})`
      )
      const summary = `Dönem: son ${period} gün.\nİlaç/vitamin kullanım uyumu:\n${lines.join('\n') || '(kayıt yok)'}`
      const s = await readDietSettings()
      const text = await medComment({
        apiKey: s.apiKey!,
        summary,
        model: s.model,
        userName: s.userName,
        conditions: s.conditions,
        health: await buildHealthContext(s)
      })
      setComment(text)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Bir hata oluştu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <DietHeader title="İlaçlarım & Vitaminlerim" subtitle="Tanımla, hatırlat, işaretle, uyum raporunu gör" />

      <div className="p-3 space-y-4">
        {err && <div className="card p-3 bg-rose-50 border-rose-200 text-rose-700 text-sm">{err}</div>}

        {/* BUGÜN */}
        {scheduledToday.length > 0 && (
          <section className="card p-4 space-y-2.5">
            <span className="section-title">📅 Bugün</span>
            {scheduledToday.map((m) => {
              const need = (m.times || []).length || 1
              const got = takenToday(m.id)
              const done = got >= need
              return (
                <div key={m.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${done ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {m.kind === 'vitamin' ? '🍊' : '💊'} {m.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {got}/{need} alındı{relShort(m.relation) ? ` · ${relShort(m.relation)}` : ''}
                      {m.times?.length ? ` · ${m.times.join(', ')}` : ''}
                    </p>
                  </div>
                  {got > 0 && (
                    <button onClick={() => undoTaken(m)} className="text-xs text-slate-400 underline px-1">
                      geri al
                    </button>
                  )}
                  <button
                    onClick={() => markTaken(m)}
                    disabled={done}
                    className={`text-xs font-bold rounded-full px-3 py-1.5 ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-600 text-white'}`}
                  >
                    {done ? '✓ Tamam' : '＋ Aldım'}
                  </button>
                </div>
              )
            })}
            {scheduledToday.some((m) => takenToday(m.id) < ((m.times || []).length || 1)) && (
              <p className="text-[11px] text-amber-600 font-semibold">
                Bugün alınmayı bekleyen doz(lar) var.
              </p>
            )}
          </section>
        )}

        {/* İLAÇ / VİTAMİN LİSTESİ */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">İlaçlarım & vitaminlerim</h3>
            <button
              onClick={() => setEditing('new')}
              className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-3 py-1"
            >
              ＋ Ekle
            </button>
          </div>

          {meds.length === 0 && !editing && (
            <div className="card p-4 text-center text-slate-500 text-sm">
              Henüz ilaç/vitamin eklemedin. “＋ Ekle” ile başla.
            </div>
          )}

          {editing === 'new' && <MedForm onClose={() => setEditing(null)} />}

          {meds.map((m) =>
            editing !== null && editing !== 'new' && editing.id === m.id ? (
              <MedForm key={m.id} med={m} onClose={() => setEditing(null)} />
            ) : (
              <div key={m.id} className="card p-3 flex items-center gap-2">
                <div className="text-2xl">{m.kind === 'vitamin' ? '🍊' : '💊'}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">
                    {m.name} {m.active === false && <span className="text-[11px] text-slate-400">(bırakıldı)</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(m.times || []).join(', ') || 'saat yok'}
                    {relShort(m.relation) ? ` · ${relShort(m.relation)}` : ''}
                    {' · '}
                    {!m.days || !m.days.length ? 'her gün' : m.days.map((d) => DOW[d]).join(' ')}
                    {m.reminder ? ' · 🔔' : ''}
                  </p>
                </div>
                <button onClick={() => setEditing(m)} className="text-slate-400 hover:text-brand-600 px-1">
                  ✏️
                </button>
                <button onClick={() => m.id != null && deleteMed(m.id)} className="text-slate-300 hover:text-rose-500 px-1">
                  🗑️
                </button>
              </div>
            )
          )}
        </section>

        {/* RAPOR */}
        {active.length > 0 && (
          <section className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="section-title">📊 Kullanım uyumu</span>
              <div className="flex gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`text-xs font-semibold rounded-lg px-2.5 py-1 ${period === p.key ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {report.map((r) => (
              <div key={r.m.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700 truncate">
                    {r.m.kind === 'vitamin' ? '🍊' : '💊'} {r.m.name}
                  </span>
                  <span className={`font-bold ${r.pct >= 80 ? 'text-emerald-700' : r.pct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {r.taken}/{r.planned} · %{r.pct}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.pct >= 80 ? 'bg-emerald-500' : r.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </div>
            ))}

            <button onClick={askAi} disabled={!hasKey || busy} className="btn-primary w-full disabled:opacity-50">
              {busy ? 'Değerlendiriliyor…' : '🧠 Yapay zeka yorumlasın'}
            </button>
            {!hasKey && (
              <p className="text-[11px] text-slate-400 text-center">
                Yorum için <Link to="/ayarlar" className="underline">Ayarlar</Link>’dan API anahtarı ekle.
              </p>
            )}
            {comment && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {comment}
              </div>
            )}
          </section>
        )}

        <p className="text-center text-[11px] text-slate-400">
          İlaç/vitamin verileri koça da gider; sağlık değerlendirmesinde düzenli kullanıp kullanmadığını dikkate alır.
        </p>
      </div>
    </div>
  )
}

// İlaç/vitamin ekle-düzenle formu
function MedForm({ med, onClose }: { med?: MedDef; onClose: () => void }) {
  const [name, setName] = useState(med?.name ?? '')
  const [kind, setKind] = useState<MedDef['kind']>(med?.kind ?? 'ilac')
  const [relation, setRelation] = useState<MedDef['relation']>(med?.relation ?? 'tok')
  const [times, setTimes] = useState<string[]>(med?.times?.length ? med.times : ['08:30'])
  const [days, setDays] = useState<number[]>(med?.days ?? [])
  const [reminder, setReminder] = useState<boolean>(med?.reminder ?? true)
  const [active, setActive] = useState<boolean>(med?.active ?? true)

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }
  function setTime(i: number, v: string) {
    setTimes((prev) => prev.map((t, idx) => (idx === i ? v : t)))
  }

  async function save() {
    if (!name.trim()) return
    const clean = times.filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    const patch = { name: name.trim(), kind, relation, times: clean.length ? clean : ['08:30'], days, reminder, active }
    if (med?.id != null) await updateMed(med.id, patch)
    else await addMed(patch)
    await applyNotifications(await readDietSettings()) // bildirimleri yeniden kur
    onClose()
  }

  return (
    <div className="card p-3 space-y-2.5 border-brand-200">
      <input
        className="field-input"
        placeholder="Ad (örn. Metformin 1000 mg, D Vitamini)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <div className="flex gap-1.5">
        {(['ilac', 'vitamin'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`flex-1 text-sm font-semibold rounded-lg py-1.5 ${kind === k ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {k === 'ilac' ? '💊 İlaç' : '🍊 Vitamin'}
          </button>
        ))}
      </div>

      <div>
        <p className="text-[11px] text-slate-500 mb-1">Öğünle ilişkisi</p>
        <div className="flex flex-wrap gap-1.5">
          {REL.map((r) => (
            <button
              key={r.v}
              onClick={() => setRelation(r.v)}
              className={`text-xs font-semibold rounded-full px-2.5 py-1 ${relation === r.v ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {r.l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] text-slate-500 mb-1">Doz saatleri</p>
        <div className="space-y-1.5">
          {times.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="time" className="field-input w-28" value={t} onChange={(e) => setTime(i, e.target.value)} />
              {times.length > 1 && (
                <button onClick={() => setTimes((p) => p.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-rose-500 px-1">
                  🗑️
                </button>
              )}
            </div>
          ))}
          {times.length < 6 && (
            <button onClick={() => setTimes((p) => [...p, '20:30'])} className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-3 py-1">
              ＋ Saat ekle
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="text-[11px] text-slate-500 mb-1">Hangi günler? (boş = her gün · haftada kaç kez için gün seç)</p>
        <div className="flex flex-wrap gap-1">
          {DOW.map((d, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className={`text-xs font-semibold rounded-full w-9 h-8 ${days.includes(i) ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm text-slate-600 flex items-center gap-2">
          <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} /> 🔔 Bildirim kur
        </label>
        <label className="text-sm text-slate-600 flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Aktif
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onClose} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 py-2">
          Vazgeç
        </button>
        <button onClick={save} disabled={!name.trim()} className="btn-primary py-2 disabled:opacity-50">
          Kaydet
        </button>
      </div>
    </div>
  )
}
