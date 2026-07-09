// Ogun hatirlatma bildirimleri. Yalnizca APK (native) icinde calisir;
// web'de sessizce devre disidir (tarayici kapaliyken bildirim gonderemez).
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Reminder, DietSettings, MedDef } from '../types'
import { dietDb } from '../db'

// Bildirim kimlik araliklari (catismayi onlemek icin sabit)
const WATER_IDS_START = 201 // su hatirlaticilari 201..2xx
const MOTIVATION_ID = 301 // gunluk motivasyon
const CHECKIN_ID = 302 // gun ici "nasilsin?" check-in
const PLAN_ID = 303 // aksam "yarini planla"
const REPORT_ID = 304 // aksam "raporu gonder" hatirlatmasi
const SUGAR_FASTING_ID = 305 // sabah aclik sekeri olcum hatirlatmasi
const SMART_HUNGER_ID = 306 // ogrenilen aclik saatinden once proaktif ara ogun hatirlatmasi
const MED_IDS_START = 310 // ilac/seker hapi hatirlatmalari 310..399 (her doz icin ana + tekrarlar)
const MED_IDS_END = 399 // ilac bildirim ID ust siniri (401/402 tokluk/seker ile catismasin)
const CHANNEL_ID = 'diyet-hatirlatici' // Android bildirim kanali (ses bu kanaldan ayarlanir)
const MED_CHANNEL_ID = 'diyet-ilac-alarm' // ILAC icin AYRI, agresif kanal (max onem + titresim)
// Ilac dozu icin "uzerine gelen" tekrar dakikalari: ana bildirim + almazsan tekrar duyurur
const MED_NAG_OFFSETS = [0, 10, 30]
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

// ILAC icin AYRI agresif kanal: maksimum onem (ekranda belirir + ses), guclu titresim,
// isik. Kullanici telefon ayarlarindan bu kanalin sesini "alarm" tonu yapabilir.
async function ensureMedChannel(): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.createChannel({
      id: MED_CHANNEL_ID,
      name: 'İlaç Alarmı',
      description: 'İlaç/vitamin dozu için ısrarcı hatırlatma (ses + titreşim)',
      importance: 5, // MAX: ekranin ustunde belirir, ses cikar
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#16a34a'
    })
  } catch {
    // kanal zaten varsa ya da desteklenmiyorsa yok say
  }
}

// Bir saate dakika ekle/cikar, 0..1439 araliginda sar (gece yarisi gecisini yonetir)
function addMinutes(hour: number, minute: number, delta: number): { hour: number; minute: number } {
  let total = hour * 60 + minute + delta
  total = ((total % 1440) + 1440) % 1440
  return { hour: Math.floor(total / 60), minute: total % 60 }
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
  await ensureExactAlarm()
  return res.display === 'granted'
}

// TAM ZAMANLI ALARM izni: Android 12+'da bu izin olmadan bildirimler gecikir
// (yalnizca telefon acilinca gelir). Izin yoksa kullaniciyi ayar ekranina yonlendirir.
export async function ensureExactAlarm(): Promise<void> {
  if (!isNative()) return
  try {
    const api = LocalNotifications as unknown as {
      checkExactNotificationSetting?: () => Promise<{ exact_alarm: string }>
      changeExactNotificationSetting?: () => Promise<{ exact_alarm: string }>
    }
    if (!api.checkExactNotificationSetting) return
    const cur = await api.checkExactNotificationSetting()
    if (cur.exact_alarm !== 'granted' && api.changeExactNotificationSetting) {
      await api.changeExactNotificationSetting() // sistem ayar ekranini acar
    }
  } catch {
    // desteklenmiyorsa (eski surum/eski Android) yok say
  }
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

// Bildirimde "✓ Aldım" aksiyon butonu icin tip. Bir kez kaydedilmesi yeter.
async function ensureMedActionType(): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.registerActionTypes({
      types: [{ id: 'MED', actions: [{ id: 'MED_TAKEN', title: '✓ Aldım' }] }]
    })
  } catch {
    // desteklenmiyorsa yok say
  }
}

// Ilac/seker hapi hatirlatmalari: her saatte, her gun. Her saatin kendi ilac
// adi olabilir (sabah/ogle/aksam farkli). Bildirimde "✓ Aldim" butonu vardir;
// dokununca ilac otomatik "alindi" kaydedilir (extra.med).
function medNotifications(schedule: { time: string; name?: string }[]) {
  return schedule
    .filter((s) => /^\d{1,2}:\d{2}$/.test((s.time || '').trim()))
    .slice(0, 6)
    .map((s, i) => {
      const [h, m] = s.time.split(':').map(Number)
      const name = (s.name || '').trim()
      return {
        id: MED_IDS_START + i,
        channelId: MED_CHANNEL_ID,
        actionTypeId: 'MED',
        title: '💊 İlaç vakti',
        body: name
          ? `${name} almayı unutma. Aldıysan bildirimdeki “✓ Aldım”a dokun.`
          : 'İlaçlarını/şeker hapını almayı unutma. Aldıysan “✓ Aldım”a dokun.',
        schedule: { on: { hour: h || 0, minute: m || 0 }, repeats: true, allowWhileIdle: true },
        extra: { route: '/', med: name || 'İlaç' }
      }
    })
}

// Tanimli ilac/vitaminlerden AGRESIF bildirim uretir: her ilac x her doz saati x
// (varsa) haftanin gunu icin ANA bildirim + "uzerine gelen" tekrarlar (+10, +30 dk).
// Hepsi AYRI alarm kanalindan (max onem + titresim) ve "✓ Aldim" butonlu.
function medDefNotifications(meds: MedDef[]): unknown[] {
  const out: unknown[] = []
  let id = MED_IDS_START
  for (const m of meds) {
    const rel = m.relation === 'tok' ? ' (yemekten sonra)' : m.relation === 'ac' ? ' (aç karnına)' : ''
    const dozStr = m.dose ? ` — ${m.dose}` : ''
    for (const t of m.times || []) {
      if (!/^\d{1,2}:\d{2}$/.test((t || '').trim())) continue
      const [h, mi] = t.split(':').map(Number)
      const days = m.days && m.days.length ? m.days : [null as number | null]
      for (const d of days) {
        for (let k = 0; k < MED_NAG_OFFSETS.length; k++) {
          if (id > MED_IDS_END) return out
          const { hour, minute } = addMinutes(h, mi, MED_NAG_OFFSETS[k])
          const on = d == null ? { hour, minute } : { weekday: d + 1, hour, minute }
          const nag = k > 0
          out.push({
            id: id++,
            channelId: MED_CHANNEL_ID,
            actionTypeId: 'MED',
            title: nag
              ? '🔴 İlacını hâlâ almadın!'
              : m.kind === 'vitamin'
                ? '💊 Vitamin vakti'
                : '💊 İlaç vakti',
            body: nag
              ? `${m.name}${dozStr} — lütfen şimdi al ve “✓ Aldım”a dokun.`
              : `${m.name}${rel}${dozStr} almayı unutma. Aldıysan “✓ Aldım”a dokun.`,
            schedule: { on, repeats: true, allowWhileIdle: true },
            extra: { route: '/ilaclarim', med: m.name, medId: m.id }
          })
        }
      }
    }
  }
  return out
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
export async function initNotificationNavigation(
  go: (route: string) => void,
  onMedTaken?: (name: string, medId?: number) => void
): Promise<void> {
  if (!isNative()) return
  try {
    await ensureMedActionType()
    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const extra = event.notification?.extra as { route?: string; med?: string; medId?: number } | undefined
      // Bildirimdeki "✓ Aldım" butonuna basildiysa ilaci kaydet, sayfaya gitme
      if (event.actionId === 'MED_TAKEN') {
        onMedTaken?.(extra?.med || 'İlaç', extra?.medId)
        return
      }
      go(extra?.route ?? '/')
    })
  } catch {
    // dinleyici kurulamazsa sessiz gec
  }
}

// ILAC dozu "ertelendi": X dakika sonra tek seferlik, alarm kanalindan tekrar duyur.
// Her ilac icin ayri ID (medId'ye gore) ki farkli ilaclarin ertelemesi cakismasin.
export async function scheduleMedSnooze(name: string, minutes: number, medId?: number): Promise<void> {
  if (!isNative()) return
  try {
    await ensureMedChannel()
    await ensureMedActionType()
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 380 + ((medId ?? 0) % 10),
          channelId: MED_CHANNEL_ID,
          actionTypeId: 'MED',
          title: '⏰ İlaç hatırlatma (ertelendi)',
          body: `${name} — alma vakti geldi. Aldıysan “✓ Aldım”a dokun.`,
          schedule: { at: new Date(Date.now() + minutes * 60_000), allowWhileIdle: true },
          extra: { route: '/ilaclarim', med: name, medId }
        }
      ]
    })
  } catch {
    // yok say
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
  const notifications: unknown[] = []

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
  // Ilac/vitamin: once tanimli meds tablosundan uret; hic yoksa eski medSchedule'a dus
  const meds = await dietDb.meds.toArray()
  const activeMeds = meds.filter((m) => m.active && m.reminder && m.times?.length)
  if (activeMeds.length) {
    await ensureMedActionType()
    await ensureMedChannel()
    await ensureExactAlarm() // ilac icin tam-zamanli alarm izni yoksa iste (gecikmesin)
    notifications.push(...medDefNotifications(activeMeds))
  } else {
    const medSchedule = settings.medSchedule?.length
      ? settings.medSchedule
      : (settings.medReminderTimes ?? []).map((t) => ({ time: t, name: '' }))
    if (settings.medReminderEnabled && medSchedule.length) {
      await ensureMedActionType()
      await ensureMedChannel()
      notifications.push(...medNotifications(medSchedule))
    }
  }

  if (notifications.length === 0) return
  await ensureChannel()
  await LocalNotifications.schedule({ notifications: notifications as never })
}
