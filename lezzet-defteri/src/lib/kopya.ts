// KOPYA KONTROLU: ayni tarif deftere ikinci kez girmesin.
//  1) Ayni link (farkli paylasim kodlariyla da gelse) -> yapay zekaya hic gitmeden yakalanir
//  2) Farkli platformdan ayni tarif (Instagram'daki tarif YouTube'da da var gibi)
//     -> baslik ve malzeme benzerliginden yakalanir (cihazda, yapay zeka harcamaz)
import { lzDb } from '../db'
import type { LzRecipe } from '../types'
import { youtubeId } from './importer'

// Ayni video farkli paylasim kodlariyla (?igsh=, ?si=) gelebilir; YouTube'da video kimligi kullanilir.
export function temelLink(url: string): string {
  const yt = youtubeId(url)
  if (yt) return `youtube:${yt}`
  return url
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/^https?:\/\/(www\.|m\.)?/i, '')
    .replace(/\/reels\//, '/reel/')
}

export async function ayniLinkliTarif(url: string): Promise<LzRecipe | undefined> {
  if (!url) return undefined
  const t = temelLink(url)
  return (await lzDb.recipes.toArray()).find((r) => r.sourceUrl && temelLink(r.sourceUrl) === t)
}

const DOLGU = new Set(
  (
    'su bardağı bardak çay yemek tatlı kaşık kaşığı kaşığı adet tutam paket kase dilim diş yarım çeyrek bir iki üç dört beş ' +
    'büyük küçük orta boy kadar isteğe göre için veya ile gram gr kg ml lt litre paketi kutu kutusu avuç biraz az çok ' +
    'ince iri doğranmış rendelenmiş kıyılmış haşlanmış oda sıcaklığında taze kuru the and of cup cups tbsp tsp teaspoon tablespoon ' +
    'tarif tarifi kolay pratik nefis enfes harika lezzetli ev yapımı evde süper muhteşem en'
  ).split(' ')
)

// Kelime kokleri (Turkce ekler icin ilk 5 harf)
function kokler(metin: string): Set<string> {
  const k = new Set<string>()
  for (const w of metin.toLocaleLowerCase('tr').split(/[^\p{L}]+/u)) {
    if (w.length < 3 || DOLGU.has(w)) continue
    k.add(w.slice(0, 5))
  }
  return k
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let ortak = 0
  for (const x of a) if (b.has(x)) ortak++
  return (2 * ortak) / (a.size + b.size)
}

export interface Benzerlik {
  tarif: LzRecipe
  neden: string
}

// Icerigi ayni/cok benzer tarifi bulur (farkli platformdan gelmis olabilir)
export async function benzerTarif(
  d: { title: string; ingredients: string[]; sourceUrl?: string },
  haricId?: number
): Promise<Benzerlik | undefined> {
  if (d.sourceUrl) {
    const ayni = await ayniLinkliTarif(d.sourceUrl)
    if (ayni && ayni.id !== haricId) return { tarif: ayni, neden: 'aynı link' }
  }
  const malz = d.ingredients.filter((x) => x.trim())
  if (!d.title.trim() && malz.length < 3) return undefined
  const bt = kokler(d.title)
  const bm = kokler(malz.join(' '))
  let en: { r: LzRecipe; puan: number; neden: string } | undefined
  for (const r of await lzDb.recipes.toArray()) {
    if (r.id === haricId) continue
    const ts = dice(bt, kokler(r.title))
    const rm = r.ingredients.filter((x) => x.trim())
    const ms = dice(bm, kokler(rm.join(' ')))
    const az = Math.min(malz.length, rm.length)
    let neden = ''
    if (ts >= 0.6 && ms >= 0.55) neden = 'başlık ve malzemeler çok benzer'
    else if ((az >= 5 && ms >= 0.85 && ts >= 0.4) || (az >= 6 && ms >= 0.95)) neden = 'malzemeler neredeyse aynı'
    else if (ts >= 0.95 && (az < 3 || ms >= 0.4)) neden = 'aynı başlık'
    if (!neden) continue
    const puan = ts + ms
    if (!en || puan > en.puan) en = { r, puan, neden }
  }
  return en ? { tarif: en.r, neden: en.neden } : undefined
}
