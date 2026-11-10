import { gorselKaydet } from '../gorsel/servis'
import type { VegaUrun } from '../vega/sorgular'
import { firmaOku, firmaYaz } from '../teklif/db'
import { db, stoklariUygula, urunleriUygula } from './db'

/** DEMO=1 için örnek veri: Vega bağlantısı olmadan arayüzü denemeye yarar. */
const CESITLER: [ad: string, kategori: string, markalar: string[], olculer: string[], fiyat: number][] = [
  ['Sunta Vidası', 'Vida', ['Çetin', 'Koç'], ['3,5x16', '4x40', '4x50', '5x70'], 0.45],
  ['Çelik Dübel', 'Dübel', ['Fischer', 'Çetin'], ['M8', 'M10', 'M12'], 6.9],
  ['Şerit Metre', 'Ölçüm', ['Stanley', 'İzeltaş'], ['3 m', '5 m', '8 m'], 185],
  ['Kombine Pense', 'El Aleti', ['İzeltaş', 'Knipex'], ['160 mm', '180 mm', '200 mm'], 420],
  ['Matkap Ucu HSS', 'Matkap Ucu', ['Bosch', 'Makita'], ['4 mm', '6 mm', '8 mm', '10 mm'], 58],
  ['Silikon Şeffaf', 'Kimyasal', ['Soudal', 'Akfix'], ['280 ml', '310 ml'], 145],
  ['Kesme Taşı', 'Aşındırıcı', ['Bosch', 'Karbosan'], ['115 mm', '180 mm', '230 mm'], 39],
  ['Yıldız Tornavida', 'El Aleti', ['İzeltaş', 'Stanley'], ['PH1', 'PH2', 'PH3'], 95],
]
const RENKLER = ['#2563eb', '#0891b2', '#059669', '#ca8a04', '#dc2626', '#7c3aed', '#db2777', '#475569']

export async function demoVerisiYukle(): Promise<number> {
  const urunler: VegaUrun[] = []
  let id = 1000
  CESITLER.forEach(([ad, kategori, markalar, olculer, fiyat], c) => {
    for (const marka of markalar) {
      olculer.forEach((olcu, o) => {
        id++
        urunler.push({
          id, kod: `${kategori.slice(0, 2).toLocaleUpperCase('tr-TR')}${id}`, ad: `${marka} ${ad} ${olcu}`,
          barkod: `86900${id}00`, marka, kategori, olcu, raf: `${String.fromCharCode(65 + c)}-${o + 1}`,
          kdv: 20, satisFiyati: Math.round(fiyat * (1 + o * 0.35) * 100) / 100, alisFiyati: null, kritikEsik: 20,
        })
      })
    }
  })
  urunleriUygula(urunler)
  // Tekrarlanabilir sahte bakiyeler: bir kısmı tükenmiş, bir kısmı kritik eşiğin altında
  stoklariUygula(urunler.map((u) => ({ id: u.id, stok: u.id % 9 === 0 ? 0 : u.id % 5 === 0 ? 8 : (u.id * 37) % 400 })))

  if (!firmaOku().ad) firmaYaz({ ad: 'Örnek Yapı Market Ltd. Şti.', adres: 'Sanayi Cad. No: 12, Örnekköy', telefon: '0 (212) 555 00 00', eposta: 'satis@ornek.example', vergi: 'Örnek V.D. 1234567890' })

  // Örnek tedarik siparişleri: biri gecikmiş, biri yakın terminli, biri terminsiz
  if ((db.prepare('SELECT COUNT(*) AS n FROM tedarik_siparis').get() as { n: number }).n === 0) {
    const gun = (fark: number) => new Date(Date.now() + fark * 86_400_000).toLocaleDateString('sv-SE')
    const ekle = db.prepare('INSERT INTO tedarik_siparis (urun_id, tedarikci, miktar, termin) VALUES (?, ?, ?, ?)')
    ekle.run(1015, 'Anadolu Hırdavat A.Ş.', 100, gun(-4))
    ekle.run(1017, 'Anadolu Hırdavat A.Ş.', 50, gun(6))
    ekle.run(1010, 'Marmara Bağlantı Ltd.', 500, gun(12))
    ekle.run(1030, 'Ege Teknik Yapı', 10, null)
  }

  // Görseli olmayan her 3 üründen 2'sine renkli örnek görsel üret (WebP hattını da dener)
  const gorselli = new Set((db.prepare('SELECT urun_id AS id FROM urun_gorsel').all() as { id: number }[]).map((s) => s.id))
  for (const u of urunler) {
    if (gorselli.has(u.id) || u.id % 3 === 0) continue
    const renk = RENKLER[CESITLER.findIndex((c) => c[1] === u.kategori && u.ad.includes(c[0])) % RENKLER.length]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${renk}"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
      <rect width="1200" height="1200" fill="url(#g)"/>
      <circle cx="600" cy="520" r="250" fill="#ffffff" fill-opacity="0.14"/>
      <text x="600" y="570" font-family="sans-serif" font-size="150" font-weight="700" fill="#fff" text-anchor="middle">${u.olcu}</text>
      <text x="600" y="930" font-family="sans-serif" font-size="64" fill="#fff" fill-opacity="0.85" text-anchor="middle">ÖRNEK GÖRSEL</text>
    </svg>`
    await gorselKaydet(u.id, Buffer.from(svg))
  }
  return urunler.length
}
