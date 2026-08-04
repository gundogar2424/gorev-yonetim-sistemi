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

// UYKU IZNI ayrica sorulur. Sebebi onemli: eklenti uyku izni yoksa HATA
// ATMIYOR — bos liste donuyor (aggregateSleepSessions icinde
// `if (!hasSleepPermission) return emptyList()`). Bizim tarafta bu "0 saat
// uyku" gibi gorunuyor; kullaniciya izin eksigi hic bildirilmiyordu.
// Bu fonksiyon "izin yok" ile "o gece veri yok" durumunu ayirmamizi saglar.
export async function sleepPermGranted(): Promise<boolean> {
  const mod = await getMod()
  if (!mod) return false
  try {
    const res = (await mod.Health.checkHealthPermissions({
      permissions: ['READ_SLEEP'] as HealthPermission[]
    })) as unknown as { permissions?: Record<string, boolean> | Record<string, boolean>[] }
    const p = res?.permissions
    if (!p) return false
    const maps = Array.isArray(p) ? p : [p]
    return maps.some((m) => m?.READ_SLEEP === true)
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
// Yerel tarih (YYYY-MM-DD). toISOString() UTC'ye kaydirdigi icin kullanilmaz.
function dayStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

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
    // ASIL HATA BURADAYDI — VERDIGIMIZ SAATLER DIKKATE ALINMIYOR.
    //
    // bucket:'day' sorgularinda eklenti pencereyi TAKVIM GUNUNE yuvarliyor
    // (normalizeTimeRangeForBucket): baslangic o gunun 00:00'ina, bitis ise
    // ERTESI gunun 00:00'ina cekiliyor. Yani "dun 18:00 -> bugun 12:00" dedigimizde
    // gercekte "dun 00:00 -> yarin 00:00" = 48 SAATLIK pencere sorgulaniyor.
    // Bu pencereye IKI GECE birden giriyor ve eklenti hepsinin suresini
    // topluyordu: 6,5 saatlik gercek uyku ~13-14 saat olarak donuyor, 14 saatlik
    // tavana yapisiyordu (Samsung Health 22:38-06:55 / 6sa 33dk derken
    // uygulama "14 saat" gosteriyordu).
    //
    // COZUM: donen kovalari TARIHE gore ayikla. Eklenti her kovayi uyku
    // oturumunun BASLADIGI yerel gune gore gruplayip startDate ile donuyor.
    // Bize lazim olan yalnizca iki kova:
    //   - DUN baslayan uyku (aksam yatip sabah kalkma — normal durum)
    //   - BUGUN baslayan uyku (gece yarisindan sonra yatilmissa)
    // Onceki gecelere ait kovalar atiliyor.
    const noonToday = new Date(dateStr + 'T12:00:00')
    const eveningPrev = new Date(noonToday.getTime() - 18 * 3600_000) // dun 18:00
    const r = await H.queryAggregated({
      startDate: eveningPrev.toISOString(),
      endDate: noonToday.toISOString(),
      dataType: 'sleep' as never,
      bucket: 'day'
    })

    const prevStr = dayStr(new Date(noonToday.getTime() - 86_400_000))
    const keep = new Set([prevStr, dateStr])
    const rows = r.aggregatedData || []
    // startDate "2026-08-02T00:00" gibi gelir; ilk 10 karakter tarihtir.
    const dated = rows.filter((a) => /^\d{4}-\d{2}-\d{2}/.test(String(a.startDate || '')))
    // Eklenti startDate vermezse (surum degisikligi) eski davranisa dus —
    // yanlis olabilir ama 0 dondurup veriyi yok saymaktan iyidir.
    const useRows = dated.length ? dated.filter((a) => keep.has(String(a.startDate).slice(0, 10))) : rows

    const seconds = useRows.reduce((s, a) => s + (a.value || 0), 0)
    if (!seconds) return 0
    const hours = seconds / 3600
    // MANTIK SINIRI: tek gecede 14 saatten fazla uyku pratikte veri
    // artefaktidir (ayni gecenin iki kaynaktan iki kez yazilmasi gibi). Gercek
    // disi bir sayiyi hem kullaniciya hem de koca vermektense tavana cekiyoruz.
    if (hours > 14) return 14
    return Math.round(hours * 10) / 10 // saat, tek ondalik
  } catch {
    return 0 // uyku izni yok / veri yok
  }
}

// UYKU TESHISI — Health Connect'in HAM olarak ne dondugunu gosterir.
//
// Neden var: uyku sayisi ust uste uc kez yanlis cikti (once 10,1 sa, sonra 14 sa,
// sonra 3,9 sa) ve her seferinde hangi asamanin bozuk oldugunu tahmin etmek
// zorunda kaldik. Bu fonksiyon tahmini bitirir: eklentinin donduğu her kovayi
// tarihiyle birlikte listeler ve hangisinin sayildigini gosterir. Ekran
// goruntusu tek basina teshis icin yeter.
export async function sleepDebugText(dateStr: string): Promise<string> {
  const mod = await getMod()
  if (!mod) return 'Health Connect eklentisi yüklü değil.'
  const H = mod.Health
  const noonToday = new Date(dateStr + 'T12:00:00')
  const eveningPrev = new Date(noonToday.getTime() - 18 * 3600_000)
  const prevStr = dayStr(new Date(noonToday.getTime() - 86_400_000))
  try {
    const r = await H.queryAggregated({
      startDate: eveningPrev.toISOString(),
      endDate: noonToday.toISOString(),
      dataType: 'sleep' as never,
      bucket: 'day'
    })
    const rows = r.aggregatedData || []
    if (!rows.length) return `İstenen: ${prevStr} 18:00 → ${dateStr} 12:00\nHealth Connect hiç kayıt döndürmedi.`
    const lines = rows.map((a) => {
      const d = String(a.startDate || '').slice(0, 10) || '(tarihsiz)'
      const h = Math.round(((a.value || 0) / 3600) * 100) / 100
      const used = d === prevStr || d === dateStr ? '✓ sayıldı' : '✗ atıldı'
      return `${d} → ${h} sa  ${used}`
    })
    const kept = rows
      .filter((a) => {
        const d = String(a.startDate || '').slice(0, 10)
        return d === prevStr || d === dateStr
      })
      .reduce((s, a) => s + (a.value || 0), 0)
    return [
      `İstenen: ${prevStr} 18:00 → ${dateStr} 12:00`,
      `Health Connect ${rows.length} kova döndürdü:`,
      ...lines,
      `Toplam sayılan: ${Math.round((kept / 3600) * 100) / 100} sa`
    ].join('\n')
  } catch (e) {
    return `Uyku okunamadı: ${e instanceof Error ? e.message : String(e)}`
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

  // 3) YANLIS GUNE YAZILMA. Health Connect'e "bugun 00:00 - 24:00" araligi
  //    veriliyor, ama sorgu araliga DEGEN oturumlari da donduruyor: dun gece
  //    23:40'ta baslayip 00:05'te biten bir yuruyus bugunun sonucuna giriyor
  //    ve bugune antrenman olarak yaziliyordu. Kullanici spor yapmadigi gunde
  //    "egzersiz" goruyordu.
  //    Kural: oturum HANGI GUN BASLADIYSA o gune aittir. Baslangici bu gunun
  //    disinda kalanlar eleniyor; kendi gunu ice aktarilinca zaten yazilacak.
  const { start: dayStart, end: dayEnd } = dayBounds(dateStr)
  const startsToday = (w: HealthWorkout): boolean => {
    if (w.startMs == null) return true // baslangic bilinmiyorsa dokunma
    const t = w.startMs
    return t >= Date.parse(dayStart) && t < Date.parse(dayEnd)
  }

  workouts = workouts
    .filter((w) => (w.minutes || 0) <= MAX_WORKOUT_MIN)
    .filter(startsToday)
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
