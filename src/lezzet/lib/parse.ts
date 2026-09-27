// YAPAY ZEKASIZ METIN AYRISTIRMA.
//
// Instagram/TikTok aciklamalari genelde soyle yazilir:
//   Fırında Köfte 😋
//   Malzemeler:
//   - 500 gr kıyma
//   - 1 soğan
//   Yapılışı:
//   1. Kıymayı yoğurun...
//   #köfte #tarif
// Bu islev "Malzemeler / Yapılışı" basliklarini, madde isaretlerini ve
// miktarla baslayan satirlari kullanarak kaba bir ayirma yapar. Yapay zeka
// anahtari yoksa ya da cevrimdisiyken bu kullanilir; sonuc duzenlenebilir.
import type { LzDraft } from '../types'

const MALZ_BASLIK = /^(malzeme(ler)?|ingredients?|gerekenler|neler lazım|içindekiler)(?!\p{L})/iu
const ADIM_BASLIK = /^(yapılış(ı)?|hazırlanış(ı)?|yapımı|tarif(i)?|nasıl yapılır|instructions?|directions?|method)(?!\p{L})/iu
const OLCU =
  /^(\d|[½¼¾⅓⅔]|yarım|bir |iki |üç |dört |beş |birkaç|bir tutam|1\/2|\d+\/\d+)|(?<!\p{L})(gr|g|kg|ml|lt|litre|adet|su bardağı|çay bardağı|yemek kaşığı|tatlı kaşığı|çay kaşığı|kahve fincanı|paket|diş|demet|tutam|dilim|avuç|kase)(?!\p{L})/iu

function temizle(s: string): string {
  return s
    .replace(/^[\s•●▪️◾◽▫️*·➡️👉✔️✅☑️🔸🔹-]+/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function adimNo(s: string): boolean {
  return /^\s*(\d+[.)-]|\d+️⃣|[①-⑳]|adım\s*\d+)/iu.test(s)
}

export function metniAyristir(metin: string): Partial<LzDraft> {
  const satirlar = metin
    .replace(/\r/g, '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !/^(#\S+\s*)+$/.test(s)) // yalnizca hashtag olan satirlar

  let bolum: 'bas' | 'malz' | 'adim' = 'bas'
  const bas: string[] = []
  const malz: string[] = []
  const adim: string[] = []

  for (const ham of satirlar) {
    const s = temizle(ham)
    if (!s) continue
    const baslikSiz = s.replace(/[:：\s]+$/, '')
    if (MALZ_BASLIK.test(baslikSiz) && baslikSiz.length < 40) {
      bolum = 'malz'
      const kalan = s.split(/[:：]/).slice(1).join(':').trim()
      if (kalan) malz.push(...kalan.split(/,\s*/))
      continue
    }
    // "Tarifi çok kolay…" gibi cumleler baslik sanilmasin: iki nokta ya da kisa satir sart
    if (ADIM_BASLIK.test(baslikSiz) && (/[:：]\s*$/.test(s) || baslikSiz.length < 20)) {
      bolum = 'adim'
      const kalan = s.split(/[:：]/).slice(1).join(':').trim()
      if (kalan) adim.push(kalan)
      continue
    }
    if (bolum === 'malz') {
      // Malzeme bolumunde uzun, cumle gibi numarali satir -> adimlar basladi
      if (adimNo(ham) && s.length > 45) {
        bolum = 'adim'
        adim.push(s.replace(/^\d+[.)-]\s*/, ''))
      } else malz.push(s)
      continue
    }
    if (bolum === 'adim') {
      adim.push(s.replace(/^(\d+[.)-]|\d+️⃣|adım\s*\d+[:.]?)\s*/iu, ''))
      continue
    }
    bas.push(s)
  }

  // Baslik yoksa: miktarla baslayan kisa satirlar malzeme, numarali/uzun satirlar adim.
  if (!malz.length && !adim.length) {
    for (const s of bas.slice(1)) {
      if (OLCU.test(s) && s.length <= 60) malz.push(s)
      else if (adimNo(s) || s.length > 60) adim.push(s.replace(/^\d+[.)-]\s*/, ''))
    }
  }

  const baslik = (bas[0] ?? '').replace(/[#@]\S+/g, '').replace(/[^\p{L}\p{N}\s'’&,-]/gu, '').trim()
  const dk = metin.match(/(\d+)\s*(dk|dakika|min)/i)
  const kisi = metin.match(/(\d+)\s*(kişilik|kişi|porsiyon)/i)

  return {
    title: baslik.slice(0, 70),
    ingredients: malz.map((s) => s.replace(/[.;]$/, '')).filter((s) => s.length > 1),
    steps: adim.filter((s) => s.length > 2),
    minutes: dk ? Number(dk[1]) : 0,
    servings: kisi ? Number(kisi[1]) : 0,
    tags: []
  }
}
