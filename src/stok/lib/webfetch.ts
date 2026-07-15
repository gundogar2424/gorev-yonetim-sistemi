// Firma web sitesini/PDF'ini indirip içeriğini çıkarır (yapay zekaya METİN gider).
// APK'da CapacitorHttp ile CORS engeli OLMADAN indirir; tarayıcıda normal fetch
// denenir (çoğu sitede CORS engeli çıkabilir — bu özellik en iyi APK'da çalışır).
// (Diyet Koçu'ndaki webmenu mantığının stok için bağımsız kopyasıdır.)

export interface SiteFetch {
  kind: 'pdf' | 'text' | 'fail'
  pdfDataUrl?: string
  text?: string
  note?: string
}

function htmlToText(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|br|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  // Ürün listeleri uzun olabilir; makul bir sınır koy (token için)
  return s.slice(0, 24000)
}

function b64ToUtf8(b64: string): string {
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    try {
      return atob(b64)
    } catch {
      return ''
    }
  }
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function lowerHeaders(h: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of Object.keys(h ?? {})) out[k.toLowerCase()] = h![k]
  return out
}

// --- Geniş tarama için ham indirme (HTML linklerini de döndürür) ---
interface RawFetch {
  kind: 'html' | 'pdf' | 'fail'
  html?: string
  pdfDataUrl?: string
  note?: string
}

function normUrl(rawUrl: string): string {
  let url = rawUrl.trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  return url
}

async function fetchRaw(url: string): Promise<RawFetch> {
  const { Capacitor, CapacitorHttp } = await import('@capacitor/core')
  const isPdfUrl = /\.pdf(\?|#|$)/i.test(url)
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.get({
        url,
        responseType: 'blob',
        headers: { 'User-Agent': 'Mozilla/5.0 (Android) StokTakip', Accept: '*/*' }
      })
      const headers = lowerHeaders(res.headers as Record<string, string>)
      const ct = (headers['content-type'] || '').toLowerCase()
      const b64 = typeof res.data === 'string' ? res.data : ''
      if (!b64) return { kind: 'fail', note: 'indirilemedi' }
      if (ct.includes('pdf') || isPdfUrl) return { kind: 'pdf', pdfDataUrl: `data:application/pdf;base64,${b64}` }
      return { kind: 'html', html: b64ToUtf8(b64) }
    } catch {
      return { kind: 'fail', note: 'bağlantı hatası' }
    }
  }
  try {
    const r = await fetch(url)
    const ct = (r.headers.get('content-type') || '').toLowerCase()
    if (ct.includes('pdf') || isPdfUrl) {
      const buf = await r.arrayBuffer()
      return { kind: 'pdf', pdfDataUrl: `data:application/pdf;base64,${bufToB64(buf)}` }
    }
    return { kind: 'html', html: await r.text() }
  } catch {
    return { kind: 'fail', note: 'CORS/bağlantı engeli' }
  }
}

// HTML'den aynı siteye ait (http) bağlantıları çıkarır; görsel/statik dosyaları eler.
function extractLinks(html: string, baseUrl: string): string[] {
  let origin = ''
  try {
    origin = new URL(baseUrl).origin
  } catch {
    return []
  }
  const out = new Set<string>()
  const re = /href\s*=\s*["']([^"'#]+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const href = m[1].trim()
    if (!href || /^(mailto:|tel:|javascript:|data:)/i.test(href)) continue
    let abs: string
    try {
      abs = new URL(href, baseUrl).href
    } catch {
      continue
    }
    // Yalnızca aynı site + http(s)
    if (!abs.startsWith(origin)) continue
    // Statik/görsel dosyaları atla (PDF hariç — o ayrı işlenir)
    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|ico|woff2?|ttf|mp4|zip|rar|xml|json)(\?|#|$)/i.test(abs)) continue
    out.add(abs.split('#')[0])
  }
  return Array.from(out)
}

// Ürün/kategori sayfası olma ihtimali yüksek linkleri öne al (geniş ama odaklı)
const PRODUCT_HINT = /(urun|product|katalog|catalog|kategori|category|collection|koleksiyon|shop|magaza|store|item|p-|prod)/i

export interface CrawlResult {
  texts: string[] // taranan sayfaların metinleri
  pdfDataUrls: string[] // rastlanan PDF'ler (metni çağıran tarafça çıkarılır)
  visited: number
  failed: number
}

// Verilen tohum linklerden başlayıp aynı site içinde gezerek (BFS) metin toplar.
export async function crawlSite(
  seeds: string[],
  opts: { maxPages?: number; onProgress?: (done: number, max: number, url: string) => void } = {}
): Promise<CrawlResult> {
  const maxPages = Math.max(1, Math.min(80, opts.maxPages ?? 25))
  const queue: string[] = []
  const seen = new Set<string>()
  for (const s of seeds.map(normUrl).filter(Boolean)) {
    if (!seen.has(s)) {
      seen.add(s)
      queue.push(s)
    }
  }
  const texts: string[] = []
  const pdfDataUrls: string[] = []
  let visited = 0
  let failed = 0

  while (queue.length > 0 && visited < maxPages) {
    const url = queue.shift()!
    visited++
    opts.onProgress?.(visited, maxPages, url)
    const raw = await fetchRaw(url)
    if (raw.kind === 'fail') {
      failed++
      continue
    }
    if (raw.kind === 'pdf' && raw.pdfDataUrl) {
      pdfDataUrls.push(raw.pdfDataUrl)
      continue
    }
    if (raw.kind === 'html' && raw.html) {
      const text = htmlToText(raw.html)
      if (text.length >= 40) texts.push(text)
      // Yeni linkleri kuyruğa ekle (kota dolmadıysa). Ürün/kategori linklerini öne al.
      if (seen.size < maxPages * 4) {
        const links = extractLinks(raw.html, url)
        const prioritized = [...links.filter((l) => PRODUCT_HINT.test(l)), ...links.filter((l) => !PRODUCT_HINT.test(l))]
        for (const l of prioritized) {
          if (seen.size >= maxPages * 4) break
          if (!seen.has(l)) {
            seen.add(l)
            queue.push(l)
          }
        }
      }
    }
  }
  return { texts, pdfDataUrls, visited, failed }
}

export async function fetchSiteContent(rawUrl: string): Promise<SiteFetch> {
  let url = rawUrl.trim()
  if (!url) return { kind: 'fail', note: 'Boş bağlantı.' }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url

  const { Capacitor, CapacitorHttp } = await import('@capacitor/core')
  const isPdfUrl = /\.pdf(\?|#|$)/i.test(url)

  // --- APK (native): CORS yok ---
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.get({
        url,
        responseType: 'blob',
        headers: { 'User-Agent': 'Mozilla/5.0 (Android) StokTakip', Accept: '*/*' }
      })
      const headers = lowerHeaders(res.headers as Record<string, string>)
      const ct = (headers['content-type'] || '').toLowerCase()
      const b64 = typeof res.data === 'string' ? res.data : ''
      if (!b64) return { kind: 'fail', note: 'Sayfa indirilemedi.' }
      if (ct.includes('pdf') || isPdfUrl) {
        return { kind: 'pdf', pdfDataUrl: `data:application/pdf;base64,${b64}` }
      }
      const text = htmlToText(b64ToUtf8(b64))
      if (text.length < 40) return { kind: 'fail', note: 'Sayfa içeriği okunamadı (uygulama tabanlı site olabilir).' }
      return { kind: 'text', text }
    } catch {
      return { kind: 'fail', note: 'Bağlantı açılamadı. İnternetini kontrol et.' }
    }
  }

  // --- Web: CORS engeli olabilir ---
  try {
    const r = await fetch(url)
    const ct = (r.headers.get('content-type') || '').toLowerCase()
    if (ct.includes('pdf') || isPdfUrl) {
      const buf = await r.arrayBuffer()
      return { kind: 'pdf', pdfDataUrl: `data:application/pdf;base64,${bufToB64(buf)}` }
    }
    const text = htmlToText(await r.text())
    if (text.length < 40) return { kind: 'fail', note: 'İçerik okunamadı.' }
    return { kind: 'text', text }
  } catch {
    return { kind: 'fail', note: 'Tarayıcıda güvenlik engeli (CORS) olabilir; bu özellik uygulamada (APK) daha güvenilir çalışır.' }
  }
}
