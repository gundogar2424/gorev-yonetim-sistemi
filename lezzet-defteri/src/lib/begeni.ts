// BEGENI PUANI: tarifin paylasimi sosyal medyada ne kadar ilgi gormus (1-10).
// Sayfanin kendisinden begeni / yorum / izlenme sayilari okunur; yapay zeka kullanilmaz.
// Yorumlarin olumlu mu olumsuz mu oldugu okunamaz (giris gerektiriyor), yalnizca sayilar.
import { lzDb } from '../db'
import type { LzEtkilesim, LzRecipe } from '../types'
import { UA_BOT, UA_MOBIL, metinIndir } from './importer'

// "12,3K" "1.234" "1,2 Mn" "12 B" -> sayi
function sayi(s: string | undefined): number {
  if (!s) return 0
  const m = s.trim().match(/^([\d.,]+)\s*(k|b|bin|m|mn|milyon)?/i)
  if (!m) return 0
  let n = m[1]
  const kat = /^(k|b|bin)$/i.test(m[2] ?? '') ? 1e3 : /^(m|mn|milyon)$/i.test(m[2] ?? '') ? 1e6 : 1
  // Kisaltmali sayida virgul/nokta ondaliktir; duz sayida binlik ayiricidir
  n = kat > 1 ? n.replace(',', '.') : n.replace(/[.,]/g, '')
  return Math.round(parseFloat(n) * kat) || 0
}

export function etkilesimCikar(html: string): { begeni: number; yorum: number; izlenme: number } {
  const h = html.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
  const ilk = (...re: RegExp[]) => {
    for (const r of re) {
      const m = h.match(r)
      if (m) return sayi(m[1])
    }
    return 0
  }
  return {
    begeni: ilk(
      /"diggCount":(\d+)/,
      /([\d.,]+\s*[KMB]?)\s+likes?\b/i,
      /([\d.,]+\s*(?:B|bin|Mn|milyon)?)\s+beğen(?:me|i)/i,
      /along with ([\d,.]+) other/i,
      /([\d.,]+) kişi(?:yle birlikte)? bu videoyu beğen/i,
      /"likeCount":"?(\d+)/
    ),
    yorum: ilk(/"commentCount":"?(\d+)/, /([\d.,]+\s*[KMB]?)\s+comments?\b/i, /([\d.,]+\s*(?:B|bin|Mn)?)\s+yorum/i),
    izlenme: ilk(/"playCount":(\d+)/, /"viewCount":"(\d+)"/, /([\d.,]+\s*[KMB]?)\s+views?\b/i, /([\d.,]+\s*(?:B|bin|Mn)?)\s+görüntülenme/i)
  }
}

// Begeni sayisina gore logaritmik puan: 100 -> 3, 1 bin -> 5, 10 bin -> 7, 100 bin -> 9, 300 bin+ -> 10.
// Begeni yoksa izlenmeden tahmin (izlenmelerin ~%4'u begenir). Yorum orani yuksekse +1.
export function puanHesapla(e: { begeni: number; yorum: number; izlenme: number }): number {
  const b = e.begeni || Math.round(e.izlenme * 0.04)
  if (b <= 0) return 0
  let p = 2 * Math.log10(b) - 1
  if (e.yorum && e.begeni && e.yorum / e.begeni >= 0.02) p += 1
  return Math.max(1, Math.min(10, Math.round(p)))
}

// Tarifin paylasim sayfasindan sayilari okuyup kaydeder
export async function etkilesimGetir(r: LzRecipe): Promise<LzEtkilesim | undefined> {
  if (!r.id || !/^https?:\/\//.test(r.sourceUrl)) return undefined
  let sonuc = { begeni: 0, yorum: 0, izlenme: 0 }
  for (const ua of [UA_BOT, UA_MOBIL]) {
    try {
      const e = etkilesimCikar(await metinIndir(r.sourceUrl, ua))
      if (e.begeni || e.izlenme) {
        sonuc = e
        break
      }
    } catch {
      /* sonraki kimlik */
    }
  }
  const et: LzEtkilesim = { ...sonuc, puan: puanHesapla(sonuc), zaman: Date.now() }
  await lzDb.recipes.update(r.id, { etkilesim: et })
  return et
}

// Okunmamis (ya da 30 gunden eski) mi
export function etkilesimEski(r: LzRecipe): boolean {
  if (!/^https?:\/\//.test(r.sourceUrl) || !['instagram', 'tiktok', 'youtube'].includes(r.platform)) return false
  return !r.etkilesim || Date.now() - r.etkilesim.zaman > 30 * 86400000
}

export function kisaSayi(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.0', '').replace('.', ',')} Mn`
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.0', '').replace('.', ',')} bin`
  return String(n)
}
