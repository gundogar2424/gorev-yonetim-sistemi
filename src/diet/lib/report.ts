// Gunluk rapor uretimi ve paylasimi (diyetisyene gondermek icin).
// Token harcamaz — sadece kayitli verilerden duz metin olusturur.
import { dietDb } from '../db'
import { dayAdherence } from '../streak'
import { mealLabel, MEAL_OPTIONS } from './meals'
import type { DietEntry, CheckIn, MealType } from '../types'

// Gun ici aclik kayitlarini OGUN ONCESI / SONRASI olarak etiketler.
// Her kayit iki komsu ogune gore konumlanir: bir onceki ogunden SONRA, bir
// sonraki ogunden ONCE. Boylece diyetisyen "kahvalti oncesi 8/10, kahvalti
// sonrasi 3/10" gibi ogun bazli aclik seyrini gorur. Ogun saati degisse de
// (gec kahvalti vb.) gercek kayit saatine gore dogru yere oturur.
export interface HungerGroup {
  label: string // orn. "🌅 Kahvaltı (09:30) öncesi" / "🌅 Kahvaltı (09:30) sonrası"
  mtime: string // ilgili ogunun saati (varsa)
  recs: CheckIn[]
}
export function groupHungerByMeal(entries: DietEntry[], checkins: CheckIn[]): HungerGroup[] {
  const meals = entries.filter((e) => e.decision === 'ate').sort((a, b) => a.createdAt - b.createdAt)
  const hunger = checkins.filter((c) => c.hunger != null).sort((a, b) => a.createdAt - b.createdAt)
  const byKey = new Map<string, HungerGroup>()
  const order: string[] = []
  const mLabel = (m: DietEntry) => {
    const t = new Date(m.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    return `${mealLabel((m.mealType ?? 'serbest') as MealType)}${[m.alsoMeal, m.alsoMeal2].filter(Boolean).map((x) => '+' + mealLabel(x as MealType)).join('')} (${t})`
  }
  for (const c of hunger) {
    // Kayittan onceki son ogun (prev) ve sonraki ilk ogun (next)
    let prev: DietEntry | null = null
    let next: DietEntry | null = null
    for (const meal of meals) {
      if (meal.createdAt <= c.createdAt) prev = meal
      else {
        next = meal
        break
      }
    }
    // Etiket: bir SONRAKI ogun varsa "X öncesi" (diyetisyen icin ogun oncesi aclik
    // daha anlamli); yoksa son ogunden sonra -> "X sonrası"; hic ogun yoksa genel.
    let key: string, label: string, mtime: string
    if (next) {
      key = `b${next.id ?? next.createdAt}`
      label = `${mLabel(next)} ÖNCESİ`
      mtime = ''
    } else if (prev) {
      key = `a${prev.id ?? prev.createdAt}`
      label = `${mLabel(prev)} SONRASI`
      mtime = ''
    } else {
      key = 'none'
      label = 'Öğün kaydı yok (gün içi)'
      mtime = ''
    }
    if (!byKey.has(key)) {
      byKey.set(key, { label, mtime, recs: [] })
      order.push(key)
    }
    byKey.get(key)!.recs.push(c)
  }
  return order.map((k) => byKey.get(k)!)
}
export function hungerAvg(checkins: CheckIn[]): number {
  const h = checkins.filter((c) => c.hunger != null)
  if (!h.length) return 0
  return Math.round((h.reduce((s, c) => s + (c.hunger || 0), 0) / h.length) * 10) / 10
}

const TR_DECISION: Record<string, string> = {
  resisted: 'vazgeçti ✅',
  ate: 'yedi ⚠️',
  none: 'karar bekliyor ⏳'
}

const SEP = '━━━━━━━━━━━━━━━━'

// Belirli bir gunun (YYYY-MM-DD) raporunu duz metin olarak uretir
export async function buildDailyReport(dateStr: string, userName?: string): Promise<string> {
  const [entries, measurements, vitals, exercises, waterRow, stepsRow, sleepRow, cravings, checkins] = await Promise.all([
    dietDb.entries.where('dateStr').equals(dateStr).toArray(),
    dietDb.measurements.where('dateStr').equals(dateStr).toArray(),
    dietDb.vitals.where('dateStr').equals(dateStr).toArray(),
    dietDb.exercises.where('dateStr').equals(dateStr).toArray(),
    dietDb.water.where('dateStr').equals(dateStr).first(),
    dietDb.steps.where('dateStr').equals(dateStr).first(),
    dietDb.sleep.where('dateStr').equals(dateStr).first(),
    dietDb.cravings.where('dateStr').equals(dateStr).toArray(),
    dietDb.checkins.where('dateStr').equals(dateStr).sortBy('createdAt')
  ])

  const dateNice = new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  const lines: string[] = []
  lines.push('🥗 GÜNLÜK DİYET RAPORU')
  lines.push(`📅 ${dateNice}${userName ? ` · ${userName}` : ''}`)
  lines.push(SEP)
  // Ozet seridi: basari + kalori + su + spor
  const adh = dayAdherence(entries, dateStr)
  const kcalDay = entries.filter((e) => e.decision === 'ate').reduce((s, e) => s + (e.estimatedCalories || 0), 0)
  const waterMlTop = waterRow ? (waterRow.ml != null ? waterRow.ml : (waterRow.glasses || 0) * 200) : 0
  const exMin = exercises.reduce((s, e) => s + (e.minutes ?? 0), 0)
  const strip: string[] = []
  if (adh != null) strip.push(`📊 Başarı %${adh}`)
  strip.push(`🔥 ~${kcalDay} kcal`)
  if (waterMlTop > 0) strip.push(`💧 ${waterMlTop} ml`)
  if (exercises.length) strip.push(`🏃 ${exMin > 0 ? `${exMin} dk` : `${exercises.length} egzersiz`}`)
  lines.push(strip.join('  ·  '))
  lines.push(SEP)
  lines.push('')

  // Ogunler — ogune gore gruplanir (Kahvalti, Ogle, ... basliklari altinda)
  lines.push('🍽️ ÖĞÜNLER')
  if (entries.length === 0) {
    lines.push('  (kayıt yok)')
  } else {
    const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt)
    const groups: (string | undefined)[] = [...MEAL_OPTIONS.map((o) => o.value), undefined]
    for (const mt of groups) {
      const items = sorted.filter((e) => (e.mealType ?? undefined) === mt)
      if (!items.length) continue
      lines.push('')
      lines.push(`▸ ${mt ? mealLabel(mt as never) : 'Diğer'}`)
      for (const e of items) {
        const t = new Date(e.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        const comp = e.compliancePercent >= 0 ? ` · listeye uyum %${e.compliancePercent}` : ''
        const birlesik = e.alsoMeal ? ` · 🔗 ${mealLabel(e.mealType as never)}${[e.alsoMeal, e.alsoMeal2].filter(Boolean).map((x) => '+' + mealLabel(x as never)).join('')} birleşik` : ''
        lines.push(`   • ${t} — ${e.foodName} (~${e.estimatedCalories} kcal) — ${TR_DECISION[e.decision] ?? ''}${comp}${birlesik}`)
      }
    }
    lines.push('')
    const eaten = entries.filter((e) => e.decision === 'ate')
    const ate = eaten.length
    const resisted = entries.filter((e) => e.decision === 'resisted').length
    const kcal = eaten.reduce((s, e) => s + (e.estimatedCalories || 0), 0)
    lines.push(`  Özet: ${resisted} vazgeçiş, ${ate} yenen öğün, ~${kcal} kcal alındı.`)
  }
  lines.push('')

  // GUN ICI ACLIK (moral GONDERILMEZ — sadece aclik). Diyetisyen porsiyon/ogun
  // araligini ayarlamak icin gun ici acligi gormek ister.
  const hungerRecs = checkins.filter((c) => c.hunger != null)
  if (hungerRecs.length) {
    lines.push('🍽️ GÜN İÇİ AÇLIK (1 tok — 10 çok aç)')
    for (const g of groupHungerByMeal(entries, checkins)) {
      lines.push(`▸ ${g.label}${g.mtime ? ` (${g.mtime})` : ''}`)
      for (const c of g.recs) {
        const t = new Date(c.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        lines.push(`   • ${t} — açlık ${c.hunger}/10`)
      }
    }
    lines.push(`  Ortalama açlık: ${hungerAvg(checkins)}/10`)
    lines.push('')
  }

  // Olculer
  if (measurements.length) {
    lines.push('📏 ÖLÇÜLER')
    for (const m of measurements) {
      const parts: string[] = []
      if (m.weight != null) parts.push(`Kilo ${m.weight}kg`)
      if (m.arm != null) parts.push(`Kol ${m.arm}cm`)
      if (m.chest != null) parts.push(`Göğüs ${m.chest}cm`)
      if (m.fold != null) parts.push(`Bel kıvrımı ${m.fold}cm`)
      if (m.navel != null) parts.push(`Göbek deliği ${m.navel}cm`)
      if (m.hip != null) parts.push(`Kalça ${m.hip}cm`)
      if (m.leg != null) parts.push(`Bacak ${m.leg}cm`)
      lines.push('  • ' + parts.join(', '))
    }
    lines.push('')
  }

  // Egzersiz
  if (exercises.length) {
    lines.push('🏃 EGZERSİZ')
    for (const ex of exercises.sort((a, b) => a.createdAt - b.createdAt)) {
      const extra = [ex.minutes ? `${ex.minutes} dk` : '', ex.kcal ? `~${ex.kcal} kcal` : ''].filter(Boolean).join(', ')
      lines.push(`  • ${ex.text}${extra ? ` (${extra})` : ''}`)
    }
    lines.push('')
  }

  // Kriz anlari ("canim cekti" kayitlari) — diyetisyen icin degerli sinyal
  if (cravings.length) {
    lines.push('🆘 KRİZ ANLARI')
    for (const c of cravings.sort((a, b) => a.createdAt - b.createdAt)) {
      const t = new Date(c.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      lines.push(`  • ${t}${c.note ? ` — ${c.note}` : ''} → ${c.outcome === 'resisted' ? 'direndi 💪' : 'yedi'}`)
    }
    lines.push('')
  }

  // Adim
  if (stepsRow?.count) {
    lines.push(`👟 ADIM: ${stepsRow.count.toLocaleString('tr-TR')}`)
    lines.push('')
  }

  // Uyku
  if (sleepRow?.hours) {
    lines.push(`😴 UYKU: ${sleepRow.hours} saat`)
    lines.push('')
  }

  // Saglik
  if (vitals.length) {
    lines.push('🩺 ŞEKER / TANSİYON')
    for (const v of vitals.sort((a, b) => a.time.localeCompare(b.time))) {
      if (v.kind === 'seker') {
        lines.push(`  • ${v.time} — Şeker ${v.sugar} mg/dL${v.sugarContext ? ` (${v.sugarContext})` : ''}`)
      } else {
        lines.push(`  • ${v.time} — Tansiyon ${v.systolic}/${v.diastolic}${v.pulse ? `, nabız ${v.pulse}` : ''}`)
      }
    }
    lines.push('')
  }

  lines.push(SEP)
  lines.push('Diyet Koçu uygulamasından gönderildi')
  return lines.join('\n')
}

// ---- TEK ÖĞÜN metni: bir yemeği tek başına diyetisyene göndermek için ----
export function buildMealText(e: DietEntry, userName?: string): string {
  const t = new Date(e.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const dateNice = new Date(e.dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  // Diyetisyene tekli gonderimde SADE: yalnizca urunun aciklamasi (+varsa
  // gramaji). Kalori/uyum/puan/degerlendirme yazma — yorumu diyetisyen yapar.
  const lines: string[] = []
  lines.push(`🍽️ ${e.mealType ? mealLabel(e.mealType) : 'ÖĞÜN'}${[e.alsoMeal, e.alsoMeal2].filter(Boolean).map((x) => ' + ' + mealLabel(x as never)).join('')}${e.alsoMeal ? ' (birleşik)' : ''}`)
  lines.push(`📅 ${dateNice} · ${t}${userName ? ` · ${userName}` : ''}`)
  lines.push(SEP)
  lines.push(e.foodName)
  lines.push(SEP)
  lines.push('Diyet Koçu uygulamasından gönderildi')
  return lines.join('\n')
}

// ---- Ölçüm raporu (kilo/ölçü + şeker/tansiyon) — yemeklerden ayrı ----
// Diyetisyene zaman içindeki ölçümleri (kilo, bel, şeker, tansiyon vb.)
// gönderir. Token harcamaz.
const MEASURE_FIELDS: { key: 'weight' | 'navel' | 'fold' | 'hip' | 'chest' | 'arm' | 'leg'; label: string; unit: string }[] = [
  { key: 'weight', label: 'Kilo', unit: 'kg' },
  { key: 'arm', label: 'Kol', unit: 'cm' },
  { key: 'chest', label: 'Göğüs', unit: 'cm' },
  { key: 'fold', label: 'Bel kıvrımı', unit: 'cm' },
  { key: 'navel', label: 'Göbek deliği', unit: 'cm' },
  { key: 'hip', label: 'Kalça', unit: 'cm' },
  { key: 'leg', label: 'Bacak', unit: 'cm' }
]

// dateStr (YYYY-MM-DD) son `days` gün içinde mi? (days=0 -> tümü)
function inLastDays(dateStr: string, days: number): boolean {
  if (!days) return true
  return new Date(dateStr + 'T00:00:00').getTime() >= Date.now() - days * 86_400_000
}

export async function buildMeasurementsReport(days: number, userName?: string): Promise<string> {
  const [measAll, vitAll] = await Promise.all([
    dietDb.measurements.orderBy('createdAt').toArray(),
    dietDb.vitals.orderBy('createdAt').toArray()
  ])
  const meas = measAll.filter((m) => inLastDays(m.dateStr, days))
  const vit = vitAll.filter((v) => inLastDays(v.dateStr, days))

  const lines: string[] = []
  lines.push(`📐 ÖLÇÜM RAPORU — ${days ? `son ${days} gün` : 'tüm zamanlar'}`)
  if (userName) lines.push(`Kişi: ${userName}`)
  lines.push('')

  // Ölçü & kilo: her metrik için ilk -> son ve değişim
  lines.push('📏 ÖLÇÜLER & KİLO')
  if (!meas.length) {
    lines.push('  (kayıt yok)')
  } else {
    for (const f of MEASURE_FIELDS) {
      const withVal = meas.filter((m) => typeof m[f.key] === 'number')
      if (!withVal.length) continue
      const first = withVal[0][f.key] as number
      const last = withVal[withVal.length - 1][f.key] as number
      if (withVal.length >= 2) {
        const diff = Math.round((last - first) * 10) / 10
        const arrow = diff === 0 ? '→' : diff < 0 ? '↓' : '↑'
        const sign = diff > 0 ? '+' : ''
        lines.push(`  • ${f.label}: ${first}${f.unit} → ${last}${f.unit} (${arrow} ${sign}${diff}${f.unit})`)
      } else {
        lines.push(`  • ${f.label}: ${last}${f.unit}`)
      }
    }
  }
  lines.push('')

  // Şeker / tansiyon: ortalamalar + son ölçümler
  const sugars = vit.filter((v) => v.kind === 'seker' && typeof v.sugar === 'number')
  const bps = vit.filter((v) => v.kind === 'tansiyon' && typeof v.systolic === 'number')
  if (vit.length) {
    lines.push('🩺 ŞEKER / TANSİYON')
    if (sugars.length) {
      const avg = Math.round(sugars.reduce((s, v) => s + (v.sugar || 0), 0) / sugars.length)
      lines.push(`  Şeker ortalaması: ${avg} mg/dL (${sugars.length} ölçüm)`)
    }
    if (bps.length) {
      const as = Math.round(bps.reduce((s, v) => s + (v.systolic || 0), 0) / bps.length)
      const ad = Math.round(bps.reduce((s, v) => s + (v.diastolic || 0), 0) / bps.length)
      lines.push(`  Tansiyon ortalaması: ${as}/${ad} (${bps.length} ölçüm)`)
    }
    const recent = [...vit].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12).reverse()
    for (const v of recent) {
      if (v.kind === 'seker') {
        lines.push(`  • ${v.dateStr} ${v.time} — Şeker ${v.sugar} mg/dL${v.sugarContext ? ` (${v.sugarContext})` : ''}`)
      } else {
        lines.push(`  • ${v.dateStr} ${v.time} — Tansiyon ${v.systolic}/${v.diastolic}${v.pulse ? `, nabız ${v.pulse}` : ''}`)
      }
    }
    lines.push('')
  }

  lines.push('— Diyet Koçu uygulamasından gönderildi')
  return lines.join('\n')
}

// Diyetisyene son ölçümleri gönder: KİLO DAHİL her ölçünün en güncel değeri.
// (Kilo başka gün, bel başka gün girilmiş olabilir; her biri için en son
// kayıtlı değeri alırız — böylece kilo her zaman dahil olur.) Her alanda bir
// önceki değerle kıyas da eklenir — trend görünsün.
export async function buildLatestMeasurementReport(userName?: string): Promise<string> {
  const measAll = await dietDb.measurements.orderBy('createdAt').toArray()

  const lines: string[] = []
  lines.push('📐 SON ÖLÇÜLER')
  if (userName) lines.push(`Kişi: ${userName}`)
  lines.push('')

  if (!measAll.length) {
    lines.push('  (henüz ölçüm kaydı yok)')
    lines.push('')
    lines.push('— Diyet Koçu uygulamasından gönderildi')
    return lines.join('\n')
  }

  const shortD = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })

  let any = false
  for (const f of MEASURE_FIELDS) {
    // Bu alanı içeren kayıtlar, eskiden yeniye
    const withVal = measAll.filter((m) => typeof m[f.key] === 'number')
    if (!withVal.length) continue
    any = true
    const latest = withVal[withVal.length - 1]
    const val = latest[f.key] as number
    const prev = withVal.length >= 2 ? (withVal[withVal.length - 2][f.key] as number) : null
    if (prev != null) {
      const diff = Math.round((val - prev) * 10) / 10
      const arrow = diff === 0 ? '→' : diff < 0 ? '↓' : '↑'
      const sign = diff > 0 ? '+' : ''
      lines.push(`  • ${f.label}: ${val}${f.unit} (${shortD(latest.dateStr)})  · önceki ${prev}${f.unit} ${arrow} ${sign}${diff}${f.unit}`)
    } else {
      lines.push(`  • ${f.label}: ${val}${f.unit} (${shortD(latest.dateStr)})`)
    }
  }
  if (!any) lines.push('  (ölçü değeri yok)')
  lines.push('')
  lines.push('— Diyet Koçu uygulamasından gönderildi')
  return lines.join('\n')
}

// Raporu paylas: once cihazin paylas menusu, olmazsa panoya kopyala
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  const nav = navigator as Navigator & { share?: (data: { text: string }) => Promise<void> }
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ text })
      return 'shared'
    } catch {
      // kullanici iptal etti veya desteklenmedi — kopyalamaya dus
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

// WhatsApp ile gonderme baglantisi
export function whatsappLink(text: string): string {
  return 'https://wa.me/?text=' + encodeURIComponent(text)
}
