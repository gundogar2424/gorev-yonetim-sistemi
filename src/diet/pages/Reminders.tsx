import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { readDietSettings, saveDietSettings } from '../db'
import { mergeReminders, ensurePermission, applyNotifications, isNative } from '../lib/notify'
import type { Reminder, DietSettings } from '../types'

export default function Reminders() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  // Kayitli + varsayilan birlestirilir (yeni 'gece' ogunu de gorunsun)
  const reminders: Reminder[] = mergeReminders(settings?.reminders)
  const [msg, setMsg] = useState('')
  const native = isNative()

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(''), 3500)
  }

  // Ayara yamayi kaydet, sonra TUM bildirimleri (ogun+su+motivasyon) yeniden kur
  async function persist(patch: Partial<DietSettings>) {
    await saveDietSettings(patch)
    if (native) {
      await ensurePermission()
      const merged: DietSettings = { ...(settings ?? {}), ...patch }
      if (!merged.reminders?.length) merged.reminders = reminders
      await applyNotifications(merged)
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
    await persist({ reminders: reminders.map((r) => (r.id === id ? { ...r, enabled } : r)) })
  }

  async function setTime(id: string, time: string) {
    await persist({ reminders: reminders.map((r) => (r.id === id ? { ...r, time } : r)) })
  }

  async function setLead(id: string, lead: number) {
    await persist({ reminders: reminders.map((r) => (r.id === id ? { ...r, lead } : r)) })
  }

  async function toggleMotivation(enabled: boolean) {
    if (enabled && native && !(await ensurePermission())) {
      flash('Bildirim izni verilmedi.')
      return
    }
    await persist({ motivationReminderEnabled: enabled })
  }

  async function setMotivationTime(time: string) {
    await persist({ motivationReminderTime: time })
  }

  async function toggleCheckin(enabled: boolean) {
    if (enabled && native && !(await ensurePermission())) {
      flash('Bildirim izni verilmedi.')
      return
    }
    await persist({ checkinReminderEnabled: enabled })
  }

  async function setCheckinTime(time: string) {
    await persist({ checkinReminderTime: time })
  }

  // Genel amacli bildirim ac/kapa + saat (yarin plani, rapor hatirlatma)
  async function toggleFlag(patch: Partial<DietSettings>, enabled: boolean) {
    if (enabled && native && !(await ensurePermission())) {
      flash('Bildirim izni verilmedi.')
      return
    }
    await persist(patch)
  }

  async function testNotify() {
    if (!native) {
      flash('Bildirim testi yalnızca APK (uygulama) sürümünde çalışır.')
      return
    }
    const ok = await ensurePermission()
    flash(ok ? 'İzin verildi. Açık bildirimler kuruldu. ✅' : 'İzin verilmedi.')
    await applyNotifications({ ...(settings ?? {}), reminders })
  }

  return (
    <div>
      <DietHeader title="Hatırlatıcılar" subtitle="Öğün ve motivasyon bildirimleri" />

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

        {/* Ogun hatirlaticilari */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">🍽️ Öğün hatırlatıcıları</h3>
          {reminders.map((r) => (
            <div key={r.id} className="card p-3 space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  className="field-input w-28"
                  value={r.time}
                  onChange={(e) => setTime(r.id, e.target.value)}
                />
                <span className="flex-1 font-medium text-slate-700">{r.label}</span>
                <Switch on={r.enabled} onClick={() => toggle(r.id, !r.enabled)} />
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>⏰ Bildirim:</span>
                <select
                  className="field-input w-auto py-1.5 flex-1"
                  value={r.lead}
                  onChange={(e) => setLead(r.id, Number(e.target.value))}
                >
                  <option value={0}>Tam saatinde</option>
                  <option value={5}>5 dakika önce</option>
                  <option value={10}>10 dakika önce</option>
                  <option value={15}>15 dakika önce</option>
                  <option value={30}>30 dakika önce</option>
                  <option value={45}>45 dakika önce</option>
                  <option value={60}>1 saat önce</option>
                </select>
              </div>
            </div>
          ))}
        </section>

        {/* Motivasyon bildirimi */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">🌟 Motivasyon bildirimi</h3>
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium text-slate-700">Günlük cesaret sözü</p>
                <p className="text-xs text-slate-500">Her gün seni motive eden bir bildirim gönderir.</p>
              </div>
              <Switch
                on={!!settings?.motivationReminderEnabled}
                onClick={() => toggleMotivation(!settings?.motivationReminderEnabled)}
              />
            </div>
            {settings?.motivationReminderEnabled && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>🕘 Saat:</span>
                <input
                  type="time"
                  className="field-input w-28"
                  value={settings?.motivationReminderTime ?? '09:00'}
                  onChange={(e) => setMotivationTime(e.target.value)}
                />
              </div>
            )}
          </div>
        </section>

        {/* Gun ici "nasilsin?" check-in bildirimi */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">💬 Gün içi “nasılsın?”</h3>
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium text-slate-700">Nasıl hissediyorsun?</p>
                <p className="text-xs text-slate-500">Gün içinde “nasıl gidiyor, kendini nasıl hissediyorsun?” diye sorar; koç bunu değerlendirmede dikkate alır.</p>
              </div>
              <Switch
                on={!!settings?.checkinReminderEnabled}
                onClick={() => toggleCheckin(!settings?.checkinReminderEnabled)}
              />
            </div>
            {settings?.checkinReminderEnabled && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>🕒 Saat:</span>
                <input
                  type="time"
                  className="field-input w-28"
                  value={settings?.checkinReminderTime ?? '15:00'}
                  onChange={(e) => setCheckinTime(e.target.value)}
                />
              </div>
            )}
          </div>
        </section>

        {/* Seker olcum hatirlatmalari */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">🩸 Şeker ölçüm hatırlatması</h3>

          {/* Sabah aclik */}
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium text-slate-700">Sabah açlık şekeri</p>
                <p className="text-xs text-slate-500">Kalkınca, kahvaltıdan önce açlık şekerini ölçmen için hatırlatır.</p>
              </div>
              <Switch
                on={!!settings?.sugarFastingReminderEnabled}
                onClick={() => toggleFlag({ sugarFastingReminderEnabled: !settings?.sugarFastingReminderEnabled }, !settings?.sugarFastingReminderEnabled)}
              />
            </div>
            {settings?.sugarFastingReminderEnabled && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>🕖 Saat:</span>
                <input
                  type="time"
                  className="field-input w-28"
                  value={settings?.sugarFastingReminderTime ?? '07:00'}
                  onChange={(e) => persist({ sugarFastingReminderTime: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Ogunden 2 saat sonra tok */}
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium text-slate-700">Öğünden 2 saat sonra (tok)</p>
                <p className="text-xs text-slate-500">
                  Her öğün kaydından ~2 saat sonra tok şekerini ölçmen için hatırlatır. (Yediğini işaretlediğinde otomatik kurulur.)
                </p>
              </div>
              <Switch
                on={!!settings?.sugarPostMealReminderEnabled}
                onClick={() => toggleFlag({ sugarPostMealReminderEnabled: !settings?.sugarPostMealReminderEnabled }, !settings?.sugarPostMealReminderEnabled)}
              />
            </div>
          </div>
        </section>

        {/* Aksam "yarini planla" bildirimi */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">📅 Yarını planla</h3>
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium text-slate-700">Akşam menü hatırlatması</p>
                <p className="text-xs text-slate-500">Akşam “yarının menüsüne bakalım mı?” diye hatırlatır; ana ekrandan yarını planlarsın.</p>
              </div>
              <Switch
                on={!!settings?.planReminderEnabled}
                onClick={() => toggleFlag({ planReminderEnabled: !settings?.planReminderEnabled }, !settings?.planReminderEnabled)}
              />
            </div>
            {settings?.planReminderEnabled && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>🕘 Saat:</span>
                <input
                  type="time"
                  className="field-input w-28"
                  value={settings?.planReminderTime ?? '21:00'}
                  onChange={(e) => persist({ planReminderTime: e.target.value })}
                />
              </div>
            )}
          </div>
        </section>

        {/* Aksam "raporu gonder" hatirlatmasi */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">📤 Rapor hatırlatması</h3>
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium text-slate-700">Günlük raporu gönder</p>
                <p className="text-xs text-slate-500">Akşam “bugünün raporunu diyetisyenine göndermeyi unutma” der.</p>
              </div>
              <Switch
                on={!!settings?.reportReminderEnabled}
                onClick={() => toggleFlag({ reportReminderEnabled: !settings?.reportReminderEnabled }, !settings?.reportReminderEnabled)}
              />
            </div>
            {settings?.reportReminderEnabled && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>🕗 Saat:</span>
                <input
                  type="time"
                  className="field-input w-28"
                  value={settings?.reportReminderTime ?? '20:30'}
                  onChange={(e) => persist({ reportReminderTime: e.target.value })}
                />
              </div>
            )}
          </div>
        </section>

        <button onClick={testNotify} className="btn-primary w-full">
          {native ? '🔔 İzni Ver & Bildirimleri Kur' : '🔔 Bildirim Durumunu Kontrol Et'}
        </button>

        {native && (
          <div className="card p-3 bg-sky-50 border-sky-100 text-sky-900 text-sm">
            <p className="font-semibold mb-1">🔊 Bildirim sesini/tonunu seçmek için</p>
            <p>
              Telefon <b>Ayarlar → Uygulamalar → Diyet Koçu → Bildirimler → "Öğün Hatırlatıcıları"</b> kanalına gir; oradan
              istediğin <b>sesi/tonu ve titreşimi</b> seçebilirsin. (Önce yukarıdan "İzni Ver & Kur"a bas ki kanal oluşsun.)
            </p>
          </div>
        )}

        <p className="text-center text-xs text-slate-400">Açık olan tüm bildirimler her gün aynı saatte tekrarlanır.</p>
      </div>
    </div>
  )
}

// Ac/kapa anahtari
function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-12 h-7 rounded-full transition relative flex-shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
      aria-label={on ? 'Kapat' : 'Aç'}
    >
      <span
        className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  )
}
