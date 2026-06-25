// Iletisim ve dogum gunu yardimcilari
import type { Customer } from '../types'

// Telefon arama baglantisi
export function telLink(phone: string): string {
  return `tel:${phone.replace(/\s/g, '')}`
}

// WhatsApp baglantisi (wa.me uluslararasi formati ister, + ve bosluk olmadan)
export function whatsappLink(phone: string, message?: string): string {
  let digits = phone.replace(/[^\d]/g, '')
  if (digits.startsWith('0')) digits = '90' + digits.slice(1)
  if (digits.length === 10 && digits.startsWith('5')) digits = '90' + digits
  const base = `https://wa.me/${digits}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

// Bugun dogum gunu olan musteriler
export function todaysBirthdays(customers: Customer[], today = new Date()): Customer[] {
  const m = today.getMonth() + 1
  const d = today.getDate()
  return customers.filter((c) => {
    if (!c.birthDate) return false
    const parts = c.birthDate.split('-')
    if (parts.length < 3) return false
    const bm = Number(parts[1])
    const bd = Number(parts[2])
    return bm === m && bd === d
  })
}

// Yas hesapla
export function calcAge(birthDate?: string, today = new Date()): number | null {
  if (!birthDate) return null
  const parts = birthDate.split('-').map(Number)
  if (parts.length < 3) return null
  const [y, m, d] = parts
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--
  return age >= 0 && age < 150 ? age : null
}
