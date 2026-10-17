// DISARIDA YEME HARCAMASI: ziyaretlerde "hesabi ben odediysem" yazilan tutarlar
import type { LzMekan } from '../types'

// "1.250", "1250,50", "1 250 TL" -> 1250 / 1250.5; bos ya da gecersizse undefined
export function tutarOku(yazi: string): number | undefined {
  const t = yazi.replace(/[^\d.,]/g, '')
  if (!t) return undefined
  const n = Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/[.,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : undefined
}
export function tlYaz(n: number): string {
  return `${n.toLocaleString('tr', { maximumFractionDigits: 2 })} TL`
}

export interface Odeme {
  tarih: string // YYYY-AA-GG
  tutar: number
  mekan: LzMekan
}
export function odemeler(mekanlar: LzMekan[]): Odeme[] {
  return mekanlar
    .flatMap((m) => (m.ziyaretler ?? []).filter((z) => z.tutar).map((z) => ({ tarih: z.tarih, tutar: z.tutar!, mekan: m })))
    .sort((a, b) => b.tarih.localeCompare(a.tarih))
}
export function bugunAyYil(): { ay: string; yil: string } {
  const d = new Date()
  const yil = String(d.getFullYear())
  return { yil, ay: `${yil}-${String(d.getMonth() + 1).padStart(2, '0')}` }
}
