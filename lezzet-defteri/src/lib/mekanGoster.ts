// MEKAN GOSTERIMI: kayitli veri degismez, yalnizca ekranda nasil yazilacagi.
// Fiyat etiketi "₺ / ₺₺ / ₺₺₺" bazi telefonlarda bozuk gorunuyor: duz yaziyla gosterilir.
import type { LzMekan } from '../types'

const FIYAT: Record<string, string> = { '₺': 'Uygun', '₺₺': 'Orta', '₺₺₺': 'Pahalı', '₺₺₺₺': 'Pahalı' }

export function etiketAdi(e: string): string {
  return FIYAT[e.trim()] ?? e
}

// Serbest fiyat metnindeki tek basina duran ₺ isaretlerini yaziya cevirir ("₺₺ · kisi basi 300 TL" -> "Orta · kisi basi 300 TL").
// Rakamin yanindaki ₺ (ör. "250 ₺") para birimi oldugu icin "TL" olur.
export function fiyatYazi(s: string): string {
  return (s || '')
    .replace(/(\d)\s*₺/g, '$1 TL')
    .replace(/₺\s*(\d)/g, '$1 TL')
    .replace(/₺{3,}/g, 'Pahalı')
    .replace(/₺₺/g, 'Orta')
    .replace(/₺/g, 'Uygun')
}

// Mekanin fiyat seviyesi: once etiketten, yoksa fiyat metninden
export function fiyatSeviyesi(m: Pick<LzMekan, 'etiketler' | 'fiyat'>): string {
  const e = m.etiketler.find((x) => /^₺+$/.test(x.trim()))
  if (e) return FIYAT[e.trim()] ?? ''
  const f = (m.fiyat || '').match(/(?:^|[^\d\s])\s*(₺{1,4})(?!\s*\d)/)
  return f ? (FIYAT[f[1]] ?? '') : ''
}
