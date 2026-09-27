// Yerel tarih yardimcilari (UTC kaymasi olmasin diye toISOString kullanilmaz).
import type { LzMeal } from '../types'

export function gunAnahtari(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Verilen tarihin haftasinin pazartesisi
export function haftaBasi(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const gun = (x.getDay() + 6) % 7 // Pazartesi = 0
  x.setDate(x.getDate() - gun)
  return x
}

export function gunEkle(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const GUN_ADI = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

export const OGUNLER: { id: LzMeal; ad: string; emoji: string }[] = [
  { id: 'kahvalti', ad: 'Kahvaltı', emoji: '☕' },
  { id: 'ogle', ad: 'Öğle', emoji: '🥗' },
  { id: 'aksam', ad: 'Akşam', emoji: '🍲' }
]

export function kisaTarih(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}
