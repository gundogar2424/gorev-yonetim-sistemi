// TM7'nin (Thermomix TM7) adim dili: devir, sicaklik ve ozel modlar.
// Hem adim duzenleyicideki secim listeleri hem de ekranda gosterilen
// "10 sn / devir 5" gibi ozetler buradan uretilir.
import type { TmMode, TmRecipe, TmSpeed, TmStep } from '../types'

// --- Devir ----------------------------------------------------------------
export const SPEEDS: { value: TmSpeed; label: string }[] = [
  { value: '', label: 'Devir yok' },
  { value: 'yumusak', label: 'Yumuşak karıştırma' },
  { value: '0.5', label: 'Devir 0.5' },
  { value: '1', label: 'Devir 1' },
  { value: '2', label: 'Devir 2' },
  { value: '3', label: 'Devir 3' },
  { value: '4', label: 'Devir 4' },
  { value: '5', label: 'Devir 5' },
  { value: '6', label: 'Devir 6' },
  { value: '7', label: 'Devir 7' },
  { value: '8', label: 'Devir 8' },
  { value: '9', label: 'Devir 9' },
  { value: '10', label: 'Devir 10' },
  { value: 'turbo', label: 'Turbo' }
]

// --- Sicaklik -------------------------------------------------------------
// TM7'de 37 °C'den 160 °C'ye kadar; Varoma buhar kademesidir.
export const TEMPS: { value: string; label: string }[] = [
  { value: '', label: 'Isıtma yok' },
  { value: '37', label: '37 °C' },
  { value: '50', label: '50 °C' },
  { value: '60', label: '60 °C' },
  { value: '70', label: '70 °C' },
  { value: '80', label: '80 °C' },
  { value: '90', label: '90 °C' },
  { value: '95', label: '95 °C' },
  { value: '100', label: '100 °C' },
  { value: 'varoma', label: 'Varoma (buhar)' },
  { value: '130', label: '130 °C' },
  { value: '140', label: '140 °C' },
  { value: '150', label: '150 °C' },
  { value: '160', label: '160 °C' }
]

// --- Ozel modlar ----------------------------------------------------------
export const MODES: { value: TmMode; label: string }[] = [
  { value: '', label: 'Normal' },
  { value: 'sote', label: 'Sote / kavurma' },
  { value: 'hamur', label: 'Hamur yoğurma' },
  { value: 'buhar', label: 'Varoma’da buharda pişirme' },
  { value: 'yavas', label: 'Yavaş pişirme' },
  { value: 'sousvide', label: 'Sous-vide' },
  { value: 'ferment', label: 'Fermente / mayalama' },
  { value: 'pirinc', label: 'Pirinç modu' },
  { value: 'blender', label: 'Blender / smoothie' },
  { value: 'tartim', label: 'Tartım (dara)' },
  { value: 'temizlik', label: 'Temizlik' }
]

export const CATEGORIES = [
  'Çorba',
  'Ana Yemek',
  'Meze & Salata',
  'Sos',
  'Hamur İşi',
  'Tatlı',
  'İçecek',
  'Kahvaltı',
  'Diğer'
]

export function speedLabel(s: TmSpeed): string {
  return SPEEDS.find((x) => x.value === s)?.label ?? ''
}

export function tempLabel(t: string): string {
  if (!t) return ''
  if (t === 'varoma') return 'Varoma'
  return `${t} °C`
}

export function modeLabel(m: TmMode): string {
  return MODES.find((x) => x.value === m)?.label ?? ''
}

// "2 dk 30 sn" / "45 sn" / "1 sa 20 dk"
export function durationLabel(seconds: number): string {
  if (!seconds || seconds <= 0) return ''
  if (seconds < 60) return `${seconds} sn`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (h) parts.push(`${h} sa`)
  if (m) parts.push(`${m} dk`)
  if (s) parts.push(`${s} sn`)
  return parts.join(' ')
}

// Bir adimin cihaz ayarlarini tek satirda ozetler:
// "20 sn · Varoma · devir 2 · ters yön"
export function stepSummary(step: TmStep): string {
  const bits: string[] = []
  const d = durationLabel(step.seconds)
  if (d) bits.push(d)
  const t = tempLabel(step.temp)
  if (t) bits.push(t)
  if (step.speed) bits.push(speedLabel(step.speed).replace('Devir', 'devir'))
  if (step.reverse) bits.push('ters yön')
  if (step.mode) bits.push(modeLabel(step.mode))
  return bits.join(' · ')
}

// Tarifi duz metne cevirir (paylas / kopyala icin)
export function recipeToText(r: TmRecipe): string {
  const lines: string[] = []
  lines.push(r.title)
  const meta = [r.servings ? `${r.servings} kişilik` : '', r.minutes ? `${r.minutes} dk` : '', r.category]
    .filter(Boolean)
    .join(' · ')
  if (meta) lines.push(meta)
  lines.push('')
  lines.push('MALZEMELER')
  r.ingredients.forEach((i) => lines.push(`- ${i}`))
  lines.push('')
  lines.push('TM7 ADIMLARI')
  r.steps.forEach((s, i) => {
    const sum = stepSummary(s)
    lines.push(`${i + 1}. ${s.text}${sum ? `  [${sum}]` : ''}`)
    if (s.ingredients) lines.push(`   Kaba gir: ${s.ingredients}`)
    if (s.tip) lines.push(`   İpucu: ${s.tip}`)
  })
  if (r.warnings.length) {
    lines.push('')
    lines.push('DİKKAT')
    r.warnings.forEach((w) => lines.push(`- ${w}`))
  }
  if (r.notes) {
    lines.push('')
    lines.push(`Not: ${r.notes}`)
  }
  if (r.source) {
    lines.push('')
    lines.push(`Kaynak: ${r.source}`)
  }
  return lines.join('\n')
}

// Bos bir adim (elle ekleme icin)
export function emptyStep(): TmStep {
  return { text: '', ingredients: '', seconds: 0, speed: '', reverse: false, temp: '', mode: '', tip: '' }
}
