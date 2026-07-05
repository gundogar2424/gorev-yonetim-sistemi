// Ogun hatirlatma bildirimleri. Yalnizca APK (native) icinde calisir;
// web'de sessizce devre disidir (tarayici kapaliyken bildirim gonderemez).
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Reminder, DietSettings } from '../types'

// Bildirim kimlik araliklari (catismayi onlemek icin sabit)
const WATER_IDS_START = 201 // su hatirlaticilari 201..2xx
const MOTIVATION_ID = 301 // gunluk motivasyon
const CHECKIN_ID = 302 // gun ici "nasilsin?" check-in
const PLAN_ID = 303 // aksam "yarini planla"
const REPORT_ID = 304 // aksam "raporu gonder" hatirlatmasi
const SUGAR_FASTING_ID = 305 // sabah aclik sekeri olcum hatirlatmasi
const SMART_HUNGER_ID = 306 // ogrenilen aclik saatinden once proaktif ara ogun hatirlatmasi
const CHANNEL_ID = 'diyet-hatirlatici' // Android bildirim kanali (ses bu kanaldan ayarlanir)
const SATIETY_ID = 401 // ogun sonrasi tokluk hatirlatmasi (tek, en son ogune gore)
const SUGAR_POSTMEAL_ID = 402 // ogunden 2 saat sonra tok seker olcum hatirlatmasi (tek)

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
    { id: 'aksam', notifId: 105, label: 'Akşam yemeği', time: '19:00', lead: 0, enabled: false },
    { id: 'gece', notifId: 106, label: 'Gece ara öğün', time: '21:30', lead: 0, enabled: false }
  ]
}

// Kayitli hatirlaticilari varsayilanlarla birlestir (yeni eklenen 'gece' gibi
// ogunler eski kullanicilarda da gorunsun diye). Kayitli degerler korunur.
export function mergeReminders(saved?: Reminder[]): Reminder[] {
  const defaults = defaultReminders()
  if (!saved?.length) return defaults
  const byId = new Map(saved.map((r) => [r.id, { ...r, lead: r.lead ?? 0 }]))
  return defaults.map((d) => byId.get(d.id) ?? d)
}

// Android bildirim kanalini olustur (ses + titresim). Kullanici telefon
// ayarlarindan bu kanalin SESINI/TONUNU degistirebilir.
async function ensureChannel(): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Öğün Hatırlatıcıları',
      description: 'Öğün, su ve motivasyon bildirimleri',
      importance: 5, // yuksek: ses + ekranda belirir
      visibility: 1,
      vibration: true
    })
  } catch {
    // kanal zaten varsa ya da desteklenmiyorsa yok say
  }
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

  await ensureChannel()
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
    channelId: CHANNEL_ID,
    title: '🥗 Diyet Koçu',
    body,
    schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
    extra: { route: '/' }
  }
}

// Su icme hatirlaticilari: gunduz 09:00-21:00 arasi her 2 saatte bir
function waterNotifications() {
  const list = []
  let i = 0
  for (let hour = 9; hour <= 21; hour += 2) {
    list.push({
      id: WATER_IDS_START + i++,
      channelId: CHANNEL_ID,
      title: '💧 Su zamanı',
      body: 'Bir bardak su iç ve uygulamaya işaretle. Su, tokluk ve metabolizma için şart!',
      schedule: { on: { hour, minute: 0 }, repeats: true, allowWhileIdle: true },
      extra: { route: '/' }
    })
  }
  return list
}

// Gunluk motivasyon bildirimi (belirtilen saatte)
function motivationNotification(time: string) {
  const [h, m] = (time || '09:00').split(':').map(Number)
  return {
    id: MOTIVATION_ID,
    channelId: CHANNEL_ID,
    title: '🌟 Diyet Koçu',
    body: 'Bugün de sen kazan! Hedefine bir adım daha yaklaş. 💪',
    schedule: { on: { hour: h || 9, minute: m || 0 }, repeats: true, allowWhileIdle: true },
    extra: { route: '/' }
  }
}

// Gun ici "nasilsin?" check-in bildirimi (belirtilen saatte)
function checkinNotification(time: string) {
  const [h, m] = (time || '15:00').split(':').map(Number)
  return {
    id: CHECKIN_ID,
    channelId: CHANNEL_ID,
    title: '💬 Diyet Koçu',
    body: 'Nasıl gidiyor? Kendini nasıl hissediyorsun? Uygulamaya bir dokun, işaretle.',
    schedule: { on: { hour: h || 15, minute: m || 0 }, repeats: true, allowWhileIdle: true },
    extra: { route: '/' }
  }
}

// Aksam "yarini planla" bildirimi (belirtilen saatte)
function planNotification(time: string) {
  const [h, m] = (time || '21:00').split(':').map(Number)
  return {
    id: PLAN_ID,
    channelId: CHANNEL_ID,
    title: '📅 Diyet Koçu',
    body: 'Yarının menüsüne bakalım mı? Öğünlerini ve eksik malzemeni akşamdan planla.',
    schedule: { on: { hour: h || 21, minute: m || 0 }, repeats: true, allowWhileIdle: true },
    extra: { route: '/' }
  }
}

// Aksam "raporu gonder" hatirlatmasi (belirtilen saatte)
function reportNotification(time: string) {
  const [h, m] = (time || '20:30').split(':').map(Number)
  return {
    id: REPORT_ID,
    channelId: CHANNEL_ID,
    title: '📤 Diyet Koçu',
    body: 'Bugünün raporunu diyetisyenine göndermeyi unutma!',
    schedule: { on: { hour: h || 20, minute: m ?? 30 }, repeats: true, allowWhileIdle: true },
    extra: { route: '/gecmis' }
  }
}

// Sabah aclik sekeri olcum hatirlatmasi (belirtilen saatte, her gun)
function sugarFastingNotification(time: string) {
  const [h, m] = (time || '07:00').split(':').map(Number)
  return {
    id: SUGAR_FASTING_ID,
    channelId: CHANNEL_ID,
    title: '🩸 Açlık şekeri',
    body: 'Günaydın! Kahvaltıdan önce açlık kan şekerini ölç ve uygulamaya gir.',
    schedule: { on: { hour: h || 7, minute: m || 0 }, repeats: true, allowWhileIdle: true },
    extra: { route: '/takip?tab=saglik' }
  }
}

// Proaktif akilli aclik hatirlatmasi: verilerden ogrenilen aclik saatinden
// once "ara ogun hazirla" der (her gun tekrar eder). Saat Reminders'ta hesaplanir.
function smartHungerNotification(time: string) {
  const [h, m] = (time || '15:30').split(':').map(Number)
  return {
    id: SMART_HUNGER_ID,
    channelId: CHANNEL_ID,
    title: '🍽️ Diyet Koçu',
    body: 'Genelde bu saatlerde acıkıyorsun — sağlıklı bir ara öğün/su hazırla, krize girme. 💪',
    schedule: { on: { hour: h || 15, minute: m || 30 }, repeats: true, allowWhileIdle: true },
    extra: { route: '/' }
  }
}

// Bir ogun yenince ~2 saat sonra "tok sekerini olc" bildirimi (tek seferlik).
// Her yeni ogunde yeniden kurulur (ayni ID en son ogune gore guncellenir).
export async function scheduleSugarReminder(minutes = 120): Promise<void> {
  if (!isNative()) return
  try {
    await ensureChannel()
    await LocalNotifications.schedule({
      notifications: [
        {
          id: SUGAR_POSTMEAL_ID,
          channelId: CHANNEL_ID,
          title: '🩸 Tok şekeri',
          body: 'Ana öğününün üzerinden ~2 saat geçti — tok kan şekerini ölçüp girmek ister misin?',
          schedule: { at: new Date(Date.now() + minutes * 60_000), allowWhileIdle: true },
          extra: { route: '/takip?tab=saglik' }
        }
      ]
    })
  } catch {
    // yok say
  }
}

// Bildirime TIKLANINCA ilgili sayfaya git. Uygulama acilisinda bir kez
// kaydedilir; bildirim uygulamayi soguk baslatsa bile olay teslim edilir.
export async function initNotificationNavigation(go: (route: string) => void): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const route = (event.notification?.extra as { route?: string } | undefined)?.route ?? '/'
      go(route)
    })
  } catch {
    // dinleyici kurulamazsa sessiz gec
  }
}

// Bir ogun yenince ~30 dk sonra "toklugunu puanla" bildirimi kurar (tek seferlik)
export async function scheduleSatietyReminder(minutes = 30): Promise<void> {
  if (!isNative()) return
  try {
    await ensureChannel()
    await LocalNotifications.schedule({
      notifications: [
        {
          id: SATIETY_ID,
          title: '🍽️ Diyet Koçu',
          body: 'Yarım saat oldu — son öğününde doydun mu? Tokluğunu puanla.',
          schedule: { at: new Date(Date.now() + minutes * 60_000), allowWhileIdle: true },
          extra: { route: '/' }
        }
      ]
    })
  } catch {
    // yok say
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

  const reminders = mergeReminders(settings.reminders)
  const notifications: ReturnType<typeof mealNotification>[] = []

  for (const r of reminders) {
    if (r.enabled) notifications.push(mealNotification({ ...r, lead: r.lead ?? 0 }))
  }
  if (settings.waterReminderEnabled) notifications.push(...waterNotifications())
  if (settings.motivationReminderEnabled) {
    notifications.push(motivationNotification(settings.motivationReminderTime || '09:00'))
  }
  if (settings.checkinReminderEnabled) {
    notifications.push(checkinNotification(settings.checkinReminderTime || '15:00'))
  }
  if (settings.planReminderEnabled) {
    notifications.push(planNotification(settings.planReminderTime || '21:00'))
  }
  if (settings.reportReminderEnabled) {
    notifications.push(reportNotification(settings.reportReminderTime || '20:30'))
  }
  if (settings.sugarFastingReminderEnabled) {
    notifications.push(sugarFastingNotification(settings.sugarFastingReminderTime || '07:00'))
  }
  if (settings.smartHungerReminderEnabled && settings.smartHungerReminderTime) {
    notifications.push(smartHungerNotification(settings.smartHungerReminderTime))
  }

  if (notifications.length === 0) return
  await ensureChannel()
  await LocalNotifications.schedule({ notifications })
}
