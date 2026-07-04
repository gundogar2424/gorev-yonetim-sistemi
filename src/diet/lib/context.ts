// ORTAK SAGLIK AKLI: veritabanindaki HER SEYDEN kompakt bir baglam metni
// uretir ve tum yapay zeka modullerine verilir. Boylece moduller birbirinin
// verisini kullanir (kilo/olcu egilimi, seker, ilac, bugunku durum, kriz
// oruntusu...). Yerel DB okumasi — internet/token maliyeti sadece bu metnin
// modele gitmesi kadardir.
import { dietDb } from '../db'
import { todayStr, dayAdherence } from '../streak'
import { mealLabel } from './meals'
import type { DietSettings, Measurement } from '../types'

const fmt = (n: number) => Math.round(n * 10) / 10

export async function buildHealthContext(settings?: DietSettings): Promise<string> {
  const today = todayStr()
  const since30 = todayStr(new Date(Date.now() - 29 * 86_400_000))
  const since14 = todayStr(new Date(Date.now() - 13 * 86_400_000))

  const [entries, measurements, vitals, exercises, waterRow, checkins, cravings, labs] = await Promise.all([
    dietDb.entries.toArray(),
    dietDb.measurements.orderBy('createdAt').toArray(),
    dietDb.vitals.orderBy('createdAt').toArray(),
    dietDb.exercises.toArray(),
    dietDb.water.where('dateStr').equals(today).first(),
    dietDb.checkins.where('dateStr').equals(today).sortBy('createdAt'),
    dietDb.cravings.toArray(),
    dietDb.labs.orderBy('createdAt').toArray()
  ])

  const L: string[] = []

  // Profil
  const prof: string[] = []
  if (settings?.gender) prof.push(settings.gender)
  if (settings?.age) prof.push(`${settings.age} yaş`)
  if (settings?.heightCm) prof.push(`boy ${settings.heightCm} cm`)
  const weights = measurements.filter((m) => typeof m.weight === 'number')
  const lastW = weights.length ? (weights[weights.length - 1].weight as number) : undefined
  if (lastW) prof.push(`kilo ${lastW} kg`)
  if (settings?.targetWeight) prof.push(`hedef kilo ${settings.targetWeight} kg`)
  if (prof.length) L.push(`Profil: ${prof.join(', ')}.`)
  if (settings?.conditions?.trim()) L.push(`Rahatsızlıklar: ${settings.conditions.trim()}.`)
  if (settings?.medications?.trim()) L.push(`Kullandığı ilaçlar: ${settings.medications.trim()}.`)
  if (settings?.preferences?.trim()) {
    L.push(
      `KİŞİSEL ALIŞKANLIKLAR/TERCİHLER (analiz ve tahminlerde MUTLAKA bunları esas al, görselden aksini VARSAYMA): ${settings.preferences.trim()}. Örn. "kahveyi şekersiz içer" dendiyse kahveyi şekersiz say, kaloriyi ve şekeri ona göre hesapla.`
    )
  }

  // Kilo + TUM olcu egilimleri (son 30 gun) — "yagdan mi kastan mi" sorusu
  // icin ham veri: kilo sabitken bel/gobek inceliyorsa yag kaybi lehinedir.
  const m30 = measurements.filter((m) => m.dateStr >= since30)
  const trend = (key: keyof Measurement, label: string, unit: string): string | null => {
    const withVal = m30.filter((m) => typeof m[key] === 'number')
    if (withVal.length < 2) return null
    const a = withVal[0][key] as number
    const b = withVal[withVal.length - 1][key] as number
    const d = fmt(b - a)
    if (d === 0) return `${label} sabit (${b}${unit})`
    return `${label} ${a}→${b}${unit} (${d > 0 ? '+' : ''}${d})`
  }
  const trends = [
    trend('weight', 'kilo', 'kg'),
    trend('fold', 'bel kıvrımı', 'cm'),
    trend('navel', 'göbek', 'cm'),
    trend('hip', 'kalça', 'cm'),
    trend('chest', 'göğüs', 'cm'),
    trend('arm', 'kol', 'cm'),
    trend('leg', 'bacak', 'cm')
  ].filter(Boolean)
  if (trends.length) {
    L.push(
      `Son 30 gün ölçü eğilimi: ${trends.join(' · ')}. (Yorum ipucu: kilo sabit/az düşükken bel-göbek inceliyorsa yağ kaybı + kas korunumu olasıdır; kol/bacak inceliyor ama bel değişmiyorsa kas kaybına dikkat çek.)`
    )
  }

  // TUM ZAMAN yolculugu: ilk kayittan bugune degisim (uzun vadeli seyir).
  // 30 gunluk pencere tum kilo verme surecini gostermeyebilir; bu onu tamamlar.
  const journey = (key: keyof Measurement, label: string, unit: string): string | null => {
    const withVal = measurements.filter((m) => typeof m[key] === 'number')
    if (withVal.length < 2) return null
    const a = withVal[0][key] as number
    const b = withVal[withVal.length - 1][key] as number
    const d = fmt(b - a)
    if (d === 0) return null
    const firstDate = withVal[0].dateStr
    return `${label} ${a}→${b}${unit} (${d > 0 ? '+' : ''}${d}, ${firstDate}’ten beri)`
  }
  const journeys = [
    journey('weight', 'kilo', 'kg'),
    journey('fold', 'bel kıvrımı', 'cm'),
    journey('navel', 'göbek', 'cm'),
    journey('hip', 'kalça', 'cm'),
    journey('chest', 'göğüs', 'cm'),
    journey('arm', 'kol', 'cm'),
    journey('leg', 'bacak', 'cm')
  ].filter(Boolean)
  if (journeys.length) {
    L.push(`Başlangıçtan bugüne toplam değişim: ${journeys.join(' · ')}. (Kilo düşerken bel/kalça/bacak da inceliyorsa süreç sağlıklı ilerliyor demektir; bunu bütünsel yorumla.)`)
  }

  // Seker: son 5 olcum + ortalama; tansiyon: son deger
  const sugars = vitals.filter((v) => v.kind === 'seker' && typeof v.sugar === 'number')
  if (sugars.length) {
    const last5 = sugars.slice(-5).map((v) => `${v.sugar}${v.sugarContext ? `(${v.sugarContext})` : ''}`)
    const pool = sugars.slice(-10)
    const avg = Math.round(pool.reduce((s, v) => s + (v.sugar || 0), 0) / pool.length)
    L.push(`Kan şekeri: son ölçümler ${last5.join(', ')} mg/dL; son ortalama ~${avg}.`)
  }
  const bps = vitals.filter((v) => v.kind === 'tansiyon' && typeof v.systolic === 'number')
  if (bps.length) {
    const b = bps[bps.length - 1]
    L.push(`Son tansiyon: ${b.systolic}/${b.diastolic}${b.pulse ? `, nabız ${b.pulse}` : ''}.`)
  }

  // Son 7 gun diyet basarisi ortalamasi
  const adhs: number[] = []
  for (let i = 0; i < 7; i++) {
    const d = todayStr(new Date(Date.now() - i * 86_400_000))
    const p = dayAdherence(entries, d)
    if (p != null) adhs.push(p)
  }
  if (adhs.length) L.push(`Son 7 gün diyet başarısı ortalaması: %${Math.round(adhs.reduce((a, b) => a + b, 0) / adhs.length)}.`)

  // Bugunku durum: kalori, su, spor, son moral
  const todays = entries.filter((e) => e.dateStr === today && e.decision === 'ate')
  const kcal = todays.reduce((s, e) => s + (e.estimatedCalories || 0), 0)
  const waterMl = waterRow ? (waterRow.ml != null ? waterRow.ml : (waterRow.glasses || 0) * 200) : 0
  const exToday = exercises.filter((e) => e.dateStr === today)
  const bits = [`~${kcal} kcal alındı${settings?.calorieGoal ? ` (günlük hedef ${settings.calorieGoal})` : ''}`]
  if (waterMl > 0) bits.push(`${waterMl} ml su içildi`)
  if (exToday.length) bits.push(`spor: ${exToday.map((e) => e.text).join(', ')}`)
  const lastMood = checkins.length ? checkins[checkins.length - 1] : undefined
  if (lastMood?.mood != null) bits.push(`son moral ${lastMood.mood}/10${lastMood.note ? ` ("${lastMood.note}")` : ''}`)
  L.push(`Bugün şu ana kadar: ${bits.join(' · ')}.`)

  // Tokluk dusuk ogun tipleri (son 14 gun) — porsiyon sinyali
  const lowSat = entries.filter((e) => e.dateStr >= since14 && e.decision === 'ate' && e.satiety != null && e.satiety <= 4)
  if (lowSat.length) {
    const byMeal = new Map<string, number>()
    for (const e of lowSat) {
      const k = e.mealType ? mealLabel(e.mealType) : 'Diğer'
      byMeal.set(k, (byMeal.get(k) ?? 0) + 1)
    }
    L.push(
      `Son 14 günde tokluğu düşük (≤4/10) öğünler: ${[...byMeal.entries()].map(([k, n]) => `${k} x${n}`).join(', ')} — porsiyon yetersizliği sinyali.`
    )
  }

  // Kriz oruntusu (son 14 gun): saat dagilimi + direnc orani
  const cr = cravings.filter((c) => c.dateStr >= since14)
  if (cr.length) {
    const hrs = cr.map((c) => `${new Date(c.createdAt).getHours()}:00`)
    const res = cr.filter((c) => c.outcome === 'resisted').length
    L.push(`Son 14 günde ${cr.length} kriz anı (saatler: ${hrs.join(', ')}); ${res}/${cr.length} direnç. Kriz saatleri yaklaşırken önden uyarabilirsin.`)
  }

  // Son tahlil(ler): en yeni 1-2 kaydin kisa ozeti (kompakt tutulur). Boylece
  // koc/yemek/seker analizi de tahlil sonuclarini (HbA1c, kolesterol vb.) bilir.
  if (labs.length) {
    const recent = labs.slice(-2)
    const bits = recent.map((lb) => {
      const body = (lb.analysis?.trim() || lb.text?.trim() || '').replace(/\s+/g, ' ').slice(0, 500)
      return `[${lb.dateStr}] ${lb.title || 'Tahlil'}: ${body}`
    })
    L.push(`Son tahlil(ler) (özet; ilaç/rahatsızlıkla birlikte değerlendir):\n${bits.join('\n')}`)
  }

  return L.join('\n')
}
