// Tarih yardimcilari (yerel saat).
export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const g = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${g}`
}

const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

// "12 Eyl, 14:05" gibi kisa tarih
export function fmtShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${AYLAR[d.getMonth()]}, ${hh}:${mm}`
}

// "12 Eyl" gibi
export function fmtDay(key: string): string {
  const [y, m, g] = key.split('-').map(Number)
  if (!y || !m || !g) return key
  return `${g} ${AYLAR[m - 1]}`
}

export function fmtMinutes(ms: number): string {
  const dk = Math.round(ms / 60000)
  if (dk < 1) return '1 dk altı'
  return `${dk} dk`
}

export function fmtSec(s: number): string {
  return `${s.toFixed(1).replace('.', ',')} sn`
}
