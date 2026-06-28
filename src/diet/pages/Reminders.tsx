import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { readDietSettings, saveDietSettings } from '../db'
import { defaultReminders, ensurePermission, scheduleReminders, isNative } from '../lib/notify'
import type { Reminder } from '../types'

export default function Reminders() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const reminders: Reminder[] = settings?.reminders?.length ? settings.reminders : defaultReminders()
  const [msg, setMsg] = useState('')
  const native = isNative()

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(''), 3500)
  }

  async function apply(next: Reminder[]) {
    await saveDietSettings({ reminders: next })
    if (native) {
      await ensurePermission()
      await scheduleReminders(next)
    }
  }

  async function toggle(id: string, enabled: boolean) {
    if (enabled && native) {
      const ok = await ensurePermission()
      if (!ok) {
        flash('Bildirim izni verilmedi. Telefon ayarlarından izin ver.')
        return
      }
    }
    await apply(reminders.map((r) => (r.id === id ? { ...r, enabled } : r)))
  }

  async function setTime(id: string, time: string) {
    await apply(reminders.map((r) => (r.id === id ? { ...r, time } : r)))
  }

  async function testNotify() {
    if (!native) {
      flash('Bildirim testi yalnızca APK (uygulama) sürümünde çalışır.')
      return
    }
    const ok = await ensurePermission()
    flash(ok ? 'İzin verildi. Açık hatırlatıcılar kuruldu. ✅' : 'İzin verilmedi.')
    await scheduleReminders(reminders)
  }

  return (
    <div>
      <DietHeader title="Hatırlatıcılar" subtitle="Öğün saatlerinde bildirim" />

      <div className="p-3 space-y-4">
        {msg && <p className="card p-3 bg-emerald-50 text-emerald-800 text-sm border-emerald-100">{msg}</p>}

        {!native && (
          <div className="card p-3 bg-amber-50 border-amber-200 text-amber-800 text-sm">
            <p className="font-semibold mb-1">📱 Bildirimler için APK gerekir</p>
            <p>
              Web (tarayıcı) sürümünde, uygulama kapalıyken bildirim gelmez. Saatleri yine de ayarlayabilirsin; APK
              sürümünü kurduğunda bu saatlerde bildirim alırsın.
            </p>
          </div>
        )}

        <section className="space-y-2">
          {reminders.map((r) => (
            <div key={r.id} className="card p-3 flex items-center gap-3">
              <input
                type="time"
                className="field-input w-28"
                value={r.time}
                onChange={(e) => setTime(r.id, e.target.value)}
              />
              <span className="flex-1 font-medium text-slate-700">{r.label}</span>
              {/* Ac/kapa anahtari */}
              <button
                onClick={() => toggle(r.id, !r.enabled)}
                className={`w-12 h-7 rounded-full transition relative ${r.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                aria-label={r.enabled ? 'Kapat' : 'Aç'}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition ${
                    r.enabled ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </section>

        <button onClick={testNotify} className="btn-primary w-full">
          {native ? '🔔 İzni Ver & Hatırlatıcıları Kur' : '🔔 Bildirim Durumunu Kontrol Et'}
        </button>

        <p className="text-center text-xs text-slate-400">
          Saatleri istediğin gibi ayarla; açık olanlar her gün aynı saatte hatırlatır.
        </p>
      </div>
    </div>
  )
}
