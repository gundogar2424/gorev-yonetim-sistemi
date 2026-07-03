// Uygulama ici TOKEN kullanim sayaci. Anthropic her cevapta harcanan token'i
// (input/output) bildirir; bunu cihazda (localStorage) biriktirip Ayarlar'da
// gosteririz. Kalan BAKIYE degil (onu API vermez) — sadece bu cihazdaki
// uygulamanin ne kadar token harcadigidir. Token/maliyet harcamaz.

const KEY = 'diet-usage'

export interface UsageBucket {
  in: number // input (girdi) token
  out: number // output (cikti) token
  calls: number // islem sayisi
}
export interface UsageData {
  total: UsageBucket
  days: Record<string, UsageBucket> // 'YYYY-MM-DD' -> bucket
}

// Model ailesine gore KABA fiyat ($/1M token). Net fatura icin Console.
const PRICING: Record<'opus' | 'sonnet' | 'haiku', { in: number; out: number }> = {
  opus: { in: 15, out: 75 },
  sonnet: { in: 3, out: 15 },
  haiku: { in: 1, out: 5 }
}

// Model adindan fiyat ailesini sec (bilinmiyorsa Opus — ust sinir)
function priceFor(model?: string): { in: number; out: number } {
  const m = (model || '').toLowerCase()
  if (m.includes('haiku')) return PRICING.haiku
  if (m.includes('sonnet')) return PRICING.sonnet
  return PRICING.opus
}

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD (yerel)
}

function empty(): UsageBucket {
  return { in: 0, out: 0, calls: 0 }
}

export function getUsage(): UsageData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const u = JSON.parse(raw) as UsageData
      if (u && u.total && u.days) return u
    }
  } catch {
    /* bozuk kayit — sifirdan basla */
  }
  return { total: empty(), days: {} }
}

// Bir AI cevabindan gelen token'i ekle (senkron; localStorage).
export function recordUsage(inTok: number, outTok: number): void {
  try {
    const u = getUsage()
    const d = todayKey()
    const day = u.days[d] ?? empty()
    day.in += inTok || 0
    day.out += outTok || 0
    day.calls += 1
    u.days[d] = day
    u.total.in += inTok || 0
    u.total.out += outTok || 0
    u.total.calls += 1
    // Son 60 gunu tut (localStorage sismesin)
    const keys = Object.keys(u.days).sort()
    if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete u.days[k]
    localStorage.setItem(KEY, JSON.stringify(u))
  } catch {
    /* yazilamadi — yok say */
  }
}

export function resetUsage(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* yok say */
  }
}

export function bucketTokens(b: UsageBucket): number {
  return b.in + b.out
}

// Kaba maliyet tahmini (USD) — secili modelin fiyatiyla; net fatura Console.
export function estimateCostUsd(b: UsageBucket, model?: string): number {
  const p = priceFor(model)
  return (b.in / 1_000_000) * p.in + (b.out / 1_000_000) * p.out
}

export function todayUsage(): UsageBucket {
  return getUsage().days[todayKey()] ?? empty()
}
