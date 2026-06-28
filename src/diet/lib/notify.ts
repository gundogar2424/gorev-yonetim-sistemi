// Ogun hatirlatma bildirimleri. Yalnizca APK (native) icinde calisir;
// web'de sessizce devre disidir (tarayici kapaliyken bildirim gonderemez).
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Reminder, DietSettings } from '../types'

// Bildirim kimlik araliklari (catismayi onlemek icin sabit)
const WATER_IDS_START = 201 // su hatirlaticilari 201..2xx
const MOTIVATION_ID = 301 // gunluk motivasyon

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

// Varsayilan hatirlaticilar (kapali baslar)
export function defaultReminders(): Reminder[] {
  return [
    { id: 'kahvalti', notifId: 101, label: 'Kahvaltı', time: '08:00', lead: 0, enabled: false },
    { id: 'ara1', notifId: 102, label: 'Ara öğün', time: '11:00', lead: 0, enabled: false },
    { id: 'ogle', notifId: 103, label: 'Öğle yemeği', time: '13:00', lead: 0, enabled: false },
    { id: 'ikindi', notifId: 104, label: 'İkindi', time: '16:00', lead: 0, enabled: false },
    { id: 'aksam', notifId: 105, label: 'Akşam yemeği', time: '19:00', lead: 0, enabled: false }
  ]
}

// Ogun saatinden "lead" dakika cikararak bildirim saatini hesaplar (gece yarisi sarmasini da yonetir)
function notifyHM(time: string, lead: number): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number)
  let total = h * 60 + m - (lead || 0)
  total = ((total % 1440) + 1440) % 1440 // 0..1439 araliginda tut
  return { hour: Math.floor(total / 60), minute: total % 60 }
}

// Bildirim izni iste (yalnizca native)
export async function ensurePermission(): Promise<boolean> {
  if (!isNative()) return false
  const res = await LocalNotifications.requestPermissions()
  return res.display === 'granted'
}

// Hatirlaticilari isletim sistemine kur (her gun tekrar eden).
// Once tum eskileri iptal eder, sonra acik olanlari kurar.
export async function scheduleReminders(reminders: Reminder[]): Promise<void> {
  if (!isNative()) return
  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
    }
  } catch {
    // yok say
  }

  const active = reminders.filter((r) => r.enabled)
  if (active.length === 0) return

  await LocalNotifications.schedule({ notifications: active.map(mealNotification) })
}

// Tek bir ogun hatirlaticisini bildirim nesnesine cevirir
function mealNotification(r: Reminder) {
  const { hour, minute } = notifyHM(r.time, r.lead)
  const body =
    (r.lead || 0) > 0
      ? `${r.label} (${r.time}) yaklaşıyor — ${r.lead} dk var. Yemeden önce fotoğrafını çek!`
      : `${r.label} vakti! Yemeden önce fotoğrafını çekmeyi unutma.`
  return {
    id: r.notifId,
    title: '🥗 Diyet Koçu',
    body,
    schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true }
  }
}

// Su icme hatirlaticilari: gunduz 09:00-21:00 arasi her 2 saatte bir
function waterNotifications() {
  const list = []
  let i = 0
  for (let hour = 9; hour <= 21; hour += 2) {
    list.push({
      id: WATER_IDS_START + i++,
      title: '💧 Su zamanı',
      body: 'Bir bardak su iç ve uygulamaya işaretle. Su, tokluk ve metabolizma için şart!',
      schedule: { on: { hour, minute: 0 }, repeats: true, allowWhileIdle: true }
    })
  }
  return list
}

// Gunluk motivasyon bildirimi (belirtilen saatte)
function motivationNotification(time: string) {
  const [h, m] = (time || '09:00').split(':').map(Number)
  return {
    id: MOTIVATION_ID,
    title: '🌟 Diyet Koçu',
    body: 'Bugün de sen kazan! Hedefine bir adım daha yaklaş. 💪',
    schedule: { on: { hour: h || 9, minute: m || 0 }, repeats: true, allowWhileIdle: true }
  }
}

// TUM bildirimleri ayarlardan kurar: once hepsini iptal eder, sonra
// acik olan ogun + su + motivasyon bildirimlerini birlikte kurar.
export async function applyNotifications(settings: DietSettings): Promise<void> {
  if (!isNative()) return
  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
    }
  } catch {
    // yok say
  }

  const reminders = settings.reminders?.length ? settings.reminders : defaultReminders()
  const notifications: ReturnType<typeof mealNotification>[] = []

  for (const r of reminders) {
    if (r.enabled) notifications.push(mealNotification({ ...r, lead: r.lead ?? 0 }))
  }
  if (settings.waterReminderEnabled) notifications.push(...waterNotifications())
  if (settings.motivationReminderEnabled) {
    notifications.push(motivationNotification(settings.motivationReminderTime || '09:00'))
  }

  if (notifications.length === 0) return
  await LocalNotifications.schedule({ notifications })
}
