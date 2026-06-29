// Gunluk rapor uretimi ve paylasimi (diyetisyene gondermek icin).
// Token harcamaz — sadece kayitli verilerden duz metin olusturur.
import { dietDb } from '../db'
import { dayAdherence } from '../streak'
import { mealLabel, MEAL_OPTIONS } from './meals'

const TR_DECISION: Record<string, string> = {
  resisted: 'vazgeçti ✅',
  ate: 'yedi ⚠️',
  none: 'karar bekliyor ⏳'
}

// Belirli bir gunun (YYYY-MM-DD) raporunu duz metin olarak uretir
export async function buildDailyReport(dateStr: string, userName?: string): Promise<string> {
  const [entries, measurements, vitals, exercises, waterRow, stepsRow, sleepRow] = await Promise.all([
    dietDb.entries.where('dateStr').equals(dateStr).toArray(),
    dietDb.measurements.where('dateStr').equals(dateStr).toArray(),
    dietDb.vitals.where('dateStr').equals(dateStr).toArray(),
    dietDb.exercises.where('dateStr').equals(dateStr).toArray(),
    dietDb.water.where('dateStr').equals(dateStr).first(),
    dietDb.steps.where('dateStr').equals(dateStr).first(),
    dietDb.sleep.where('dateStr').equals(dateStr).first()
  ])

  const lines: string[] = []
  lines.push(`🥗 DİYET RAPORU — ${dateStr}`)
  if (userName) lines.push(`Kişi: ${userName}`)
  // Gunluk diyet basari yuzdesi
  const adh = dayAdherence(entries, dateStr)
  if (adh != null) lines.push(`📊 Günlük diyet başarısı: %${adh}`)
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
        lines.push(`   • ${t} — ${e.foodName} (~${e.estimatedCalories} kcal) — ${TR_DECISION[e.decision] ?? ''}${comp}`)
      }
    }
    lines.push('')
    const ate = entries.filter((e) => e.decision === 'ate').length
    const resisted = entries.filter((e) => e.decision === 'resisted').length
    const kcal = entries.filter((e) => e.decision === 'ate').reduce((s, e) => s + (e.estimatedCalories || 0), 0)
    lines.push(`  Özet: ${resisted} vazgeçiş, ${ate} yenen öğün, ~${kcal} kcal alındı.`)
  }
  lines.push('')

  // Olculer
  if (measurements.length) {
    lines.push('📏 ÖLÇÜLER')
    for (const m of measurements) {
      const parts: string[] = []
      if (m.weight != null) parts.push(`Kilo ${m.weight}kg`)
      if (m.waist != null) parts.push(`Bel ${m.waist}cm`)
      if (m.navel != null) parts.push(`Göbek ${m.navel}cm`)
      if (m.fold != null) parts.push(`Kıvrım ${m.fold}cm`)
      if (m.hip != null) parts.push(`Kalça ${m.hip}cm`)
      if (m.chest != null) parts.push(`Göğüs ${m.chest}cm`)
      if (m.arm != null) parts.push(`Kol ${m.arm}cm`)
      if (m.leg != null) parts.push(`Bacak ${m.leg}cm`)
      lines.push('  • ' + parts.join(', '))
    }
    lines.push('')
  }

  // Egzersiz
  if (exercises.length) {
    lines.push('🏃 EGZERSİZ')
    for (const ex of exercises.sort((a, b) => a.createdAt - b.createdAt)) {
      lines.push(`  • ${ex.text}${ex.minutes ? ` (${ex.minutes} dk)` : ''}`)
    }
    lines.push('')
  }

  // Su
  if (waterRow?.glasses) {
    lines.push(`💧 SU: ${waterRow.glasses} bardak (~${waterRow.glasses * 200} ml)`)
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
