// LINKTEN TARIF.
//
// Sosyal medya paylasimi ya da tarif sitesi adresinden tarif taslagi cikarir:
//  1) Sayfa indirilir (APK'da CapacitorHttp ile — CORS engeli yok; web'de
//     fetch denenir, cogu site engeller).
//  2) Sayfada schema.org "Recipe" (JSON-LD) varsa malzeme ve adimlar oradan
//     DOGRUDAN okunur — yapay zeka gerekmez. Tarif sitelerinin cogunda vardir.
//  3) Yoksa (Instagram, TikTok, YouTube...) paylasimin aciklamasi (og:description
//     / oEmbed basligi) ve kapak gorseli alinir. Bu serbest metin, varsa yapay
//     zekayla, yoksa basit kurallarla malzeme/adim olarak ayrilir.
import type { LzDraft, LzPlatform } from '../types'

export function platformBul(url: string): LzPlatform {
  const u = url.toLowerCase()
  if (/instagram\.com|instagr\.am/.test(u)) return 'instagram'
  if (/tiktok\.com/.test(u)) return 'tiktok'
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube'
  if (/pinterest\.|pin\.it/.test(u)) return 'pinterest'
  if (/facebook\.com|fb\.watch/.test(u)) return 'facebook'
  return 'web'
}

export const PLATFORM_AD: Record<LzPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  facebook: 'Facebook',
  web: 'Web',
  manual: 'Kendi tarifim'
}

// Paylasilan metnin icinden ilk adresi ayiklar ("Şu tarife bak https://...").
export function linkAyikla(metin: string): string {
  const m = metin.match(/https?:\/\/[^\s<>"']+/i)
  if (m) return m[0].replace(/[),.;!?]+$/, '')
  const t = metin.trim()
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) return 'https://' + t
  return ''
}

export interface LinkSonucu {
  draft: LzDraft
  // Sayfadan okunan serbest metin (sosyal medya aciklamasi). Yapilandirilmis
  // tarif bulunduysa bos. Doluysa yapay zekaya / kurallara verilir.
  hamMetin: string
  yapilandirilmis: boolean // JSON-LD'den geldi (dogrudan kullanilabilir)
  not: string // Kullaniciya gosterilecek kisa bilgi (neden eksik kaldi vb.)
  html: string // Indirilen sayfa (video adresi / YouTube altyazisi icin)
}

function bosTaslak(url: string): LzDraft {
  return {
    title: '',
    photo: '',
    sourceUrl: url,
    platform: platformBul(url),
    author: '',
    servings: 0,
    minutes: 0,
    ingredients: [],
    steps: [],
    notes: '',
    tags: []
  }
}

export async function metinIndir(url: string, ua: string): Promise<string> {
  const { Capacitor, CapacitorHttp } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.get({
      url,
      responseType: 'text',
      headers: { 'User-Agent': ua, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'tr-TR,tr;q=0.9' }
    })
    if (r.status >= 400) throw new Error(String(r.status))
    return typeof r.data === 'string' ? r.data : JSON.stringify(r.data)
  }
  const r = await fetch(url)
  if (!r.ok) throw new Error(String(r.status))
  return r.text()
}

// Sosyal medya sayfalari tam HTML'i yalnizca "onizleme botlarina" veriyor;
// normal tarayici kimligiyle giris ekranina yonlendiriliyor. Bu yuzden once
// bot kimligi, olmazsa telefon tarayicisi denenir.
const UA_BOT = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
const UA_MOBIL =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'

export async function linktenTarif(url: string): Promise<LinkSonucu> {
  const draft = bosTaslak(url)
  const platform = draft.platform

  // oEmbed: TikTok ve YouTube acik bir uc nokta sunar (baslik = aciklama, kapak).
  let oembedMetin = ''
  const oembed =
    platform === 'tiktok'
      ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
      : platform === 'youtube'
        ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
        : ''
  if (oembed) {
    try {
      const j = JSON.parse(await metinIndir(oembed, UA_MOBIL)) as {
        title?: string
        author_name?: string
        thumbnail_url?: string
      }
      oembedMetin = j.title ?? ''
      draft.author = j.author_name ?? ''
      if (j.thumbnail_url) draft.photo = j.thumbnail_url
    } catch {
      /* sayfanin kendisi denenecek */
    }
  }

  let html = ''
  for (const ua of platform === 'web' ? [UA_MOBIL, UA_BOT] : [UA_BOT, UA_MOBIL]) {
    try {
      html = await metinIndir(url, ua)
      if (html && html.length > 500) break
    } catch {
      /* sonraki kimlik */
    }
  }

  if (!html && !oembedMetin) {
    return {
      draft,
      hamMetin: '',
      yapilandirilmis: false,
      html: '',
      not: await webMi()
        ? 'Tarayıcı bu sayfayı okumaya izin vermedi. Uygulamanın telefon (APK) sürümünde linkler okunur; şimdilik paylaşımın açıklamasını kopyalayıp “Metinden ekle”yi kullan.'
        : 'Sayfa açılamadı. İnternet bağlantını kontrol et ya da paylaşımın açıklamasını kopyalayıp “Metinden ekle”yi kullan.'
    }
  }

  // 1) Yapilandirilmis tarif (tarif siteleri)
  const ld = html ? jsonLdTarif(html) : null
  if (ld && (ld.ingredients?.length || ld.steps?.length)) {
    const d = { ...draft, ...ld, sourceUrl: url, platform }
    if (!d.photo) d.photo = draft.photo || meta(html, 'og:image')
    if (!d.author) d.author = draft.author || meta(html, 'og:site_name')
    return { draft: d, hamMetin: '', yapilandirilmis: true, not: '', html }
  }

  // 2) Sosyal medya aciklamasi
  const ogBaslik = html ? meta(html, 'og:title') : ''
  const ogAciklama = html ? meta(html, 'og:description') || meta(html, 'description') : ''
  const ogGorsel = html ? meta(html, 'og:image') : ''
  if (!draft.photo && ogGorsel) draft.photo = ogGorsel
  if (!draft.author) draft.author = yazarBul(ogBaslik, ogAciklama, platform)

  // Instagram'da asil aciklama "... likes, ... comments - hesap on ...: \"METIN\"" kalibinin icinde
  const ham = instagramAciklama(ogAciklama) || enUzun([oembedMetin, ogAciklama, ogBaslik])
  if (!draft.title) draft.title = baslikTahmin(ham, ogBaslik)

  return {
    draft,
    hamMetin: ham,
    yapilandirilmis: false,
    html,
    not: ham.length < 40 ? 'Paylaşımın açıklaması okunamadı; malzemeleri kendin ekleyebilir ya da açıklamayı kopyalayıp “Metinden ekle”yi kullanabilirsin.' : ''
  }
}

async function webMi(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return !Capacitor.isNativePlatform()
  } catch {
    return true
  }
}

function enUzun(liste: string[]): string {
  return liste.map((s) => (s ?? '').trim()).sort((a, b) => b.length - a.length)[0] ?? ''
}

// Instagram og:description: '1.234 likes, 56 comments - hesap on June 1, 2025: "ASIL METIN"'
function instagramAciklama(s: string): string {
  const m = s.match(/:\s*[“"]([\s\S]+)[”"]\s*\.?\s*$/)
  return m ? m[1] : ''
}

function yazarBul(baslik: string, aciklama: string, platform: LzPlatform): string {
  if (platform === 'instagram') {
    const m = aciklama.match(/-\s*([\w.]+)\s+(?:on|tarihinde|,)/i) || baslik.match(/\(@([\w.]+)\)/)
    if (m) return '@' + m[1].replace(/^@/, '')
  }
  return ''
}

function baslikTahmin(metin: string, ogBaslik: string): string {
  const ilk = metin
    .split('\n')
    .map((s) => s.replace(/[#@]\S+/g, '').replace(/[^\p{L}\p{N}\s'’&,-]/gu, '').trim())
    .find((s) => s.length >= 3)
  if (ilk && ilk.length <= 60) return ilk
  if (ilk) return ilk.slice(0, 57).replace(/\s+\S*$/, '') + '…'
  return ogBaslik.replace(/\s*[|•·-]\s*(Instagram|TikTok|YouTube|Pinterest).*$/i, '').slice(0, 60)
}

// --- HTML yardimcilari ----------------------------------------------------

const ADLI: Record<string, string> = {
  ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', hellip: '…', ndash: '–', mdash: '—', deg: '°', frac12: '½', frac14: '¼', frac34: '¾'
}

function htmlCoz(s: string): string {
  return s
    .replace(/&([a-zA-Z0-9]+);/g, (tam, ad: string) => ADLI[ad] ?? tam)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function meta(html: string, ad: string): string {
  const kacis = ad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${kacis}["'][^>]*content=["']([^"']*)["']`, 'i')
  const r2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${kacis}["']`, 'i')
  const m = html.match(r1) || html.match(r2)
  return m ? htmlCoz(m[1]).trim() : ''
}

function etiketsiz(s: string): string {
  return htmlCoz(String(s ?? '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

// ISO 8601 sure ("PT1H20M") -> dakika
function isoDakika(s: unknown): number {
  const m = String(s ?? '').match(/P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/i)
  if (!m) return 0
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)
}

type Json = Record<string, unknown>

function recipeBul(node: unknown): Json | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = recipeBul(n)
      if (r) return r
    }
    return null
  }
  const o = node as Json
  const tip = o['@type']
  if (tip === 'Recipe' || (Array.isArray(tip) && tip.includes('Recipe'))) return o
  if (o['@graph']) return recipeBul(o['@graph'])
  if (o.mainEntity) return recipeBul(o.mainEntity)
  return null
}

function adimlar(x: unknown): string[] {
  if (!x) return []
  if (typeof x === 'string') {
    return etiketsiz(x.replace(/<\/(p|li)>|<br\s*\/?>/gi, '\n'))
      .split(/\n|(?<=\.)\s+(?=\d+[.)-])/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (Array.isArray(x)) return x.flatMap(adimlar)
  if (typeof x === 'object') {
    const o = x as Json
    if (o.itemListElement) return adimlar(o.itemListElement)
    if (o.text) return [etiketsiz(String(o.text))]
    if (o.name) return [etiketsiz(String(o.name))]
  }
  return []
}

function gorsel(x: unknown): string {
  if (!x) return ''
  if (typeof x === 'string') return x
  if (Array.isArray(x)) return gorsel(x[0])
  if (typeof x === 'object') return String((x as Json).url ?? '')
  return ''
}

function jsonLdTarif(html: string): Partial<LzDraft> | null {
  const bloklar = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? []
  for (const b of bloklar) {
    const icerik = b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '')
    let veri: unknown
    try {
      veri = JSON.parse(icerik.trim())
    } catch {
      continue
    }
    const r = recipeBul(veri)
    if (!r) continue
    const yieldStr = String(Array.isArray(r.recipeYield) ? r.recipeYield[0] : (r.recipeYield ?? ''))
    const yazar = Array.isArray(r.author) ? (r.author[0] as Json)?.name : (r.author as Json | undefined)?.name
    const kategori = Array.isArray(r.recipeCategory) ? r.recipeCategory : r.recipeCategory ? [r.recipeCategory] : []
    return {
      title: etiketsiz(String(r.name ?? '')),
      photo: gorsel(r.image),
      author: yazar ? String(yazar) : '',
      servings: Number(yieldStr.match(/\d+/)?.[0] ?? 0),
      minutes: isoDakika(r.totalTime) || isoDakika(r.cookTime) + isoDakika(r.prepTime),
      ingredients: ((r.recipeIngredient ?? r.ingredients ?? []) as unknown[]).map((s) => etiketsiz(String(s))).filter(Boolean),
      steps: adimlar(r.recipeInstructions),
      notes: r.description ? etiketsiz(String(r.description)) : '',
      tags: (kategori as unknown[]).map((k) => etiketsiz(String(k))).filter(Boolean).slice(0, 3)
    }
  }
  return null
}
