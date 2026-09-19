// AKUSTIK SES ANALIZI (cihazda, sinyal isleme; yapay zeka yok).
// Uzun "A" tutma sirasinda mikrofon cercevelerinden:
//  - F0 (perde, Hz): normalize otokorelasyonun 60-500 Hz araligindaki tepesi
//  - HNR (dB): Boersma yontemi, 10*log10(r / (1 - r)), r = tepe otokorelasyon
//  - jitter (%): ardisik periyot uzunluklari arasindaki ortalama fark / ortalama periyot
//  - shimmer (%): ardisik periyot tepe genlikleri arasindaki fark / ortalama genlik
// Periyotlar, F0 tahmininden yola cikarak cerceve icinde tepe-tepe izlenir.
//
// ONEMLI: Telefon mikrofonu klinik mikrofon degildir; sayilar MUTLAK degil,
// kisinin KENDI icindeki degisimi izlemek icin anlamlidir. Tani koymaz.

export interface AcousticFrame {
  f0: number // Hz (0 = bulunamadi)
  hnr: number // dB
  periods: number[] // ornek cinsinden ardisik periyotlar
  amps: number[] // ardisik periyot tepe genlikleri
}

export interface AcousticResult {
  f0: number // medyan perde (Hz)
  f0sd: number // perde dalgalanmasi (yarim ton, standart sapma)
  jitter: number // %
  shimmer: number // %
  hnr: number // dB (ortalama)
  frames: number // kullanilan cerceve sayisi
}

const F_MIN = 60
const F_MAX = 500

export function analyzeFrame(buf: Float32Array, sr: number): AcousticFrame | null {
  const n = buf.length
  // DC kaldir + Hann penceresi
  let mean = 0
  for (let i = 0; i < n; i++) mean += buf[i]
  mean /= n
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = (buf[i] - mean) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)))
  let r0 = 0
  for (let i = 0; i < n; i++) r0 += x[i] * x[i]
  if (r0 < 1e-6) return null
  const lagMin = Math.floor(sr / F_MAX)
  const lagMax = Math.min(Math.floor(sr / F_MIN), n - 2)
  let best = 0
  let bestLag = 0
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let r = 0
    for (let i = 0; i + lag < n; i++) r += x[i] * x[i + lag]
    // pencere nedeniyle azalan enerjiyi telafi et (Boersma: pencerenin kendi otokorelasyonuna bol)
    const norm = r / (r0 * (1 - lag / n))
    if (norm > best) {
      best = norm
      bestLag = lag
    }
  }
  if (best < 0.45 || bestLag === 0) return null // periyodik degil (gurultu/sessiz)
  // parabolik ince ayar
  let lagF = bestLag
  if (bestLag > lagMin && bestLag < lagMax) {
    const rl = corrAt(x, r0, bestLag - 1, n)
    const rr = corrAt(x, r0, bestLag + 1, n)
    const denom = rl - 2 * best + rr
    if (Math.abs(denom) > 1e-9) lagF = bestLag + (0.5 * (rl - rr)) / denom
  }
  const f0 = sr / lagF
  const rc = Math.min(best, 0.9999)
  const hnr = 10 * Math.log10(rc / (1 - rc))

  // Periyot izleme: her periyotta tepe konumu ve genligi. Harmonikler yuzunden
  // bir periyotta birden cok yerel tepe olur; once temel frekansa yakin bir
  // yumusatma (iki kez hareketli ortalama ~ ucgen pencere) uygulanir, tepeler
  // bu yumusatilmis sinyalde izlenir.
  const T = Math.round(lagF)
  const sm = smooth(smooth(buf, Math.max(2, Math.round(T / 3))), Math.max(2, Math.round(T / 3)))
  const periods: number[] = []
  const amps: number[] = []
  let pos = argmaxAbs(sm, 0, Math.min(T, n))
  let prevPos = pos
  let prevAmp = Math.abs(sm[pos])
  while (pos + T + T / 4 < n) {
    const c = pos + T
    const w = Math.max(1, Math.floor(T / 4))
    const p = argmaxAbs(sm, c - w, Math.min(n, c + w))
    const a = Math.abs(sm[p])
    if (a < 0.02 * (prevAmp + 1e-9) || a < 1e-4) break
    periods.push(p - prevPos)
    amps.push(a)
    prevPos = p
    prevAmp = a
    pos = p
  }
  return { f0, hnr, periods, amps }
}

function corrAt(x: Float32Array, r0: number, lag: number, n: number): number {
  let r = 0
  for (let i = 0; i + lag < n; i++) r += x[i] * x[i + lag]
  return r / (r0 * (1 - lag / n))
}

// Hareketli ortalama (pencere w), kenarlarda kisalan pencere
function smooth(b: Float32Array, w: number): Float32Array {
  const n = b.length
  const out = new Float32Array(n)
  let sum = 0
  let cnt = 0
  const half = Math.floor(w / 2)
  for (let i = 0; i < Math.min(n, half); i++) {
    sum += b[i]
    cnt++
  }
  for (let i = 0; i < n; i++) {
    const add = i + half
    const rem = i - half - 1
    if (add < n) {
      sum += b[add]
      cnt++
    }
    if (rem >= 0) {
      sum -= b[rem]
      cnt--
    }
    out[i] = sum / cnt
  }
  return out
}

function argmaxAbs(b: Float32Array, from: number, to: number): number {
  let bi = from
  let bv = -1
  for (let i = Math.max(0, from); i < to; i++) {
    const v = Math.abs(b[i])
    if (v > bv) {
      bv = v
      bi = i
    }
  }
  return bi
}

// Birden cok cerceveyi biriktirip ozet cikarir
export class AcousticAccumulator {
  private f0s: number[] = []
  private hnrs: number[] = []
  private jit: number[] = []
  private shim: number[] = []

  push(buf: Float32Array, sr: number): void {
    const f = analyzeFrame(buf, sr)
    if (!f) return
    this.f0s.push(f.f0)
    this.hnrs.push(f.hnr)
    if (f.periods.length >= 3) {
      let dp = 0
      let sp = 0
      for (let i = 1; i < f.periods.length; i++) dp += Math.abs(f.periods[i] - f.periods[i - 1])
      for (const p of f.periods) sp += p
      this.jit.push((dp / (f.periods.length - 1) / (sp / f.periods.length)) * 100)
      let da = 0
      let sa = 0
      for (let i = 1; i < f.amps.length; i++) da += Math.abs(f.amps[i] - f.amps[i - 1])
      for (const a of f.amps) sa += a
      this.shim.push((da / (f.amps.length - 1) / (sa / f.amps.length)) * 100)
    }
  }

  get count(): number {
    return this.f0s.length
  }

  result(): AcousticResult | null {
    if (this.f0s.length < 8) return null // ~0,3 sn'den az veri: guvenilmez
    const f0 = median(this.f0s)
    // yarim ton cinsinden sapma
    const st = this.f0s.map((v) => 12 * Math.log2(v / f0))
    const f0sd = Math.sqrt(st.reduce((a, b) => a + b * b, 0) / st.length)
    return {
      f0: Math.round(f0),
      f0sd: Math.round(f0sd * 10) / 10,
      jitter: Math.round(median(this.jit) * 100) / 100,
      shimmer: Math.round(median(this.shim) * 100) / 100,
      hnr: Math.round(mean(this.hnrs) * 10) / 10,
      frames: this.f0s.length
    }
  }
}

function median(a: number[]): number {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
function mean(a: number[]): number {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
}

// Sade dille yorum. Esikler yetiskin surekli sesli harf icin literaturdeki
// yaklasik degerler (Praat/MDVP): jitter < ~1 %, shimmer < ~3,8 %, HNR > ~20 dB
// "iyi" sayilir. Telefon mikrofonu nedeniyle YALNIZCA egilim icin.
export type Level3 = 'iyi' | 'orta' | 'zayif'

export function rateHnr(v: number): Level3 {
  return v >= 18 ? 'iyi' : v >= 12 ? 'orta' : 'zayif'
}
export function rateJitter(v: number): Level3 {
  return v <= 1.2 ? 'iyi' : v <= 2.5 ? 'orta' : 'zayif'
}
export function rateShimmer(v: number): Level3 {
  return v <= 4.5 ? 'iyi' : v <= 8 ? 'orta' : 'zayif'
}

export function acousticComment(r: AcousticResult): string {
  const parts: string[] = []
  const h = rateHnr(r.hnr)
  const j = rateJitter(r.jitter)
  const s = rateShimmer(r.shimmer)
  if (h === 'iyi' && j === 'iyi' && s === 'iyi') return 'Ses tok ve kararlı: hava kaçağı az, titreme düşük. Ses telleri verimli kapanıyor gibi görünüyor.'
  if (h !== 'iyi') parts.push(h === 'zayif' ? 'Ses nefesli/gürültülü (hava kaçağı fazla)' : 'Seste bir miktar nefeslilik var')
  if (s !== 'iyi') parts.push(s === 'zayif' ? 'ses şiddeti dalgalı' : 'şiddet hafif dalgalı')
  if (j !== 'iyi') parts.push(j === 'zayif' ? 'perde titrek' : 'perde hafif titrek')
  return parts.join('; ') + '. Düzenli egzersizle bu sayıların zamanla iyileşmesi beklenir; kendi geçmişinle karşılaştır.'
}
