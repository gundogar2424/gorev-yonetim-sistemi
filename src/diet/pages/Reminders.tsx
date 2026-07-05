import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { readDietSettings, saveDietSettings, listCheckins } from '../db'
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

  // AKILLI ACLIK HATIRLATICISI: verilerden en sik yuksek-aclik saatini ogrenip
  // 30 dk oncesine gunluk bildirim kurar. Yeterli veri yoksa uyarir.
  async function toggleSmartHunger(enabled: boolean) {
    if (!enabled) {
      await persist({ smartHungerReminderEnabled: false })
      return
    }
    if (native && !(await ensurePermission())) {
      flash('Bildirim izni verilmedi.')
      return
    }
    const all = await listCheckins()
    const hungry = all.filter((c) => (c.hunger ?? 0) >= 7)
    if (hungry.length < 3) {
      flash('Henüz açlık örüntüsü çıkacak kadar veri yok. Birkaç gün "açlık" girince otomatik öğrenir.')
      return
    }
    const hourCount = new Map<number, number>()
    for (const c of hungry) {
      const h = new Date(c.createdAt).getHours()
      hourCount.set(h, (hourCount.get(h) ?? 0) + 1)
    }
    const topHour = [...hourCount.entries()].sort((a, b) => b[1] - a[1])[0][0]
    let total = topHour * 60 - 30 // 30 dk once uyar
    total = ((total % 1440) + 1440) % 1440
    const hh = String(Math.floor(total / 60)).padStart(2, '0')
    const mm = String(total % 60).padStart(2, '0')
    await persist({ smartHungerReminderEnabled: true, smartHungerReminderTime: `${hh}:${mm}` })
    flash(`Öğrenildi: genelde ${topHour}:00 civarı acıkıyorsun → ${hh}:${mm}'de hatırlatacağım.`)
  }

  // Ilac/seker hapi hatirlatmasi: birden fazla saat (yemek sonralarina gore)
  async function toggleMed(enabled: boolean) {
    if (enabled && native && !(await ensurePermission())) {
      flash('Bildirim izni verilmedi.')
      return
    }
    const times = settings?.medReminderTimes?.length ? settings.medReminderTimes : ['08:30', '20:30']
    await persist({ medReminderEnabled: enabled, medReminderTimes: times })
  }
  async function setMedTime(i: number, time: string) {
    const times = [...(settings?.medReminderTimes ?? ['08:30', '20:30'])]
    times[i] = time
    await persist({ medReminderTimes: times })
  }
  async function addMedTime() {
    const times = [...(settings?.medReminderTimes ?? []), '13:00'].slice(0, 6)
    await persist({ medReminderTimes: times })
  }
  async function removeMedTime(i: number) {
    const times = (settings?.medReminderTimes ?? []).filter((_, idx) => idx !== i)
    await persist({ medReminderTimes: times })
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
              Tarayıcıda, uygulama kapalıyken bildirim gelmez. Saatleri yine ayarla; APK'da bu saatlerde bildirim alırsın.
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
                <p className="text-xs text-slate-500">Gün içinde nasıl hissettiğini sorar; koç bunu dikkate alır.</p>
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
                <p className="font-medium text-slate-700">Ana öğünden 2 saat sonra (tok)</p>
                <p className="text-xs text-slate-500">
                  Ana öğünden ~2 saat sonra tok şekerini ölçmen için hatırlatır. Yediğini işaretleyince otomatik kurulur.
                </p>
              </div>
              <Switch
                on={!!settings?.sugarPostMealReminderEnabled}
                onClick={() => toggleFlag({ sugarPostMealReminderEnabled: !settings?.sugarPostMealReminderEnabled }, !settings?.sugarPostMealReminderEnabled)}
              />
            </div>
          </div>
        </section>

        {/* Akilli aclik hatirlaticisi (verilerden ogrenir) */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">🍽️ Akıllı açlık hatırlatıcısı</h3>
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium text-slate-700">Acıkmadan önce uyar</p>
                <p className="text-xs text-slate-500">
                  Girdiğin açlık kayıtlarından en sık acıktığın saati öğrenir; o saatten 30 dk önce “ara öğün hazırla” der.
                </p>
              </div>
              <Switch on={!!settings?.smartHungerReminderEnabled} onClick={() => toggleSmartHunger(!settings?.smartHungerReminderEnabled)} />
            </div>
            {settings?.smartHungerReminderEnabled && settings?.smartHungerReminderTime && (
              <p className="text-xs font-semibold text-emerald-700">
                Öğrenilen saat: {settings.smartHungerReminderTime} · yeni veri girdikçe tekrar aç/kapat, güncellensin.
              </p>
            )}
          </div>
        </section>

        {/* Ilac / seker hapi hatirlatmasi (yemekten sonra) */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">💊 İlaç / şeker hapı hatırlatması</h3>
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium text-slate-700">İlaçlarını almayı hatırlat</p>
                <p className="text-xs text-slate-500">
                  Belirlediğin saatlerde (örn. kahvaltı ve akşam sonrası) her gün “ilacını al” bildirimi gönderir.
                </p>
              </div>
              <Switch on={!!settings?.medReminderEnabled} onClick={() => toggleMed(!settings?.medReminderEnabled)} />
            </div>
            {settings?.medReminderEnabled && (
              <div className="space-y-2">
                {(settings?.medReminderTimes ?? []).map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-500">
                    <span>🕒 Saat:</span>
                    <input type="time" className="field-input w-28" value={t} onChange={(e) => setMedTime(i, e.target.value)} />
                    <button onClick={() => removeMedTime(i)} className="text-slate-300 hover:text-rose-500 px-1">
                      🗑️
                    </button>
                  </div>
                ))}
                {(settings?.medReminderTimes?.length ?? 0) < 6 && (
                  <button onClick={addMedTime} className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-3 py-1">
                    + Saat ekle
                  </button>
                )}
              </div>
            )}
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
              Telefon <b>Ayarlar → Uygulamalar → Diyet Koçu → Bildirimler → "Öğün Hatırlatıcıları"</b> kanalından
              <b> ses ve titreşimi</b> seçebilirsin. (Önce "İzni Ver & Kur"a bas ki kanal oluşsun.)
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
