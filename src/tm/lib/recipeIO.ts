// Tarif "kodu" (JSON) okuma/yazma.
//
// Neden var: uyarlamayi yapay zekaya yaptirmak API anahtari ve internet
// gerektiriyor. Kullanici tarifi baska bir yerde (orn. sohbette) uyarlatip
// sonucu buraya YAPISTIRARAK da ekleyebilsin diye, tarifleri tek bir JSON
// metninden okuyan ortak bir cozumleyici tutuyoruz. Ayni normalize islevi
// yapay zeka yanitinda da kullanilir; boylece iki yol da ayni kurallardan gecer.
import type { TmConversion, TmStep } from '../types'

// Modelden ya da yapistirilan metinden gelen nesneyi guvene al:
// eksik alanlari doldur, tipleri duzelt, bos adimlari at.
export function normalizeConversion(p: Partial<TmConversion>): TmConversion {
  const steps: TmStep[] = Array.isArray(p.steps)
    ? p.steps.map((s) => ({
        text: String(s?.text ?? '').trim(),
        ingredients: String(s?.ingredients ?? '').trim(),
        seconds: Number.isFinite(s?.seconds) ? Math.max(0, Math.round(Number(s.seconds))) : 0,
        speed: (s?.speed ?? '') as TmStep['speed'],
        reverse: !!s?.reverse,
        temp: String(s?.temp ?? '').trim(),
        mode: (s?.mode ?? '') as TmStep['mode'],
        tip: String(s?.tip ?? '').trim()
      }))
    : []
  return {
    title: String(p.title ?? '').trim() || 'Adsız tarif',
    category: String(p.category ?? '').trim() || 'Diğer',
    servings: Number.isFinite(p.servings) ? Number(p.servings) : 0,
    minutes: Number.isFinite(p.minutes) ? Number(p.minutes) : 0,
    ingredients: Array.isArray(p.ingredients) ? p.ingredients.map((i) => String(i).trim()).filter(Boolean) : [],
    steps: steps.filter((s) => s.text),
    notes: String(p.notes ?? '').trim(),
    warnings: Array.isArray(p.warnings) ? p.warnings.map((w) => String(w).trim()).filter(Boolean) : []
  }
}

export interface ParsedRecipe {
  recipe: TmConversion
  source: string // Kod icinde "source" yazdiysa onu tasi
}

// Yapistirilan metinden tarif(leri) cikar. Uc bicim de kabul edilir:
//   1) tek tarif nesnesi           -> { "title": ..., "steps": [...] }
//   2) tarif dizisi                -> [ {...}, {...} ]
//   3) yedek dosyasinin govdesi    -> { "app": "termomiks-defter", "recipes": [...] }
// Metnin basinda/sonunda ```json cerceveleri ya da aciklama satirlari olabilir;
// ilk '{' / '[' ile son '}' / ']' arasi alinarak temizlenir.
export function parseRecipeCode(raw: string): ParsedRecipe[] {
  const text = raw.trim()
  if (!text) throw new Error('Önce tarif kodunu yapıştır.')

  const cleaned = kirp(text)
  let data: unknown
  try {
    data = JSON.parse(cleaned)
  } catch {
    throw new Error(
      'Kod okunamadı. Tarif kodunun tamamını (baştaki { ya da [ ile sondaki } ya da ] dahil) yapıştırdığından emin ol.'
    )
  }

  const ham = ayikla(data)
  if (ham.length === 0) throw new Error('Kodun içinde tarif bulunamadı.')

  const sonuc = ham.map((r) => ({
    recipe: normalizeConversion(r),
    source: String((r as { source?: unknown }).source ?? '').trim()
  }))
  const bosOlan = sonuc.find((s) => s.recipe.steps.length === 0)
  if (bosOlan) throw new Error(`"${bosOlan.recipe.title}" tarifinde hiç adım yok. Kod eksik olabilir.`)
  return sonuc
}

// Metnin icindeki JSON govdesini bul (```json cercevesi, aciklama satiri vb. atilir)
function kirp(text: string): string {
  const fence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const ilkObje = fence.indexOf('{')
  const ilkDizi = fence.indexOf('[')
  const bas =
    ilkObje === -1 ? ilkDizi : ilkDizi === -1 ? ilkObje : Math.min(ilkObje, ilkDizi)
  if (bas === -1) return fence
  const son = Math.max(fence.lastIndexOf('}'), fence.lastIndexOf(']'))
  return son > bas ? fence.slice(bas, son + 1) : fence.slice(bas)
}

// Uc bicimden hangisi gelirse gelsin tarif nesnelerinin dizisini dondur
function ayikla(data: unknown): Partial<TmConversion>[] {
  if (Array.isArray(data)) return data as Partial<TmConversion>[]
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    if (Array.isArray(o.recipes)) return o.recipes as Partial<TmConversion>[]
    if (o.title || o.steps) return [o as Partial<TmConversion>]
  }
  return []
}
