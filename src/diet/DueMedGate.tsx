import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listMeds, listMedLogs, addMedLog } from './db'
import { scheduleMedSnooze, cancelMedSnooze, cancelMedDoseReminder } from './lib/notify'
import { todayStr } from './streak'
import type { MedDef } from './types'

// Doz vakti gecmis ve HENUZ isaretlenmemis ilaclar icin ekrani kaplayan,
// cevaplamadan gecilemeyen zorunlu hatirlatma penceresi (Pillo tarzi).
// "Aldim" (saati duzenlenebilir) / "Almadim" / "Ertele".

const relShort = (r?: MedDef['relation']) => (r === 'tok' ? 'tok' : r === 'ac' ? 'aç' : '')

function snoozeKey(dateStr: string, medId: number | undefined, time: string) {
  return `dc-medsnooze:${dateStr}:${medId ?? 0}:${time}`
}
function getSnoozeUntil(dateStr: string, medId: number | undefined, time: string): number {
  try {
    const v = localStorage.getItem(snoozeKey(dateStr, medId, time))
    return v ? Number(v) : 0
  } catch {
    return 0
  }
}
function setSnoozeUntil(dateStr: string, medId: number | undefined, time: string, untilMs: number) {
  try {
    localStorage.setItem(snoozeKey(dateStr, medId, time), String(untilMs))
  } catch {
    // yok say
  }
}

function inProgram(m: MedDef, dateStr: string): boolean {
  if (m.startDate && dateStr < m.startDate) return false
  if (m.endDate && dateStr > m.endDate) return false
  return true
}
function scheduledOn(m: MedDef, dateStr: string, dow: number): boolean {
  if (m.active === false || !m.reminder) return false
  if (m.days && m.days.length && !m.days.includes(dow)) return false
  return inProgram(m, dateStr)
}

type Due = { med: MedDef; time: string; dueMin: number }

export default function DueMedGate() {
  const meds = useLiveQuery(() => listMeds(), [], []) ?? []
  const logs = useLiveQuery(() => listMedLogs(), [], []) ?? []
  const [now, setNow] = useState(() => Date.now())
  const [bump, setBump] = useState(0)

  // 30 sn'de bir tazele: yeni vakti gelen doz + erteleme suresi dolmasi yakalansin
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const today = todayStr()

  const due: Due[] = useMemo(() => {
    const d = new Date(now)
    const dow = d.getDay()
    const nowMin = d.getHours() * 60 + d.getMinutes()
    const out: Due[] = []
    for (const m of meds) {
      if (!scheduledOn(m, today, dow)) continue
      const times = [...(m.times || []).filter((t) => /^\d{1,2}:\d{2}$/.test(t))].sort()
      // Bu ilacın bugünkü kayıtları — her kaydı BİR slota harca (çok dozlu ilaçta
      // saatsiz 'alındı' kaydı TÜM dozları kapatmasın: sadece bir slotu doldursun).
      const pool = logs.filter((l) => l.medId === m.id && l.dateStr === today)
      for (const time of times) {
        const [h, mi] = time.split(':').map(Number)
        const dueMin = h * 60 + mi
        // Bu slota ait kaydı bul: önce tam saat, yoksa saatsiz 'alındı'
        let idx = pool.findIndex((l) => l.time === time)
        if (idx < 0) idx = pool.findIndex((l) => !l.time && (l.status ?? 'taken') === 'taken')
        if (idx >= 0) {
          pool.splice(idx, 1) // işaretlenmiş (alındı/atlandı) — bu slot kapandı
          continue
        }
        if (dueMin > nowMin) continue // vakti daha gelmedi
        if (getSnoozeUntil(today, m.id, time) > now) continue // ertelendi
        out.push({ med: m, time, dueMin })
      }
    }
    return out.sort((a, b) => a.dueMin - b.dueMin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meds, logs, now, today, bump])

  const current = due[0]
  if (!current) return null

  return (
    <DoseGateModal
      key={`${current.med.id}-${current.time}`}
      due={current}
      index={0}
      total={due.length}
      dateStr={today}
      onDone={() => setBump((b) => b + 1)}
    />
  )
}

function DoseGateModal({
  due,
  index,
  total,
  dateStr,
  onDone
}: {
  due: Due
  index: number
  total: number
  dateStr: string
  onDone: () => void
}) {
  const { med, time } = due
  const nowHM = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const [takenTime, setTakenTime] = useState(nowHM)
  const [busy, setBusy] = useState(false)
  const [showSnooze, setShowSnooze] = useState(false)

  function toMs(hm: string): number {
    const [h, m] = hm.split(':').map(Number)
    const d = new Date(dateStr + 'T00:00:00')
    d.setHours(h || 0, m || 0, 0, 0)
    return d.getTime()
  }

  async function take() {
    setBusy(true)
    await addMedLog(med.name, med.relation, {
      medId: med.id,
      kind: med.kind,
      time,
      status: 'taken',
      dateStr,
      takenAt: toMs(takenTime)
    })
    await cancelMedSnooze(med.id) // cevaplandi — bekleyen erteleme bildirimini iptal et
    await cancelMedDoseReminder(med, dateStr, time) // o gunun doz hatirlatmasini da iptal et
    onDone()
  }
  async function skip() {
    setBusy(true)
    await addMedLog(med.name, med.relation, { medId: med.id, kind: med.kind, time, status: 'skipped', dateStr })
    await cancelMedSnooze(med.id)
    await cancelMedDoseReminder(med, dateStr, time)
    onDone()
  }
  async function snooze(minutes: number) {
    setBusy(true)
    setSnoozeUntil(dateStr, med.id, time, Date.now() + minutes * 60_000)
    await scheduleMedSnooze(med.name, minutes, med.id)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#0f1626] shadow-2xl p-5 space-y-4 text-center">
        {total > 1 && (
          <p className="text-[11px] font-semibold text-slate-400">{index + 1} / {total} doz bekliyor</p>
        )}
        <div className="text-5xl">{med.kind === 'vitamin' ? '🍊' : '💊'}</div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Bugün bu ilacı aldın mı?</h2>
          <p className="text-sm text-slate-500 mt-1">Vakti geçti, işaretlemeden devam edemezsin.</p>
        </div>

        <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-3">
          <p className="font-bold text-slate-800 dark:text-slate-100">{med.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Planlı saat {time}
            {med.dose ? ` · ${med.dose}` : ''}
            {relShort(med.relation) ? ` · ${relShort(med.relation)}` : ''}
          </p>
        </div>

        {/* Aldığın saati düzenle */}
        <label className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          Aldığım saat:
          <input
            type="time"
            value={takenTime}
            onChange={(e) => setTakenTime(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 dark:bg-white/5 px-2 py-1 text-slate-800 dark:text-slate-100"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={skip}
            disabled={busy}
            className="rounded-2xl py-3 font-bold text-slate-600 bg-slate-100 dark:bg-white/10 dark:text-slate-200 disabled:opacity-50"
          >
            ✗ Almadım
          </button>
          <button
            onClick={take}
            disabled={busy}
            className="rounded-2xl py-3 font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
          >
            ✓ Aldım
          </button>
        </div>

        {!showSnooze ? (
          <button onClick={() => setShowSnooze(true)} disabled={busy} className="text-sm text-slate-400 underline">
            ⏰ Sonra hatırlat (ertele)
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2">
            {[10, 30, 60].map((mn) => (
              <button
                key={mn}
                onClick={() => snooze(mn)}
                disabled={busy}
                className="text-xs font-semibold rounded-full px-3 py-1.5 bg-amber-100 text-amber-800 disabled:opacity-50"
              >
                {mn < 60 ? `${mn} dk` : '1 saat'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
