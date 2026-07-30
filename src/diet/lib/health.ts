// Health Connect (Google) uzerinden Samsung Health verisini OKUR: adim, mesafe,
// kalori ve antrenmanlar (nabizla). Samsung Health bu verileri Health Connect'e
// yazar; biz de kullanicinin izniyle oradan okuruz. YALNIZCA APK'da (native)
// calisir; web'de sessizce devre disidir.
import type { HealthPlugin, HealthPermission } from 'capacitor-health'

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
    if (!modPromise) modPromise = import('capacitor-health') as unknown as Promise<HealthMod>
    return await modPromise
  } catch {
    return null
  }
}

// Istedigimiz izinler: adim, antrenman, aktif/toplam kalori, mesafe, nabiz.
const PERMS: HealthPermission[] = [
  'READ_STEPS',
  'READ_WORKOUTS',
  'READ_ACTIVE_CALORIES',
  'READ_TOTAL_CALORIES',
  'READ_DISTANCE',
  'READ_HEART_RATE'
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
}
export interface HealthDay {
  steps: number
  distanceKm: number
  activeKcal: number
  totalKcal: number
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

// Bir gunun tum verisini Health Connect'ten oku (adim/mesafe/kalori + antrenmanlar).
export async function importHealthDay(dateStr: string): Promise<HealthDay | null> {
  const mod = await getMod()
  if (!mod) return null
  const H = mod.Health // senkron erişim (thenable yoklaması tetiklenmez)
  const { start, end } = dayBounds(dateStr)

  const steps = Math.round(await agg(H, 'steps', start, end))
  const activeKcal = Math.round(await agg(H, 'active-calories', start, end))
  const totalKcal = Math.round(await agg(H, 'total-calories', start, end))
  const distanceM = await agg(H, 'distance', start, end)

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
      return {
        text: `${workoutLabel(w.workoutType)} ${HEALTH_TAG}`,
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

  return {
    steps,
    distanceKm: Math.round((distanceM / 1000) * 100) / 100,
    activeKcal,
    totalKcal,
    workouts
  }
}
