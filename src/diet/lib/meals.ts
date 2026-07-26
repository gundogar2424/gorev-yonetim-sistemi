// Ogun turleri: etiketler, emojiler ve saate gore tahmin.
import type { MealType } from '../types'

export const MEAL_OPTIONS: { value: MealType; label: string; emoji: string }[] = [
  { value: 'kahvalti', label: 'Kahvaltı', emoji: '🌅' },
  { value: 'ara1', label: 'Sabah ara', emoji: '🍎' },
  { value: 'ogle', label: 'Öğle', emoji: '☀️' },
  { value: 'ikindi', label: 'Öğleden sonra ara', emoji: '🍵' },
  { value: 'aksam', label: 'Akşam', emoji: '🌇' },
  { value: 'gece', label: 'Gece ara', emoji: '🌙' },
  { value: 'serbest', label: 'Serbest öğün', emoji: '🎈' }
]

export const MEAL_LABELS: Record<MealType, string> = {
  kahvalti: 'Kahvaltı',
  ara1: 'Sabah ara',
  ogle: 'Öğle',
  ikindi: 'Öğleden sonra ara',
  aksam: 'Akşam',
  gece: 'Gece ara',
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
