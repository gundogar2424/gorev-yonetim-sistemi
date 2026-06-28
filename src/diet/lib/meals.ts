// Ogun turleri: etiketler, emojiler ve saate gore tahmin.
import type { MealType } from '../types'

export const MEAL_OPTIONS: { value: MealType; label: string; emoji: string }[] = [
  { value: 'kahvalti', label: 'Kahvaltı', emoji: '🌅' },
  { value: 'ara1', label: 'Ara öğün', emoji: '🍎' },
  { value: 'ogle', label: 'Öğle', emoji: '☀️' },
  { value: 'ikindi', label: 'İkindi', emoji: '🍵' },
  { value: 'aksam', label: 'Akşam', emoji: '🌇' },
  { value: 'gece', label: 'Gece ara öğün', emoji: '🌙' },
  { value: 'serbest', label: 'Serbest öğün', emoji: '🎈' }
]

export const MEAL_LABELS: Record<MealType, string> = {
  kahvalti: 'Kahvaltı',
  ara1: 'Ara öğün',
  ogle: 'Öğle',
  ikindi: 'İkindi',
  aksam: 'Akşam',
  gece: 'Gece ara öğün',
  serbest: 'Serbest öğün'
}

export function mealLabel(t?: MealType): string {
  return t ? MEAL_LABELS[t] : ''
}

export function mealEmoji(t?: MealType): string {
  return MEAL_OPTIONS.find((o) => o.value === t)?.emoji ?? '🍽️'
}

// Saate gore en olasi ogunu tahmin et (varsayilan secim icin)
export function guessMeal(d: Date = new Date()): MealType {
  const h = d.getHours()
  if (h < 10) return 'kahvalti'
  if (h < 12) return 'ara1'
  if (h < 15) return 'ogle'
  if (h < 18) return 'ikindi'
  if (h < 22) return 'aksam'
  return 'gece'
}
