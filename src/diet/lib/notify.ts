// Ogun hatirlatma bildirimleri. Yalnizca APK (native) icinde calisir;
// web'de sessizce devre disidir (tarayici kapaliyken bildirim gonderemez).
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Reminder } from '../types'

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

  await LocalNotifications.schedule({
    notifications: active.map((r) => {
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
    })
  })
}
