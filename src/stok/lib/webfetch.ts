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
