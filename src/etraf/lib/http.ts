// HTTP: duz fetch. Overpass ve Google Places (New) ikisi de CORS'a izin
// verdigi icin APK'nin WebView'inde de tarayicidaki gibi calisir.

interface Req {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export async function httpJson<T>({ url, method = 'GET', headers = {}, body, timeoutMs = 30000 }: Req): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method, headers, body, signal: ctrl.signal })
    const text = await res.text()
    const data = safeParse(text)
    if (!res.ok) throw new HttpError(res.status, data)
    return data as T
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('Sunucu zamanında yanıt vermedi.')
    throw e
  } finally {
    clearTimeout(t)
  }
}

export class HttpError extends Error {
  status: number
  data: unknown
  constructor(status: number, data: unknown) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ??
      (typeof data === 'string' ? data.replace(/<[^>]+>/g, ' ').trim().slice(0, 160) : `HTTP ${status}`)
    super(msg || `HTTP ${status}`)
    this.status = status
    this.data = data
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
