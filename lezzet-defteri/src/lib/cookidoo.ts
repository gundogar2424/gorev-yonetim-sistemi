// COOKIDOO'YA LINKLE AKTARMA
// Cookidoo "Mevcut bir tarifi içe aktar" kutusuna verilen sayfayi okur ve schema.org Recipe
// verisinden malzeme/adimlari cikarir. Tarifler telefonda durdugu icin internette bir adres gerekir:
// kullanicinin kendi GitHub deposu (ucretsiz GitHub Pages). Uygulama sayfayi hazirlar, GitHub'in
// "yeni dosya" ekranini icerik doldurulmus acar; kullanici "Commit" der; 1 dk sonra sayfa yayindadir.
// Hesap/anahtar gerekmez: kullanici tarayicida GitHub'a girmis olmali.
import type { LzRecipe } from '../types'
import { adimOzeti, cihazAdimi, tmSurumDenetle } from './tm7'

const KEY_DEPO = 'lz-tarif-depo'
export const VARSAYILAN_DEPO = 'gundogar2424/lezzet-tarifler'

export function tarifDeposu(): string {
  try {
    return (localStorage.getItem(KEY_DEPO) || VARSAYILAN_DEPO).trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '')
  } catch {
    return VARSAYILAN_DEPO
  }
}
export function tarifDeposuKaydet(v: string): void {
  try {
    localStorage.setItem(KEY_DEPO, v.trim())
  } catch {
    /* yok */
  }
}

function k(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function slug(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}
export function dosyaYolu(r: LzRecipe): string {
  return `t/${slug(r.title) || 'tarif'}-${r.id}.html`
}

// Cookidoo'nun okuyacagi sayfa: schema.org Recipe (JSON-LD) + sade gorunur metin.
// Thermomix surumu varsa adimlar cihaz ayarlariyla ("14 dk/90°C/hız 4"), yoksa normal tarif.
export function cookidooSayfasi(r: LzRecipe): string {
  const tm = r.tm ? tmSurumDenetle(r.tm) : undefined
  const malzemeler = tm ? tm.ingredients : r.ingredients
  const adimlar = tm
    ? tm.steps.map((a) => {
        const cihaz = cihazAdimi(a)
        const ayar = cihaz ? adimOzeti(a).replace(/devir/g, 'hız').replace(/ · /g, ' / ') : ''
        // Yalnizca cihazin calistigi adimda malzeme hazneye girer; digerlerinde (bisküvi dizme, kakao serpme) sadece listelenir
        return [a.kelebek ? 'Kelebeği tak.' : '', a.ingredients ? (cihaz ? `${a.ingredients} hazneye ekle.` : `Malzemeler: ${a.ingredients}.`) : '', a.text, ayar ? `(${ayar})` : '', a.tip ? `Not: ${a.tip}` : ''].filter(Boolean).join(' ')
      })
    : r.steps
  const notlar = [tm?.warnings.join(' ') ?? '', r.notes].filter(Boolean).join(' ')
  const ozetMetni = `${r.title} tarifi: ${malzemeler.length} malzeme, ${adimlar.length} adımda hazırlanış${tm ? ', Thermomix ayarlarıyla' : ''}.${r.servings ? ` ${r.servings} porsiyon.` : ''}`
  const veri = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.title,
    description: ozetMetni,
    author: { '@type': 'Person', name: r.author || 'Lezzet Rotası' },
    recipeYield: r.servings ? `${r.servings} porsiyon` : undefined,
    totalTime: r.minutes ? `PT${r.minutes}M` : undefined,
    recipeCategory: tm?.category || r.tags[0],
    keywords: [tm ? 'Thermomix' : '', ...r.tags].filter(Boolean).join(', '),
    recipeIngredient: malzemeler,
    recipeInstructions: adimlar.map((t) => ({ '@type': 'HowToStep', text: t })),
    ...(r.sourceUrl ? { isBasedOn: r.sourceUrl } : {})
  }
  const canon = yayinUrl(r)
  const ana = canon.replace(/t\/[^/]+$/, '')
  const ozet = [r.servings ? `${r.servings} porsiyon` : '', r.minutes ? `${r.minutes} dk` : '', tm ? `Thermomix · ${tm.category}` : ''].filter(Boolean).join(' · ')
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${k(r.title)} – Lezzet Rotası</title>
<meta name="description" content="${k(ozetMetni.slice(0, 160))}"><link rel="canonical" href="${canon}"><meta name="lz-tarih" content="${new Date().toISOString().slice(0, 10)}">
<meta property="og:title" content="${k(r.title)}"><meta property="og:type" content="article"><meta property="og:url" content="${canon}">
<script type="application/ld+json">${JSON.stringify(veri).replace(/</g, '\\u003c')}</script>
<style>:root{--bg:#fffaf5;--kart:#fff;--yazi:#1f1a17;--soluk:#7a6f68;--vurgu:#d9480f;--cizgi:#efe3d8}@media(prefers-color-scheme:dark){:root{--bg:#161210;--kart:#211b18;--yazi:#f4ece6;--soluk:#a89b92;--vurgu:#ff8a4c;--cizgi:#342b26}}
body{margin:0;background:var(--bg);color:var(--yazi);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.55}main{max-width:680px;margin:0 auto;padding:16px 16px 48px}
a.geri{color:var(--soluk);text-decoration:none;font-size:14px}h1{font-size:28px;margin:12px 0 4px;letter-spacing:-.02em}.ozet{color:var(--soluk);margin:0 0 20px}
section{background:var(--kart);border:1px solid var(--cizgi);border-radius:16px;padding:16px 18px;margin:12px 0}h2{font-size:17px;margin:0 0 10px;color:var(--vurgu)}
ul,ol{margin:0;padding-left:22px}li{margin:6px 0}ol li{padding-left:4px}.not{color:var(--soluk);font-size:14px}footer{text-align:center;color:var(--soluk);font-size:13px;padding-top:16px}footer a{color:inherit}</style></head>
<body><main><a class="geri" href="${ana}">← Tüm tarifler</a><h1>${k(r.title)}</h1>${ozet ? `<p class="ozet">${k(ozet)}</p>` : ''}
<section><h2>Malzemeler</h2><ul>${malzemeler.map((m) => `<li>${k(m)}</li>`).join('')}</ul></section>
<section><h2>Hazırlanışı</h2><ol>${adimlar.map((a) => `<li>${k(a)}</li>`).join('')}</ol></section>
${notlar ? `<section><h2>Notlar</h2><p class="not">${k(notlar)}</p></section>` : ''}
<footer>Lezzet Rotası ile hazırlandı${r.sourceUrl ? ` · Kaynak: <a href="${k(r.sourceUrl)}" rel="nofollow">${k(r.sourceUrl.replace(/^https?:\/\/(www\.)?/, '').slice(0, 50))}</a>` : ''}</footer></main></body></html>`
}

// GitHub "yeni dosya" ekrani: dosya adi ve icerik dolu acilir, kullanici yalnizca Commit der.
// Uzun tariflerde link GitHub sinirini (~8 bin karakter) asar; o zaman yalnizca dosya adi dolu acilir.
export function githubYeniDosyaUrl(r: LzRecipe, icerikle = true): string {
  const temel = `https://github.com/${tarifDeposu()}/new/main?filename=${encodeURIComponent(dosyaYolu(r))}`
  return icerikle ? `${temel}&value=${encodeURIComponent(cookidooSayfasi(r))}` : temel
}
export function linkSigarMi(r: LzRecipe): boolean {
  return githubYeniDosyaUrl(r).length < 7500
}

// GitHub anahtari (yalnizca bu telefonda durur, yedege girmez). Varsa sayfa tek dokunusla yayinlanir.
const KEY_TOKEN = 'lz-github-token'
export function githubAnahtari(): string {
  try {
    return (localStorage.getItem(KEY_TOKEN) || '').trim()
  } catch {
    return ''
  }
}
export function githubAnahtariKaydet(v: string): void {
  try {
    if (v.trim()) localStorage.setItem(KEY_TOKEN, v.trim())
    else localStorage.removeItem(KEY_TOKEN)
  } catch {
    /* yok */
  }
}
export function anahtarOlusturUrl(): string {
  return 'https://github.com/settings/personal-access-tokens/new'
}

function base64(s: string): string {
  const b = new TextEncoder().encode(s)
  let ikili = ''
  for (let i = 0; i < b.length; i += 0x8000) ikili += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(ikili)
}

// Sayfayi dogrudan depoya yazar (varsa gunceller). Basarida yayin adresini dondurur.
export async function siteyeGonder(r: LzRecipe): Promise<string> {
  const anahtar = githubAnahtari()
  if (!anahtar) throw new Error('GitHub anahtarı yok')
  const yol = dosyaYolu(r)
  const api = `https://api.github.com/repos/${tarifDeposu()}/contents/${yol}`
  const basliklar = { Authorization: `Bearer ${anahtar}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  let sha: string | undefined
  const var_ = await fetch(api, { headers: basliklar, cache: 'no-store' })
  if (var_.ok) sha = ((await var_.json()) as { sha?: string }).sha
  else if (var_.status === 401) throw new Error('GitHub anahtarı geçersiz ya da süresi dolmuş (Ayarlar → Tarif sitem)')
  const c = await fetch(api, {
    method: 'PUT',
    headers: { ...basliklar, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `${sha ? 'Güncellendi' : 'Eklendi'}: ${r.title}`, content: base64(cookidooSayfasi(r)), ...(sha ? { sha } : {}) })
  })
  if (!c.ok) {
    const m = ((await c.json().catch(() => ({}))) as { message?: string }).message || String(c.status)
    if (c.status === 401) throw new Error('GitHub anahtarı geçersiz ya da süresi dolmuş (Ayarlar → Tarif sitem)')
    if (c.status === 403 || c.status === 404) throw new Error(`Anahtarın bu depoya yazma izni yok (${tarifDeposu()}). Anahtarda “Contents: Read and write” seçili olmalı.`)
    throw new Error(m)
  }
  return yayinUrl(r)
}
// Yayinlanan sayfanin adresi (GitHub Pages: main dalinin koku)
export function yayinUrl(r: LzRecipe): string {
  const [sahip, depo] = tarifDeposu().split('/')
  return `https://${sahip}.github.io/${depo}/${dosyaYolu(r)}`
}
export function depoUrl(): string {
  return `https://github.com/${tarifDeposu()}`
}

// Sayfa yayinda mi (telefonda CapacitorHttp ile; tarayicida CORS yuzunden bilinemez -> null)
export async function yayindaMi(url: string): Promise<boolean | null> {
  try {
    const { Capacitor, CapacitorHttp } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return null
    const r = await CapacitorHttp.get({ url: `${url}?t=${Date.now()}`, responseType: 'text' })
    return r.status === 200 && /application\/ld\+json/.test(String(r.data))
  } catch {
    return false
  }
}

// "Siteye koy" akisi: anahtar varsa dogrudan yayinlar; yoksa GitHub ekranini acar.
// Donen metin kullaniciya gosterilir.
export async function siteyeKoy(r: LzRecipe): Promise<{ tamam: boolean; mesaj: string; url: string }> {
  const url = yayinUrl(r)
  if (githubAnahtari()) {
    try {
      await siteyeGonder(r)
      await navigator.clipboard?.writeText(url).catch(() => undefined)
      return { tamam: true, mesaj: '✓ Siteye gönderildi, link kopyalandı. 1–2 dk sonra açılır.', url }
    } catch (e) {
      return { tamam: false, mesaj: 'Gönderilemedi: ' + (e instanceof Error ? e.message : String(e)), url }
    }
  }
  if (linkSigarMi(r)) {
    window.open(githubYeniDosyaUrl(r), '_blank')
    return { tamam: true, mesaj: 'GitHub’da yeşil “Commit changes”e iki kez bas; 1–2 dk sonra yayında.', url }
  }
  // Uzun tarif: GitHub bos dosya ekrani acilir, icerik panoya. Pencere, dokunusun hemen ardindan
  // (beklemeden) acilmali; yoksa telefon acilir pencereyi engeller.
  window.open(githubYeniDosyaUrl(r, false), '_blank')
  await navigator.clipboard?.writeText(cookidooSayfasi(r)).catch(() => undefined)
  return {
    tamam: true,
    mesaj: 'Tarif uzun olduğu için sayfa panoya kopyalandı: GitHub’da büyük boş kutuya uzun basıp “Yapıştır”, sonra “Commit changes”e iki kez bas. Tek dokunuş için Ayarlar → Tarif sitem → GitHub anahtarı.',
    url
  }
}
