// Diyet serisi (streak), istatistikler ve rozet hesaplamalari.
import type { DietEntry } from './types'

// Yerel tarihi YYYY-MM-DD olarak verir (en-CA formati bu kaliba uyar)
export function todayStr(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA')
}

// Iki YYYY-MM-DD tarihi arasindaki tam gun farki
function daysBetween(aStr: string, bStr: string): number {
  const a = new Date(aStr + 'T00:00:00')
  const b = new Date(bStr + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

// "Diyet bozuldu" sayilan kayit: saglıksiz bir yemegi yine de yemek
export function isBreak(e: DietEntry): boolean {
  return e.decision === 'ate' && !e.healthy
}

export interface DietStats {
  streak: number // En son diyet bozulmasindan bu yana gecen gun
  lastBreakDate: string | null // Son bozulma tarihi
  totalResisted: number // Toplam kac kez vazgecildi
  totalAte: number // Toplam kac kez yenildi
  brokeCount: number // Toplam diyet bozma sayisi
  totalEntries: number
}

// Tum kayitlardan istatistikleri hesaplar
export function computeStats(entries: DietEntry[]): DietStats {
  const today = todayStr()
  let lastBreakDate: string | null = null
  let totalResisted = 0
  let totalAte = 0
  let brokeCount = 0
  let firstDate: string | null = null

  for (const e of entries) {
    if (!firstDate || e.dateStr < firstDate) firstDate = e.dateStr
    if (e.decision === 'resisted') totalResisted++
    if (e.decision === 'ate') totalAte++
    if (isBreak(e)) {
      brokeCount++
      if (!lastBreakDate || e.dateStr > lastBreakDate) lastBreakDate = e.dateStr
    }
  }

  // Seri: son bozulmadan bu yana gecen tam gun (bozulma gunu sifir sayilir).
  // Hic bozulma yoksa ilk kayittan bugune kadarki gun sayisi.
  let streak = 0
  if (lastBreakDate) {
    streak = Math.max(0, daysBetween(lastBreakDate, today))
  } else if (firstDate) {
    streak = Math.max(0, daysBetween(firstDate, today)) + 1
  }

  return {
    streak,
    lastBreakDate,
    totalResisted,
    totalAte,
    brokeCount,
    totalEntries: entries.length
  }
}

export interface Badge {
  days: number
  emoji: string
  name: string
  desc: string
}

// Seri gunlerine gore acilan rozetler
export const BADGES: Badge[] = [
  { days: 1, emoji: '🌱', name: 'Başlangıç', desc: 'İlk gününü tamamladın' },
  { days: 3, emoji: '🔥', name: '3 Gün', desc: '3 gündür dayanıyorsun' },
  { days: 7, emoji: '⭐', name: '1 Hafta', desc: 'Bir haftayı devirdin' },
  { days: 14, emoji: '💪', name: '2 Hafta', desc: 'İrade çelikleşiyor' },
  { days: 30, emoji: '🏆', name: '1 Ay', desc: 'Koca bir ay!' },
  { days: 60, emoji: '👑', name: '2 Ay', desc: 'Artık bir alışkanlık' },
  { days: 100, emoji: '💎', name: '100 Gün', desc: 'Efsane seviye' },
  { days: 365, emoji: '🦾', name: '1 Yıl', desc: 'Bir yaşam tarzı' }
]

// Bir seri uzunluguna gore acilan ve henuz acilmayan rozetler
export function badgesForStreak(streak: number): { earned: Badge[]; locked: Badge[] } {
  const earned = BADGES.filter((b) => streak >= b.days)
  const locked = BADGES.filter((b) => streak < b.days)
  return { earned, locked }
}
