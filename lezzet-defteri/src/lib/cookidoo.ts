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
        const ayar = cihazAdimi(a) ? adimOzeti(a).replace(/devir/g, 'hız').replace(/ · /g, ' / ') : ''
        return [a.kelebek ? 'Kelebeği tak.' : '', a.ingredients ? `${a.ingredients} hazneye ekle.` : '', a.text, ayar ? `(${ayar})` : '', a.tip ? `Not: ${a.tip}` : ''].filter(Boolean).join(' ')
      })
    : r.steps
  const notlar = [tm?.warnings.join(' ') ?? '', r.notes].filter(Boolean).join(' ')
  const veri = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.title,
    description: notlar || `${r.title}${tm ? ' — Thermomix uyarlaması' : ''}`,
    author: { '@type': 'Person', name: r.author || 'Lezzet Rotası' },
    recipeYield: r.servings ? `${r.servings} porsiyon` : undefined,
    totalTime: r.minutes ? `PT${r.minutes}M` : undefined,
    recipeCategory: tm?.category || r.tags[0],
    keywords: [tm ? 'Thermomix' : '', ...r.tags].filter(Boolean).join(', '),
    recipeIngredient: malzemeler,
    recipeInstructions: adimlar.map((t) => ({ '@type': 'HowToStep', text: t })),
    ...(r.sourceUrl ? { isBasedOn: r.sourceUrl } : {})
  }
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${k(r.title)}</title>
<script type="application/ld+json">${JSON.stringify(veri).replace(/</g, '\\u003c')}</script>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:16px;line-height:1.5;color:#18181b}h1{font-size:24px}li{margin:4px 0}</style></head>
<body><h1>${k(r.title)}</h1><p>${k([r.servings ? `${r.servings} porsiyon` : '', r.minutes ? `${r.minutes} dk` : '', tm ? `Thermomix · ${tm.category}` : ''].filter(Boolean).join(' · '))}</p>
<h2>Malzemeler</h2><ul>${malzemeler.map((m) => `<li>${k(m)}</li>`).join('')}</ul>
<h2>Hazırlanışı</h2><ol>${adimlar.map((a) => `<li>${k(a)}</li>`).join('')}</ol>
${notlar ? `<p><b>Not:</b> ${k(notlar)}</p>` : ''}<p style="color:#888;font-size:13px">Lezzet Rotası ile hazırlandı${r.sourceUrl ? ` · Kaynak: <a href="${k(r.sourceUrl)}">${k(r.sourceUrl.replace(/^https?:\/\/(www\.)?/, '').slice(0, 50))}</a>` : ''}</p></body></html>`
}

// GitHub "yeni dosya" ekrani: dosya adi ve icerik dolu acilir, kullanici yalnizca Commit der
export function githubYeniDosyaUrl(r: LzRecipe): string {
  return `https://github.com/${tarifDeposu()}/new/main?filename=${encodeURIComponent(dosyaYolu(r))}&value=${encodeURIComponent(cookidooSayfasi(r))}`
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
