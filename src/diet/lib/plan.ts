// HAFTALIK PLAN METNI — diyet listesinin 7 gune dagitilmis halini okunabilir
// metne cevirir.
//
// Nerede kullaniliyor: alisveris listesi. Ham diyet listesi "haftada 5 gun
// yumurtali, 2 gun yulafli" diyor; modelin bundan dogru MIKTARI cikarmasi
// gerekiyor ve cogu zaman ya hepsini 7 gunluk aliyor ya da eksik birakiyor.
// Gunlerin acik dokumu verilince "5 gun x 2 yumurta = 10 yumurta, 2 gunluk
// yulaf" gibi net bir sayim yapabiliyor.
import type { DietSettings, MealType } from '../types'

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const MEALS: { k: MealType; l: string }[] = [
  { k: 'kahvalti', l: 'Kahvaltı' },
  { k: 'ara1', l: 'Sabah ara' },
  { k: 'ogle', l: 'Öğle' },
  { k: 'ikindi', l: 'İkindi' },
  { k: 'aksam', l: 'Akşam' },
  { k: 'gece', l: 'Gece ara' }
]

// Pazartesi'den baslar (kullanicinin hafta algisi), Pazar'la biter.
const ORDER = [1, 2, 3, 4, 5, 6, 0]

export function formatWeekPlan(settings?: DietSettings): string {
  const week = settings?.dietPlanWeek
  if (!week) return ''
  const blocks: string[] = []
  for (const d of ORDER) {
    const day = week[String(d)]
    if (!day) continue
    const rows = MEALS.filter((m) => day[m.k]?.trim()).map((m) => `  ${m.l}: ${day[m.k]}`)
    if (!rows.length) continue
    const tag = day.etiket?.trim() ? ` (${day.etiket.trim()})` : ''
    blocks.push(`${DAY_NAMES[d]}${tag}:\n${rows.join('\n')}`)
  }
  return blocks.join('\n')
}
