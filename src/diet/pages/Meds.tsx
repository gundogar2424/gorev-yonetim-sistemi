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
import { applyNotifications, ensurePermission, ensureExactAlarm, isNative, cancelMedSnooze, cancelMedDoseReminder } from '../lib/notify'
import { buildHealthContext } from '../lib/context'
import { medComment, analyzeMedIngredients } from '../ai'
import { todayStr } from '../streak'
import type { MedDef, MedLog } from '../types'

const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] // 0..6 (getDay)
const DOW1 = ['P', 'P', 'S', 'Ç', 'P', 'C', 'C'] // tek harf (strip için, Pzt-Sal-Çar-Per-Cum-Cmt-Paz sırasıyla ayrıca gösterilir)
const REL: { v: MedDef['relation']; l: string }[] = [
  { v: 'tok', l: 'Yemekten sonra (tok)' },
  { v: 'ac', l: 'Aç karnına' },
  { v: 'genel', l: 'Farketmez' }
]
const relShort = (r?: MedDef['relation']) => (r === 'tok' ? 'tok' : r === 'ac' ? 'aç' : '')

// YYYY-MM-DD üret (yerel)
function dstr(d: Date): string {
  return d.toLocaleDateString('en-CA')
}
// Bir tarihin bu ilaç için programda olup olmadığı (başlangıç/bitiş penceresi)
function inProgram(m: MedDef, dateStr: string): boolean {
  if (m.startDate && dateStr < m.startDate) return false
  if (m.endDate && dateStr > m.endDate) return false
  return true
}
// Bir ilaç belirli bir güne (haftanın günü + program) denk geliyor mu
function scheduledOn(m: MedDef, dateStr: string, dow: number): boolean {
  if (m.active === false) return false
  if (m.days && m.days.length && !m.days.includes(dow)) return false
  return inProgram(m, dateStr)
}

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
    const ds = dstr(d)
    if (scheduledOn(m, ds, d.getDay())) days++
  }
  return days * perDay
}

const PERIODS = [
  { key: 7, label: 'Hafta' },
  { key: 30, label: 'Ay' },
  { key: 365, label: 'Yıl' }
]

// Bir gün için doz slotları: her ilaç × her saat. Kayıtlı log'ları eşleştir.
type Slot = { med: MedDef; time: string; log?: MedLog }
function buildSlots(meds: MedDef[], logs: MedLog[], dateStr: string, dow: number): Slot[] {
  const scheduled = meds.filter((m) => scheduledOn(m, dateStr, dow))
  const slots: Slot[] = []
  for (const m of scheduled) {
    const times = (m.times || []).filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    const list = times.length ? [...times].sort() : ['—']
    // Bu ilacın o güne ait kayıtları (kopya — eşleştirdikçe tükenir)
    const medLogs = logs.filter((l) => l.medId === m.id && l.dateStr === dateStr)
    const pool = [...medLogs]
    for (const time of list) {
      // Önce tam saat eşleşmesi, yoksa saatsiz bir "alındı" kaydını doldur (bildirimden gelen)
      let idx = pool.findIndex((l) => l.time === time)
      if (idx < 0) idx = pool.findIndex((l) => !l.time && (l.status ?? 'taken') === 'taken')
      const log = idx >= 0 ? pool.splice(idx, 1)[0] : undefined
      slots.push({ med: m, time, log })
    }
  }
  return slots.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
}

export default function Meds() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const meds = useLiveQuery(() => listMeds(), [], []) ?? []
  const logs = useLiveQuery(() => listMedLogs(), [], []) ?? []
  const [editing, setEditing] = useState<MedDef | 'new' | null>(null)
  const [period, setPeriod] = useState(7)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [loggedId, setLoggedId] = useState<number | null>(null)

  // "Şimdi aldım": ilacı o ANKİ saatle kaydet (planlı saat gerekmez; günde birden çok kez basılabilir).
  // Rapor bu kaydı gerçek saatinde gösterir.
  async function logNow(med: MedDef) {
    await addMedLog(med.name, med.relation, { medId: med.id, kind: med.kind })
    if (med.id != null) {
      setLoggedId(med.id)
      setTimeout(() => setLoggedId((v) => (v === med.id ? null : v)), 2500)
    }
  }

  const hasKey = !!settings?.apiKey
  const today = todayStr()
  const [selected, setSelected] = useState(today)
  const [weekOffset, setWeekOffset] = useState(0)

  const active = meds.filter((m) => m.active !== false)

  // Haftalık gün şeridi: seçili haftanın Pazartesi'sinden başlar
  const weekDays = useMemo(() => {
    const base = new Date(today + 'T00:00:00')
    const sinceMon = (base.getDay() + 6) % 7
    const mon = new Date(base)
    mon.setDate(base.getDate() - sinceMon + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      return { dateStr: dstr(d), dow: d.getDay(), dayNum: d.getDate() }
    })
  }, [today, weekOffset])

  const selDow = new Date(selected + 'T00:00:00').getDay()
  const slots = useMemo(() => buildSlots(active, logs, selected, selDow), [active, logs, selected, selDow])

  const takenCount = slots.filter((s) => s.log && (s.log.status ?? 'taken') === 'taken').length
  const pendingCount = slots.filter((s) => !s.log).length

  async function setSlot(slot: Slot, status: 'taken' | 'skipped') {
    // Aynı slotun eski kaydını temizle, yenisini ekle
    if (slot.log?.id != null) await deleteMedLog(slot.log.id)
    await addMedLog(slot.med.name, slot.med.relation, {
      medId: slot.med.id,
      kind: slot.med.kind,
      time: slot.time === '—' ? undefined : slot.time,
      status,
      dateStr: selected
    })
    await cancelMedSnooze(slot.med.id) // cevaplandi — bekleyen erteleme bildirimini iptal et
    if (slot.time !== '—') await cancelMedDoseReminder(slot.med, selected, slot.time) // o gunun doz hatirlatmasini iptal et
  }
  async function clearSlot(slot: Slot) {
    if (slot.log?.id != null) await deleteMedLog(slot.log.id)
  }

  // Rapor: her ilac icin planlanan vs alinan (secilen donem) — atlanan sayılmaz
  const report = useMemo(() => {
    const endMs = Date.now()
    const startMs = endMs - (period - 1) * 86_400_000
    const startStr = todayStr(new Date(startMs))
    return active.map((m) => {
      const planned = plannedDoses(m, startMs, endMs)
      const taken = logs.filter(
        (l) => l.medId === m.id && l.dateStr >= startStr && (l.status ?? 'taken') === 'taken'
      ).length
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

  const selLabel =
    selected === today
      ? 'Bugün'
      : new Date(selected + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })

  return (
    <div>
      <DietHeader title="İlaçlarım" subtitle="Günlük dozlar · hatırlatma · uyum raporu" />

      <div className="p-3 space-y-4">
        {err && <div className="card p-3 bg-rose-50 border-rose-200 text-rose-700 text-sm">{err}</div>}

        <AggressiveNotifCard />

        {/* HAFTALIK GÜN ŞERİDİ */}
        <section className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="text-slate-400 hover:text-brand-600 px-2 text-lg">
              ‹
            </button>
            <span className="text-xs font-semibold text-slate-500">
              {weekOffset === 0 ? 'Bu hafta' : weekDays[0].dateStr.slice(5) + ' – ' + weekDays[6].dateStr.slice(5)}
            </span>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="text-slate-400 hover:text-brand-600 px-2 text-lg">
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((d) => {
              const isSel = d.dateStr === selected
              const isToday = d.dateStr === today
              const hasDose = active.some((m) => scheduledOn(m, d.dateStr, d.dow))
              return (
                <button
                  key={d.dateStr}
                  onClick={() => setSelected(d.dateStr)}
                  className={`flex flex-col items-center py-1.5 rounded-xl transition ${
                    isSel ? 'bg-brand-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className={`text-[10px] font-semibold ${isSel ? 'text-white/80' : 'text-slate-400'}`}>
                    {DOW1[d.dow]}
                  </span>
                  <span className="text-base font-bold leading-tight">{d.dayNum}</span>
                  <span
                    className={`mt-0.5 w-1.5 h-1.5 rounded-full ${
                      hasDose ? (isSel ? 'bg-white' : 'bg-brand-400') : 'bg-transparent'
                    } ${isToday && !isSel ? 'ring-2 ring-brand-300' : ''}`}
                  />
                </button>
              )
            })}
          </div>
        </section>

        {/* SEÇİLİ GÜN — DOZ KARTLARI (Pillo tarzı) */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-700">{selLabel}</h3>
            {slots.length > 0 && (
              <span className="text-xs font-semibold text-slate-400">
                {takenCount}/{slots.length} alındı
              </span>
            )}
          </div>

          {active.length === 0 ? (
            <div className="card p-6 text-center text-slate-500 text-sm">
              <div className="text-4xl mb-2">💊</div>
              Henüz ilaç eklemedin. Aşağıdan “＋ Ekle” ile başla.
            </div>
          ) : slots.length === 0 ? (
            <div className="card p-5 text-center text-slate-400 text-sm">Bu güne planlı doz yok. 🎉</div>
          ) : (
            slots.map((s, i) => <DoseCard key={s.med.id + '-' + s.time + '-' + i} slot={s} onSet={setSlot} onClear={clearSlot} />)
          )}

          {pendingCount > 0 && (
            <p className="text-[11px] text-amber-600 font-semibold px-1">
              {pendingCount} doz alınmayı bekliyor.
            </p>
          )}
        </section>

        {/* İLAÇ / VİTAMİN LİSTESİ (tanımlar) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Programım</h3>
            <button
              onClick={() => setEditing('new')}
              className="text-xs font-semibold text-white bg-brand-600 rounded-full px-3 py-1"
            >
              ＋ Program
            </button>
          </div>

          {editing === 'new' && <MedForm onClose={() => setEditing(null)} />}

          {meds.map((m) =>
            editing !== null && editing !== 'new' && editing.id === m.id ? (
              <MedForm key={m.id} med={m} onClose={() => setEditing(null)} />
            ) : (
              <div key={m.id} className="card p-3">
                <div className="flex items-center gap-2">
                  <div className="text-2xl">{m.kind === 'vitamin' ? '🍊' : '💊'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">
                      {m.name}
                      {m.brand ? <span className="text-brand-600 font-normal"> · {m.brand}</span> : ''}
                      {m.dose ? <span className="text-slate-400 font-normal"> · {m.dose}</span> : ''}
                      {m.active === false && <span className="text-[11px] text-slate-400"> (bırakıldı)</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(m.times || []).join(', ') || 'saat yok'}
                      {relShort(m.relation) ? ` · ${relShort(m.relation)}` : ''}
                      {' · '}
                      {!m.days || !m.days.length ? 'her gün' : m.days.map((d) => DOW[d]).join(' ')}
                      {m.reminder ? ' · 🔔' : ''}
                      {m.endDate ? ` · bitiş ${m.endDate.slice(5)}` : ''}
                    </p>
                  </div>
                  <button onClick={() => setEditing(m)} className="text-slate-400 hover:text-brand-600 px-1">
                    ✏️
                  </button>
                  <button onClick={() => m.id != null && deleteMed(m.id)} className="text-slate-300 hover:text-rose-500 px-1">
                    🗑️
                  </button>
                </div>
                {m.active !== false && (
                  <button
                    onClick={() => logNow(m)}
                    className={`mt-2 w-full text-sm font-semibold rounded-lg py-2 transition ${
                      loggedId === m.id ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                    }`}
                  >
                    {loggedId === m.id ? '✓ Şu an alındı olarak kaydedildi' : '💊 Şimdi aldım'}
                  </button>
                )}
                <MedIngredientInfo med={m} apiKey={settings?.apiKey} model={settings?.model} />
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

// Agresif bildirim izinlerini açtıran kart: bildirim izni + tam-zamanlı alarm + ipuçları
function AggressiveNotifCard() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  if (!isNative()) return null

  async function enable() {
    await ensurePermission()
    await ensureExactAlarm()
    setDone(true)
  }

  return (
    <section className="card p-3 bg-amber-50 border-amber-200 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-amber-800">🔔 Agresif ilaç hatırlatması</span>
        <button onClick={() => setOpen((o) => !o)} className="text-xs text-amber-700 underline">
          {open ? 'gizle' : 'nasıl?'}
        </button>
      </div>
      <p className="text-xs text-amber-700">
        Dozunu işaretlemezsen aynı ilaç için <b>saatinde + 10 dk + 30 dk sonra</b> tekrar, sesli ve titreşimli uyarır.
      </p>
      <button onClick={enable} className="btn-primary w-full py-2">
        {done ? '✓ İzinler istendi' : 'Bildirimleri aç / izin ver'}
      </button>
      {open && (
        <div className="text-[11px] text-amber-700 space-y-1 pt-1">
          <p className="font-semibold">Bildirimler geç geliyorsa telefon ayarlarından:</p>
          <p>• <b>Pil optimizasyonu</b>: Diyet Koçu → “Kısıtlama yok / İzin ver”.</p>
          <p>• <b>Otomatik başlatma</b> (Xiaomi/Huawei/Oppo): Diyet Koçu’na izin ver.</p>
          <p>• <b>Alarmlar ve hatırlatıcılar</b>: Diyet Koçu’na izin ver (tam zamanlı alarm).</p>
          <p>• Bildirim sesini “alarm” tonu yapmak için: Ayarlar → Bildirimler → “İlaç Alarmı” kanalı.</p>
        </div>
      )}
    </section>
  )
}

// İlaç/vitamin etken madde analizi: göster + (yoksa) üret / yenile. Bu metin
// ortak sağlık bağlamına girip ilerleme/gerileme yorumlarında kullanılır.
function MedIngredientInfo({ med, apiKey, model }: { med: MedDef; apiKey?: string; model?: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run() {
    if (!apiKey || med.id == null) return
    setErr('')
    setBusy(true)
    try {
      const txt = await analyzeMedIngredients({ apiKey, name: med.name, kind: med.kind, dose: med.dose, brand: med.brand, model })
      await updateMed(med.id, { ingredients: txt, ingredientsAt: Date.now() })
      setOpen(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Analiz alınamadı.')
    } finally {
      setBusy(false)
    }
  }

  const has = !!med.ingredients?.trim()
  return (
    <div className="mt-2 pt-2 border-t border-slate-100">
      <div className="flex items-center gap-2">
        <button
          onClick={() => (has ? setOpen((o) => !o) : run())}
          disabled={busy || (!has && !apiKey)}
          className="text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 rounded-full px-2.5 py-1 disabled:opacity-50"
        >
          {busy ? 'Analiz ediliyor…' : has ? (open ? '🔬 Etken maddeyi gizle' : '🔬 Etken madde') : '🔬 Etken madde çıkar'}
        </button>
        {has && !busy && (
          <button onClick={run} disabled={!apiKey} className="text-[11px] text-slate-400 underline disabled:opacity-50">
            yenile
          </button>
        )}
        {!apiKey && !has && <span className="text-[10px] text-slate-400">(API anahtarı gerekli)</span>}
      </div>
      {err && <p className="text-[11px] text-rose-600 mt-1">{err}</p>}
      {has && open && (
        <div className="mt-2 rounded-xl bg-teal-50/60 dark:bg-teal-500/10 p-2.5 text-[12px] text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
          {med.ingredients}
          <p className="text-[10px] text-slate-400 mt-1.5">Bilgilendirme amaçlıdır; teşhis/doz için doktor/eczacıya danış. Bu bilgi koçun ilerleme yorumlarında da kullanılır.</p>
        </div>
      )}
    </div>
  )
}

// Pillo tarzı tek doz kartı: saat + ad + doz + büyük Alındı/Atlandı
function DoseCard({
  slot,
  onSet,
  onClear
}: {
  slot: Slot
  onSet: (s: Slot, status: 'taken' | 'skipped') => void
  onClear: (s: Slot) => void
}) {
  const { med, time, log } = slot
  const status = log ? log.status ?? 'taken' : 'pending'
  const taken = status === 'taken'
  const skipped = status === 'skipped'

  return (
    <div
      className={`card p-3 ${taken ? 'bg-emerald-50 border-emerald-200' : skipped ? 'bg-slate-50 border-slate-200 opacity-80' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center justify-center w-14 flex-shrink-0">
          <span className="text-base font-extrabold text-slate-700 leading-none">{time}</span>
          <span className="text-[10px] text-slate-400 mt-0.5">{med.kind === 'vitamin' ? 'vitamin' : 'ilaç'}</span>
        </div>
        <div className="w-px self-stretch bg-slate-200" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 truncate">
            {med.kind === 'vitamin' ? '🍊' : '💊'} {med.name}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {med.dose ? med.dose : '1 doz'}
            {relShort(med.relation) ? ` · ${relShort(med.relation)}` : ''}
            {' · '}
            {!med.days || !med.days.length ? 'Her gün' : med.days.map((d) => DOW[d]).join(' ')}
          </p>
        </div>
      </div>

      {status === 'pending' ? (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={() => onSet(slot, 'skipped')}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
          >
            ✗ Atlandı
          </button>
          <button
            onClick={() => onSet(slot, 'taken')}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-bold text-white bg-emerald-500 hover:bg-emerald-600"
          >
            ✓ Alındı
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between mt-2.5">
          <span className={`text-sm font-bold ${taken ? 'text-emerald-700' : 'text-slate-500'}`}>
            {taken ? '✓ Alındı' : '✗ Atlandı'}
          </span>
          <button onClick={() => onClear(slot)} className="text-xs text-slate-400 underline">
            geri al
          </button>
        </div>
      )}
    </div>
  )
}

// İlaç/vitamin ekle-düzenle formu (program)
function MedForm({ med, onClose }: { med?: MedDef; onClose: () => void }) {
  const [name, setName] = useState(med?.name ?? '')
  const [brand, setBrand] = useState(med?.brand ?? '')
  const [dose, setDose] = useState(med?.dose ?? '')
  const [kind, setKind] = useState<MedDef['kind']>(med?.kind ?? 'ilac')
  const [relation, setRelation] = useState<MedDef['relation']>(med?.relation ?? 'tok')
  const [times, setTimes] = useState<string[]>(med?.times?.length ? med.times : ['08:30'])
  const [days, setDays] = useState<number[]>(med?.days ?? [])
  const [reminder, setReminder] = useState<boolean>(med?.reminder ?? true)
  const [active, setActive] = useState<boolean>(med?.active ?? true)
  const [endDate, setEndDate] = useState<string>(med?.endDate ?? '')

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }
  function setTime(i: number, v: string) {
    setTimes((prev) => prev.map((t, idx) => (idx === i ? v : t)))
  }

  async function save() {
    if (!name.trim()) return
    const clean = times.filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    const patch = {
      name: name.trim(),
      brand: brand.trim() || undefined,
      dose: dose.trim() || undefined,
      kind,
      relation,
      times: clean.length ? clean : ['08:30'],
      days,
      reminder,
      active,
      endDate: endDate || undefined
    }
    const s = await readDietSettings()
    let id = med?.id
    if (id != null) await updateMed(id, patch)
    else id = (await addMed(patch)) as number
    await applyNotifications(s) // bildirimleri yeniden kur
    // Arka planda etken madde analizini üret (API anahtarı varsa; ad/marka/doz değiştiyse
    // ya da hiç yoksa). Ortak sağlık bağlamına girip ilerleme yorumlarında kullanılır.
    const changed = med?.name !== patch.name || med?.brand !== patch.brand || med?.dose !== patch.dose
    if (s.apiKey && id != null && (changed || !med?.ingredients)) {
      void analyzeMedIngredients({ apiKey: s.apiKey, name: patch.name, kind: patch.kind, dose: patch.dose, brand: patch.brand, model: s.model })
        .then((txt) => updateMed(id!, { ingredients: txt, ingredientsAt: Date.now() }))
        .catch(() => {})
    }
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
      <input
        className="field-input"
        placeholder="Marka (örn. Solgar, Nutraxin) — etken madde markaya göre değişir"
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
      />
      <input
        className="field-input"
        placeholder="Doz (örn. 1 tablet, 5 ml, 2 damla)"
        value={dose}
        onChange={(e) => setDose(e.target.value)}
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

      <div>
        <p className="text-[11px] text-slate-500 mb-1">Kür bitişi (opsiyonel — boş = süresiz)</p>
        <input type="date" className="field-input w-44" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
