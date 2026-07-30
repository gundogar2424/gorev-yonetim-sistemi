// Health Connect (Google) uzerinden Samsung Health verisini OKUR: adim, mesafe,
// kalori ve antrenmanlar (nabizla). Samsung Health bu verileri Health Connect'e
// yazar; biz de kullanicinin izniyle oradan okuruz. YALNIZCA APK'da (native)
// calisir; web'de sessizce devre disidir.
import type { HealthPlugin, HealthPermission } from '@flomentumsolutions/capacitor-health-extended'

// ÖNEMLİ: Capacitor eklenti nesnesi (Proxy) bir async fonksiyondan DOĞRUDAN
// döndürülürse, Promise çözümü sırasında JS "thenable mı?" diye `.then`e bakar ve
// Proxy her özelliği çağrılabilir yaptığı için native `HealthPlugin.then()` çağrılıp
// "not implemented" hatası verir. Bunu önlemek için MODÜL AD ALANINI döndürüyoruz
// (thenable değil); eklentiye `mod.Health` ile SENKRON erişip metodu öyle çağırıyoruz.
type HealthMod = { Health: HealthPlugin }
let modPromise: Promise<HealthMod> | null = null

async function getMod(): Promise<HealthMod | null> {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform()) return null
  try {
    if (!modPromise)
      modPromise = import('@flomentumsolutions/capacitor-health-extended') as unknown as Promise<HealthMod>
    return await modPromise
  } catch {
    return null
  }
}

// Istedigimiz izinler: adim, antrenman, aktif/toplam kalori, mesafe, nabiz, UYKU.
const PERMS: HealthPermission[] = [
  'READ_STEPS',
  'READ_WORKOUTS',
  'READ_ACTIVE_CALORIES',
  'READ_TOTAL_CALORIES',
  'READ_DISTANCE',
  'READ_HEART_RATE',
  'READ_SLEEP'
]

// Health Connect bu cihazda var mi (yuklu ve destekli mi)?
export async function healthAvailable(): Promise<boolean> {
  const mod = await getMod()
  if (!mod) return false
  try {
    return (await mod.Health.isHealthAvailable()).available
  } catch {
    return false
  }
}

// Izinleri iste (Health Connect izin ekranini acar).
export async function requestHealthPerms(): Promise<void> {
  const mod = await getMod()
  if (!mod) throw new Error('Bu özellik yalnızca uygulamada (APK) çalışır.')
  await mod.Health.requestHealthPermissions({ permissions: PERMS })
}

// Izin VERILMIS mi? (izin penceresi ACMADAN sadece sorar). Otomatik
// guncellemede kullanilir: izin yoksa kullaniciyi rahatsiz etmeyiz.
// NOT: native taraf `permissions`i bir NESNE olarak dondurur ({PERM: true});
// TS tipi dizi der. Ikisini de destekliyoruz.
export async function healthPermsGranted(): Promise<boolean> {
  const mod = await getMod()
  if (!mod) return false
  try {
    const res = (await mod.Health.checkHealthPermissions({ permissions: PERMS })) as unknown as {
      permissions?: Record<string, boolean> | Record<string, boolean>[]
    }
    const p = res?.permissions
    if (!p) return false
    const maps = Array.isArray(p) ? p : [p]
    // Adim ya da antrenman izni varsa is goruyoruz (hepsi sart degil)
    return maps.some((m) => m?.READ_STEPS === true || m?.READ_WORKOUTS === true)
  } catch {
    return false
  }
}

// Health Connect ayar ekranini ac (izinleri elle yonetmek icin).
export async function openHealthConnect(): Promise<void> {
  const mod = await getMod()
  await mod?.Health.openHealthConnectSettings()
}

// Health Connect yuklu degilse Play Store'da ac.
export async function openHealthConnectStore(): Promise<void> {
  const mod = await getMod()
  await mod?.Health.showHealthConnectInPlayStore()
}

// Antrenman tur kodunu (WALKING vb.) Turkce etikete cevir.
const TYPE_TR: Record<string, string> = {
  WALKING: 'Yürüyüş',
  RUNNING: 'Koşu',
  HIKING: 'Doğa yürüyüşü',
  BIKING: 'Bisiklet',
  BIKING_STATIONARY: 'Sabit bisiklet',
  SWIMMING_POOL: 'Yüzme',
  SWIMMING_OPEN_WATER: 'Yüzme',
  STRENGTH_TRAINING: 'Ağırlık',
  WEIGHTLIFTING: 'Ağırlık',
  YOGA: 'Yoga',
  PILATES: 'Pilates',
  ELLIPTICAL: 'Eliptik',
  ROWING: 'Kürek',
  STAIR_CLIMBING: 'Merdiven',
  HIGH_INTENSITY_INTERVAL_TRAINING: 'HIIT',
  DANCING: 'Dans',
  FOOTBALL_SOCCER: 'Futbol',
  BASKETBALL: 'Basketbol',
  TENNIS: 'Tenis',
  OTHER: 'Antrenman'
}
export function workoutLabel(type: string): string {
  return TYPE_TR[type] || 'Antrenman'
}

// Health Connect'ten okunan antrenmanlarda text sonuna eklenen etiket: yeniden
// ice aktarınca ayni gunun eski Health kayitlarini bundan taniyip siliyoruz.
export const HEALTH_TAG = '(Health Connect)'

export interface HealthWorkout {
  text: string
  minutes: number
  kcal?: number
  distanceKm?: number
  avgHr?: number
  steps?: number
  // Oturumun BASLANGIC zamani (ms). Kaydin SABIT kimligi olarak kullanilir:
  // ayni antrenman her ice aktarimda ayni createdAt'i alir. Boylece hem
  // tekrar ice aktarma cift kayit uretmez, hem de bulut senkronu
  // (createdAt'e gore birlestiriyor) silinen kaydi geri getirmez.
  startMs?: number
}
export interface HealthDay {
  steps: number
  distanceKm: number
  activeKcal: number
  totalKcal: number
  sleepHours: number // O SABAH uyanilan gece uykusu (saat); yoksa 0
  workouts: HealthWorkout[]
}

// Bir gunun yerel gece yarisi -> ertesi gece yarisi araligini ISO olarak verir.
function dayBounds(dateStr: string): { start: string; end: string } {
  const start = new Date(dateStr + 'T00:00:00')
  const end = new Date(start.getTime() + 86_400_000)
  return { start: start.toISOString(), end: end.toISOString() }
}

// Gunluk tek deger topla (steps / active-calories / total-calories / distance).
// NOT: TS tipi 'steps'|'active-calories'|'mindfulness' der ama Android tarafi
// 'distance' ve 'total-calories'i de destekliyor; o yuzden gevsek cast ediyoruz.
async function agg(H: HealthPlugin, dataType: string, start: string, end: string): Promise<number> {
  try {
    const r = await H.queryAggregated({ startDate: start, endDate: end, dataType: dataType as never, bucket: 'day' })
    return (r.aggregatedData || []).reduce((s, a) => s + (a.value || 0), 0)
  } catch {
    return 0
  }
}

// UYKU: Health Connect uyku oturumlarini BASLANGIC gunune gore gruplar. Gece
// 23:30'da baslayip sabah 07:00'de biten uyku, BIR ONCEKI gune yazilir. Bizim
// istedigimiz "bu sabah uyandigin gece uykusu" oldugu icin pencereyi
// (dun 12:00 → bugun 12:00) aliyoruz; boylece gece yarisini asan uyku dogru
// gune (uyanilan gune) gelir. Deger SANIYE doner, saate cevrilir.
async function readSleepHours(H: HealthPlugin, dateStr: string): Promise<number> {
  try {
    const noonToday = new Date(dateStr + 'T12:00:00')
    const noonPrev = new Date(noonToday.getTime() - 86_400_000)
    const r = await H.queryAggregated({
      startDate: noonPrev.toISOString(),
      endDate: noonToday.toISOString(),
      dataType: 'sleep' as never,
      bucket: 'day'
    })
    const seconds = (r.aggregatedData || []).reduce((s, a) => s + (a.value || 0), 0)
    if (!seconds) return 0
    return Math.round((seconds / 3600) * 10) / 10 // saat, tek ondalik
  } catch {
    return 0 // uyku izni yok / veri yok
  }
}

// Bir gunun tum verisini Health Connect'ten oku (adim/mesafe/kalori/uyku + antrenmanlar).
export async function importHealthDay(dateStr: string): Promise<HealthDay | null> {
  const mod = await getMod()
  if (!mod) return null
  const H = mod.Health // senkron erişim (thenable yoklaması tetiklenmez)
  const { start, end } = dayBounds(dateStr)

  const steps = Math.round(await agg(H, 'steps', start, end))
  const activeKcal = Math.round(await agg(H, 'active-calories', start, end))
  const totalKcal = Math.round(await agg(H, 'total-calories', start, end))
  const distanceM = await agg(H, 'distance', start, end)
  const sleepHours = await readSleepHours(H, dateStr)

  let workouts: HealthWorkout[] = []
  try {
    const wr = await H.queryWorkouts({
      startDate: start,
      endDate: end,
      includeHeartRate: true,
      includeRoute: false,
      includeSteps: true
    })
    workouts = (wr.workouts || []).map((w) => {
      const minutes = Math.max(1, Math.round((w.duration || 0) / 60)) // duration = saniye
      const avgHr = w.heartRate?.length
        ? Math.round(w.heartRate.reduce((s, h) => s + h.bpm, 0) / w.heartRate.length)
        : undefined
      const distKm = w.distance ? Math.round((w.distance / 1000) * 100) / 100 : undefined // distance = metre
      const startMs = w.startDate ? Date.parse(w.startDate) : NaN
      return {
        text: `${workoutLabel(w.workoutType)} ${HEALTH_TAG}`,
        startMs: Number.isFinite(startMs) ? startMs : undefined,
        minutes,
        kcal: w.calories ? Math.round(w.calories) : undefined,
        distanceKm: distKm,
        avgHr,
        steps: w.steps ? Math.round(w.steps) : undefined
      }
    })
  } catch {
    /* antrenman okunamadi; yalniz gunluk toplamlar donerse de olur */
  }

  // ANTRENMAN KAYITLARINI AYIKLA — iki ayrı sorun var.
  //
  // 1) KALORİ GÜVENİLİR DEĞİL. Eklentinin kaynağında
  //    (addWorkoutTotalCalories → sumActiveAndBasalCalories) şu var:
  //        active + basal   ... ikisi de yoksa → total
  //    Yani her antrenmanın kalorisine BAZAL METABOLİZMA katılıyor; aktif veri
  //    yoksa doğrudan günün TOPLAM yakımına düşüyor. Bunu bir diyet bütçesine
  //    eklemek "kalan kalori"yi uçuruyor. Bu sayıyı ARTIK HİÇ KULLANMIYORUZ.
  //    Bütçeye eklenen kalori tek temiz ölçüden gelir: günün AKTİF kalorisi
  //    ('active-calories' tek metrik olarak sorgulanır, bazal karışmaz).
  //
  // 2) OTURUMLARIN ÇOĞU ANTRENMAN DEĞİL. Samsung Health gün içindeki
  //    yürümeleri de "egzersiz oturumu" olarak yazıyor; 8 saatlik bir oturum
  //    çıkabiliyor. 8 saat kesintisiz egzersiz gerçekçi değil — bu, gün boyu
  //    hareketin kaydı ve zaten ADIM sayısında görünüyor. Antrenman listesine
  //    girerse hem süre saçmalıyor hem de aynı hareket iki kez görünüyor.
  //    Bu yüzden çok uzun oturumlar antrenman sayılmıyor.
  const MAX_WORKOUT_MIN = 240 // 4 saat: uzun bir yürüyüş/bisiklet hâlâ geçer
  workouts = workouts
    .filter((w) => (w.minutes || 0) <= MAX_WORKOUT_MIN)
    .map((w) => ({ ...w, kcal: undefined }))

  return {
    steps,
    distanceKm: Math.round((distanceM / 1000) * 100) / 100,
    activeKcal,
    totalKcal,
    sleepHours,
    workouts
  }
}

// Okunan gunu VERITABANINA yazar (gunluk toplamlar + antrenmanlar).
// Hem butondan hem otomatik guncellemeden ayni yol kullanilir.
export async function saveHealthDay(dateStr: string, data: HealthDay): Promise<void> {
  const { setActivityDay, replaceHealthExercises, setSleepDay } = await import('../db')
  await setActivityDay(dateStr, {
    count: data.steps,
    activeKcal: data.activeKcal,
    burnedKcal: data.totalKcal,
    distanceKm: data.distanceKm
  })
  await replaceHealthExercises(dateStr, HEALTH_TAG, data.workouts)
  // Uyku yalnizca veri VARSA yazilir; 0 gelirse elle girilmis kaydi silmeyelim
  if (data.sleepHours > 0) await setSleepDay(dateStr, data.sleepHours)
}

// OTOMATIK GUNCELLEME: uygulama acildiginda / one geldiginde BUGUNU sessizce
// tazeler. Izin YOKSA hicbir sey yapmaz (izin penceresi acmaz). Cok sik
// calismasin diye kisa bir bekleme (throttle) uygulanir.
let lastAutoSync = 0
const AUTO_SYNC_MIN_GAP = 3 * 60 * 1000 // en fazla 3 dakikada bir

export async function autoSyncHealthToday(force = false): Promise<boolean> {
  const now = Date.now()
  if (!force && now - lastAutoSync < AUTO_SYNC_MIN_GAP) return false
  try {
    if (!(await healthAvailable())) return false
    if (!(await healthPermsGranted())) return false // izin yok: sessizce çık
    const today = new Date().toLocaleDateString('en-CA')
    const data = await importHealthDay(today)
    if (!data) return false
    await saveHealthDay(today, data)
    lastAutoSync = now
    return true
  } catch {
    return false // otomatik iş; hata kullanıcıyı rahatsız etmesin
  }
}
