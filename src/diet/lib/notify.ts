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
    { id: 'kahvalti', notifId: 101, label: 'Kahvaltı', time: '08:00', enabled: false },
    { id: 'ara1', notifId: 102, label: 'Ara öğün', time: '11:00', enabled: false },
    { id: 'ogle', notifId: 103, label: 'Öğle yemeği', time: '13:00', enabled: false },
    { id: 'ikindi', notifId: 104, label: 'İkindi', time: '16:00', enabled: false },
    { id: 'aksam', notifId: 105, label: 'Akşam yemeği', time: '19:00', enabled: false }
  ]
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
      const [h, m] = r.time.split(':').map(Number)
      return {
        id: r.notifId,
        title: '🥗 Diyet Koçu',
        body: `${r.label} vakti! Yemeden önce fotoğrafını çekmeyi unutma.`,
        schedule: { on: { hour: h, minute: m }, repeats: true, allowWhileIdle: true }
      }
    })
  })
}
