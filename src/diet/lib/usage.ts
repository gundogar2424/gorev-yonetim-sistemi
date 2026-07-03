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

// Opus fiyatiyla KABA maliyet tahmini (USD). Model degisirse yaklasik olur.
const PRICE_IN_PER_M = 15 // $/1M input token (Opus)
const PRICE_OUT_PER_M = 75 // $/1M output token (Opus)

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

// Kaba maliyet tahmini (USD) — Opus fiyatiyla; net fatura icin Console'a bak.
export function estimateCostUsd(b: UsageBucket): number {
  return (b.in / 1_000_000) * PRICE_IN_PER_M + (b.out / 1_000_000) * PRICE_OUT_PER_M
}

export function todayUsage(): UsageBucket {
  return getUsage().days[todayKey()] ?? empty()
}
