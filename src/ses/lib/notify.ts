// Gunluk egzersiz hatirlatma bildirimleri. Yalnizca APK (native) icinde
// calisir; web'de sessizce devre disidir.
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Reminder } from './store'

const CHANNEL_ID = 'ses-hatirlatici'
const ID_BASE = 500 // 501..503

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

async function ensureChannel(): Promise<void> {
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Egzersiz Hatırlatıcıları',
      description: 'Günlük ses egzersizi hatırlatmaları',
      importance: 4,
      visibility: 1,
      vibration: true
    })
  } catch {
    /* kanal zaten varsa ya da desteklenmiyorsa yok say */
  }
}

// Bildirim izni iste (yalnizca native). Android 12+: tam zamanli alarm izni
// yoksa sistem ayar ekranina yonlendirir.
export async function ensurePermission(): Promise<boolean> {
  if (!isNative()) return false
  const res = await LocalNotifications.requestPermissions()
  try {
    const api = LocalNotifications as unknown as {
      checkExactNotificationSetting?: () => Promise<{ exact_alarm: string }>
      changeExactNotificationSetting?: () => Promise<{ exact_alarm: string }>
    }
    if (api.checkExactNotificationSetting) {
      const cur = await api.checkExactNotificationSetting()
      if (cur.exact_alarm !== 'granted' && api.changeExactNotificationSetting) await api.changeExactNotificationSetting()
    }
  } catch {
    /* desteklenmiyorsa yok say */
  }
  return res.display === 'granted'
}

// Hatirlaticilari isletim sistemine kur (her gun tekrar eden). Once bu
// uygulamanin eskilerini iptal eder, sonra acik olanlari kurar.
export async function scheduleReminders(reminders: Reminder[]): Promise<void> {
  if (!isNative()) return
  try {
    const pending = await LocalNotifications.getPending()
    const mine = pending.notifications.filter((n) => n.id > ID_BASE && n.id <= ID_BASE + 3).map((n) => ({ id: n.id }))
    if (mine.length) await LocalNotifications.cancel({ notifications: mine })
  } catch {
    /* yok say */
  }
  const active = reminders.filter((r) => r.enabled)
  if (active.length === 0) return
  await ensureChannel()
  await LocalNotifications.schedule({
    notifications: active.map((r) => {
      const [h, m] = r.time.split(':').map(Number)
      return {
        id: ID_BASE + r.id,
        channelId: CHANNEL_ID,
        title: '🎤 Ses Egzersizi',
        body: 'Egzersiz zamanı! Kısa bir seans ses tellerini güçlendirir.',
        schedule: { on: { hour: h || 0, minute: m || 0 }, repeats: true, allowWhileIdle: true },
        extra: { route: '/seans' }
      }
    })
  })
}

// Bildirime dokununca seans ekranina git
export function installNotificationTap(navigate: (path: string) => void): void {
  if (!isNative()) return
  void LocalNotifications.addListener('localNotificationActionPerformed', (ev) => {
    const route = (ev.notification.extra as { route?: string } | undefined)?.route
    if (route) navigate(route)
  })
}
