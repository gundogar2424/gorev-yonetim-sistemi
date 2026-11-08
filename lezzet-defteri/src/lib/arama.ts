// BULANIK ARAMA: Turkce harf farklarini (ş/s, ç/c, ı/i, ğ/g, ö/o, ü/u) ve kucuk yazim
// hatalarini (bir harf eksik/fazla/yanlis/yer degismis) tolere eder; Google gibi.
//  - Sorgu kelimelere bolunur; her kelime metindeki bir kelimeyle eslesmeli
//  - Eslesme: metin kelimesi sorguyla basliyorsa, iceriyorsa ya da yazim uzakligi kucukse
//    (4-7 harfte 1 hata, 8+ harfte 2 hata; 3 harf ve altinda tam eslesme)

export function sade(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[ışİ]/g, (c) => ({ ı: 'i', ş: 's', İ: 'i' })[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // aksanlar (ç->c, ğ->g, ö->o, ü->u, â->a)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Damerau-Levenshtein (yer degistirme dahil), ust sinirla erken cikis
function uzaklik(a: string, b: string, enFazla: number): number {
  if (Math.abs(a.length - b.length) > enFazla) return enFazla + 1
  const m = a.length
  const n = b.length
  let onceki2: number[] = []
  let onceki: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const simdiki = [i]
    let satirEnAz = i
    for (let j = 1; j <= n; j++) {
      const maliyet = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(onceki[j] + 1, simdiki[j - 1] + 1, onceki[j - 1] + maliyet)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, onceki2[j - 2] + 1)
      simdiki[j] = v
      if (v < satirEnAz) satirEnAz = v
    }
    if (satirEnAz > enFazla) return enFazla + 1
    onceki2 = onceki
    onceki = simdiki
  }
  return onceki[n]
}

function izin(uzunluk: number): number {
  return uzunluk >= 8 ? 2 : uzunluk >= 4 ? 1 : 0
}

// Sorgu kelimesi metin kelimesine uyuyor mu
function kelimeUyar(sorgu: string, kelime: string): boolean {
  if (kelime.startsWith(sorgu) || (sorgu.length >= 4 && kelime.includes(sorgu))) return true
  const t = izin(sorgu.length)
  if (!t) return false
  // Tam kelime ya da kelimenin sorgu uzunlugundaki basi (ekleri olan Turkce kelimeler: "kofteci" ~ "kofte")
  if (uzaklik(sorgu, kelime, t) <= t) return true
  return kelime.length > sorgu.length && uzaklik(sorgu, kelime.slice(0, sorgu.length + 1), t) <= t
}

// Metin sorguya uyuyor mu (tum sorgu kelimeleri bulunmali)
export function esles(sorgu: string, metin: string): boolean {
  const s = sade(sorgu)
  if (!s) return true
  const m = sade(metin)
  if (m.includes(s)) return true
  const kelimeler = m.split(' ')
  return s.split(' ').every((q) => kelimeler.some((k) => kelimeUyar(q, k)))
}

// Siralama icin uyum puani: tam eslesme > kelime basi > bulanik
export function uyumPuani(sorgu: string, metin: string): number {
  const s = sade(sorgu)
  const m = sade(metin)
  if (!s) return 0
  if (m === s) return 4
  if (m.startsWith(s)) return 3
  if (m.includes(s)) return 2
  return esles(sorgu, metin) ? 1 : 0
}
