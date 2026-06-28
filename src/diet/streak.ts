// Diyet serisi (streak), istatistikler ve rozet hesaplamalari.
import type { DietEntry, Exercise, Water, Measurement, Steps } from './types'

// Bir egzersiz kaydinin kazandirdigi puan: 8 taban + her 15 dk icin +2 (en cok +12)
export function exercisePoints(ex: Exercise): number {
  const bonus = Math.min(12, Math.floor((ex.minutes ?? 0) / 15) * 2)
  return 8 + bonus
}

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
  points: number // Toplam puan (vazgecis +10, saglikli yeme +5, egzersiz +8 ve uzeri)
  exerciseCount: number // Toplam egzersiz kaydi
  exerciseMinutes: number // Toplam egzersiz dakikasi
}

// Tum kayitlardan istatistikleri hesaplar (egzersizler de puana eklenir)
export function computeStats(entries: DietEntry[], exercises: Exercise[] = []): DietStats {
  const today = todayStr()
  let lastBreakDate: string | null = null
  let totalResisted = 0
  let totalAte = 0
  let brokeCount = 0
  let firstDate: string | null = null

  let points = 0
  for (const e of entries) {
    if (!firstDate || e.dateStr < firstDate) firstDate = e.dateStr
    if (e.decision === 'resisted') {
      totalResisted++
      points += 10 // vazgecmek en degerli
    }
    if (e.decision === 'ate') {
      totalAte++
      if (e.healthy) points += 5 // saglikli yemek de iyidir
    }
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

  // Egzersiz puanlari ve toplamlari
  let exerciseMinutes = 0
  for (const ex of exercises) {
    points += exercisePoints(ex)
    exerciseMinutes += ex.minutes ?? 0
  }

  return {
    streak,
    lastBreakDate,
    totalResisted,
    totalAte,
    brokeCount,
    totalEntries: entries.length,
    points,
    exerciseCount: exercises.length,
    exerciseMinutes
  }
}

// Son N gunun (bugun dahil) ozet istatistikleri — haftalik rapor icin.
export interface WeeklySummary {
  days: number
  resisted: number
  ate: number
  broke: number
  points: number // Bu donemde kazanilan puan (yemek + egzersiz)
  exerciseCount: number
  exerciseMinutes: number
  waterTotal: number // Toplam bardak
  waterAvg: number // Gunluk ortalama bardak
  stepsTotal: number // Toplam adim
  stepsAvg: number // Gunluk ortalama adim
  kcalAte: number // Yenen ogunlerin toplam tahmini kalorisi
  weightChange: number | null // Donem ici kilo degisimi (kg), yoksa null
}

export function computeWeekly(
  entries: DietEntry[],
  exercises: Exercise[],
  waters: Water[],
  measurements: Measurement[] = [],
  steps: Steps[] = [],
  days = 7
): WeeklySummary {
  // Donemin baslangic tarihi (bugun dahil son `days` gun)
  const start = todayStr(new Date(Date.now() - (days - 1) * 86_400_000))
  const inRange = (d: string) => d >= start

  let resisted = 0
  let ate = 0
  let broke = 0
  let points = 0
  let kcalAte = 0
  for (const e of entries) {
    if (!inRange(e.dateStr)) continue
    if (e.decision === 'resisted') {
      resisted++
      points += 10
    }
    if (e.decision === 'ate') {
      ate++
      kcalAte += e.estimatedCalories || 0
      if (e.healthy) points += 5
    }
    if (isBreak(e)) broke++
  }

  let exerciseCount = 0
  let exerciseMinutes = 0
  for (const ex of exercises) {
    if (!inRange(ex.dateStr)) continue
    exerciseCount++
    exerciseMinutes += ex.minutes ?? 0
    points += exercisePoints(ex)
  }

  let waterTotal = 0
  for (const w of waters) {
    if (inRange(w.dateStr)) waterTotal += w.glasses
  }

  let stepsTotal = 0
  for (const st of steps) {
    if (inRange(st.dateStr)) stepsTotal += st.count
  }

  // Donem ici kilo degisimi: aralikta tartilan ilk ve son kilo arasindaki fark
  const weights = measurements
    .filter((m) => inRange(m.dateStr) && m.weight != null)
    .sort((a, b) => a.createdAt - b.createdAt)
  const weightChange =
    weights.length >= 2 ? Math.round((weights[weights.length - 1].weight! - weights[0].weight!) * 10) / 10 : null

  return {
    days,
    resisted,
    ate,
    broke,
    points,
    exerciseCount,
    exerciseMinutes,
    waterTotal,
    waterAvg: Math.round((waterTotal / days) * 10) / 10,
    stepsTotal,
    stepsAvg: Math.round(stepsTotal / days),
    kcalAte,
    weightChange
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

// Egzersiz rozeti: belli sayida egzersiz kaydina ulasinca acilir
export interface ExerciseBadge {
  count: number // Gereken egzersiz sayisi
  emoji: string
  name: string
  desc: string
}

export const EXERCISE_BADGES: ExerciseBadge[] = [
  { count: 1, emoji: '👟', name: 'İlk Adım', desc: 'İlk egzersizini kaydettin' },
  { count: 5, emoji: '🚶', name: 'Hareketli', desc: '5 egzersiz tamamladın' },
  { count: 10, emoji: '🏃', name: 'Koşar Adım', desc: '10 egzersiz oldu' },
  { count: 25, emoji: '🚴', name: 'Azimli', desc: '25 egzersiz — süper!' },
  { count: 50, emoji: '🏋️', name: 'Demir İrade', desc: '50 egzersiz devirdin' },
  { count: 100, emoji: '🥇', name: 'Şampiyon', desc: '100 egzersiz — efsane!' }
]

// Toplam egzersiz sayisina gore acilan/acilmayan egzersiz rozetleri
export function exerciseBadges(count: number): { earned: ExerciseBadge[]; locked: ExerciseBadge[] } {
  const earned = EXERCISE_BADGES.filter((b) => count >= b.count)
  const locked = EXERCISE_BADGES.filter((b) => count < b.count)
  return { earned, locked }
}
